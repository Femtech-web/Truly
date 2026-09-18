import { requireWallet } from '../device-management'
import { HttpError, json, readJson } from '../http'
import { consumeLimit } from '../rate-limits'
import type { Env } from '../types'
import { getGroqConfiguration } from './groq'
import { resolveSkillVersion } from './access'
import { activationKey, loadTaskSession } from './sessions'
import { createTaskPlan, parseTaskPlan, type TaskPlan } from './task-plan'
import { parseStoredResources, parseTaskResources, parseTaskWorkspaceUrl, type LearningLink } from './resources'
import { firstUnfinishedStep, NEXT_TASK_STEP_SQL } from './progress-state'

interface TaskRow {
  id: string; goal: string; title: string; outcome: string; plan_json: string
  workspace_url: string | null; resources_json: string
  source_kind: 'direct' | 'path'; source_skill_id: string | null; source_skill_version: number | null
  creator_name: string | null
  status: 'draft' | 'active' | 'completed' | 'archived'; created_at: string; updated_at: string
}

function identifier(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > 96 || !/^[A-Za-z0-9_-]+$/.test(text)) {
    throw new HttpError(400, 'invalid_task_activation', `${field} is invalid.`)
  }
  return text
}

function goal(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_task_goal', 'Tell Truly what you want to learn.')
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length < 4 || normalized.length > 240) {
    throw new HttpError(400, 'invalid_task_goal', 'Use one short sentence to describe what you want to learn.')
  }
  return normalized
}

function taskPayload(row: TaskRow, plan: TaskPlan) {
  const workspaceLink: LearningLink | null = row.workspace_url
    ? { title: 'Starting point', url: row.workspace_url }
    : null
  return {
    id: row.id, goal: row.goal, title: row.title, outcome: row.outcome, steps: plan.steps,
    workspaceLink, resources: parseStoredResources(row.resources_json),
    source: { kind: row.source_kind, pathId: row.source_skill_id, pathVersion: row.source_skill_version, creatorName: row.creator_name },
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

async function loadOwnedTask(env: Env, walletAddress: string, taskId: string): Promise<{ row: TaskRow; plan: TaskPlan }> {
  const row = await env.DB.prepare(`SELECT learning_tasks.id, learning_tasks.goal, learning_tasks.title, learning_tasks.outcome,
      learning_tasks.plan_json, learning_tasks.workspace_url, learning_tasks.resources_json,
      learning_tasks.source_kind, learning_tasks.source_skill_id, learning_tasks.source_skill_version,
      creators.display_name AS creator_name, learning_tasks.status, learning_tasks.created_at, learning_tasks.updated_at
    FROM learning_tasks LEFT JOIN skills ON skills.id = learning_tasks.source_skill_id
    LEFT JOIN creators ON creators.id = skills.creator_id
    WHERE learning_tasks.id = ? AND learning_tasks.wallet_address = ? LIMIT 1`)
    .bind(taskId, walletAddress).first<TaskRow>()
  if (!row) throw new HttpError(404, 'task_not_found', 'This Task is no longer available. Create it again.')
  try { return { row, plan: parseTaskPlan(JSON.parse(row.plan_json), row.source_kind === 'path' ? { minimumSteps: 1, maximumSteps: 24 } : undefined) } } catch {
    throw new HttpError(503, 'task_runtime_unavailable', 'This Task is not ready yet. Create it again.')
  }
}

export async function createTask(request: Request, env: Env): Promise<Response> {
  const { walletAddress } = await requireWallet(request, env, 'tasks:create')
  const input = await readJson<{ goal?: unknown; workspaceUrl?: unknown; resources?: unknown }>(request)
  const learnerGoal = goal(input.goal)
  const workspaceLink = parseTaskWorkspaceUrl(input.workspaceUrl)
  const resources = parseTaskResources(input.resources)
  await consumeLimit(env, `task-plan-wallet:${walletAddress}`, 4)
  const plan = await createTaskPlan(getGroqConfiguration(env), learnerGoal, fetch, [...(workspaceLink ? [workspaceLink] : []), ...resources])
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const resourcesJson = JSON.stringify(resources)
  await env.DB.prepare(`INSERT INTO learning_tasks (id, wallet_address, goal, title, outcome, plan_json, workspace_url, resources_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`)
    .bind(id, walletAddress, learnerGoal, plan.title, plan.outcome, JSON.stringify(plan), workspaceLink?.url ?? null, resourcesJson, now, now).run()
  return json({ task: taskPayload({ id, goal: learnerGoal, title: plan.title, outcome: plan.outcome, plan_json: JSON.stringify(plan), workspace_url: workspaceLink?.url ?? null, resources_json: resourcesJson, source_kind: 'direct', source_skill_id: null, source_skill_version: null, creator_name: null, status: 'draft', created_at: now, updated_at: now }, plan) }, { status: 201 })
}

export async function updateTaskPlan(taskId: string, request: Request, env: Env): Promise<Response> {
  const { walletAddress } = await requireWallet(request, env, 'tasks:edit')
  const { row } = await loadOwnedTask(env, walletAddress, identifier(taskId, 'Task'))
  if (row.source_kind !== 'direct' || row.status !== 'draft') throw new HttpError(409, 'task_plan_locked', 'Only a personal Task that has not started can be edited.')
  const input = await readJson<{ plan?: unknown; updatedAt?: unknown }>(request, 24_576)
  let plan: TaskPlan
  try { plan = parseTaskPlan(input.plan) } catch { throw new HttpError(400, 'invalid_task_plan', 'Keep 1–8 clear steps, with an instruction and completion check for each.') }
  if (plan.steps.some(step => !step.challenge || !step.rubric.length)) throw new HttpError(400, 'invalid_task_plan', 'Add a practice goal and at least one completion check to each step.')
  if (typeof input.updatedAt !== 'string') throw new HttpError(400, 'invalid_task_plan', 'Reload this Task before editing it.')
  const now = new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString()
  const result = await env.DB.prepare(`UPDATE learning_tasks SET title = ?, outcome = ?, plan_json = ?, updated_at = ?
    WHERE id = ? AND wallet_address = ? AND source_kind = 'direct' AND status = 'draft' AND updated_at = ?
    AND NOT EXISTS (SELECT 1 FROM task_learning_sessions WHERE task_id = learning_tasks.id)`)
    .bind(plan.title, plan.outcome, JSON.stringify(plan), now, taskId, walletAddress, input.updatedAt).run()
  if (result.meta.changes !== 1) throw new HttpError(409, 'task_plan_changed', 'This Task changed or already started. Reload it before editing.')
  return json({ task: taskPayload({ ...row, title: plan.title, outcome: plan.outcome, plan_json: JSON.stringify(plan), updated_at: now }, plan) })
}

export async function listTasks(request: Request, env: Env): Promise<Response> {
  const { walletAddress } = await requireWallet(request, env, 'tasks:read')
  const { results } = await env.DB.prepare(`SELECT learning_tasks.id, learning_tasks.goal, learning_tasks.title,
      learning_tasks.outcome, learning_tasks.plan_json, learning_tasks.workspace_url, learning_tasks.resources_json,
      learning_tasks.source_kind, learning_tasks.source_skill_id, learning_tasks.source_skill_version,
      creators.display_name AS creator_name, learning_tasks.status, learning_tasks.created_at, learning_tasks.updated_at
    FROM learning_tasks LEFT JOIN skills ON skills.id = learning_tasks.source_skill_id
    LEFT JOIN creators ON creators.id = skills.creator_id
    WHERE learning_tasks.wallet_address = ? AND learning_tasks.status <> 'archived'
    ORDER BY learning_tasks.updated_at DESC LIMIT 50`)
    .bind(walletAddress).all<TaskRow>()
  const tasks = results.flatMap((row) => {
    try { return [taskPayload(row, parseTaskPlan(JSON.parse(row.plan_json), row.source_kind === 'path' ? { minimumSteps: 1, maximumSteps: 24 } : undefined))] } catch { return [] }
  })
  return json({ tasks })
}

export async function activateTask(taskId: string, request: Request, env: Env): Promise<Response> {
  const { walletAddress } = await requireWallet(request, env, 'learning:activate')
  const input = await readJson<{ deviceId?: unknown }>(request)
  const deviceId = identifier(input.deviceId, 'deviceId')
  const key = activationKey(request, 'Task')
  const { row, plan } = await loadOwnedTask(env, walletAddress, identifier(taskId, 'taskId'))
  if (row.source_kind === 'path' && row.source_skill_id && row.source_skill_version) {
    await resolveSkillVersion(env, walletAddress, row.source_skill_id, row.source_skill_version)
  }
  const firstStep = plan.steps[0]
  if (!firstStep) throw new HttpError(503, 'task_runtime_unavailable', 'This Task has no steps yet.')

  const device = await env.DB.prepare(`SELECT id FROM devices WHERE id = ? AND wallet_address = ? AND status = 'active' LIMIT 1`)
    .bind(deviceId, walletAddress).first<{ id: string }>()
  if (!device) throw new HttpError(404, 'active_device_not_found', 'Choose an active Mac paired to this wallet.')
  const repeated = await env.DB.prepare(`SELECT device_id, task_id, session_id FROM task_activation_requests WHERE wallet_address = ? AND idempotency_key = ?`)
    .bind(walletAddress, key).first<{ device_id: string; task_id: string; session_id: string }>()
  if (repeated) {
    if (repeated.device_id !== deviceId || repeated.task_id !== taskId) throw new HttpError(409, 'idempotency_key_reused', 'This Task is already opening elsewhere. Refresh and try again.')
    return json({ session: await loadTaskSession(env, repeated.session_id), resumed: true })
  }
  const nextStepId = await firstUnfinishedStep(env, taskId, plan.steps)
  if (!nextStepId) throw new HttpError(409, 'task_completed', 'This Task is complete. Find your saved result in Progress.')
  const existing = await env.DB.prepare(`SELECT id FROM task_learning_sessions WHERE wallet_address = ? AND device_id = ? AND task_id = ? AND status IN ('active', 'paused') ORDER BY started_at DESC LIMIT 1`)
    .bind(walletAddress, deviceId, taskId).first<{ id: string }>()
  const sessionId = existing?.id ?? crypto.randomUUID()
  const now = new Date().toISOString()
  const statements = [
    env.DB.prepare(`UPDATE learning_sessions SET status = 'paused', updated_at = ? WHERE device_id = ? AND status = 'active'`).bind(now, deviceId),
    env.DB.prepare(`UPDATE task_learning_sessions SET status = 'paused', updated_at = ? WHERE (device_id = ? OR task_id = ?) AND status = 'active' AND id <> ?`).bind(now, deviceId, taskId, sessionId),
  ]
  if (existing) statements.push(env.DB.prepare(`UPDATE task_learning_sessions SET status = 'active', current_step = ?, updated_at = ? WHERE id = ? AND wallet_address = ? AND device_id = ?`).bind(nextStepId, now, sessionId, walletAddress, deviceId))
  else statements.push(env.DB.prepare(`INSERT INTO task_learning_sessions (id, wallet_address, device_id, task_id, status, current_step, started_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`).bind(sessionId, walletAddress, deviceId, taskId, nextStepId, now, now))
  statements.push(
    env.DB.prepare(`UPDATE task_learning_sessions SET current_step = COALESCE(${NEXT_TASK_STEP_SQL}, current_step),
      status = CASE WHEN ${NEXT_TASK_STEP_SQL} IS NULL THEN 'completed' ELSE 'active' END,
      completed_at = CASE WHEN ${NEXT_TASK_STEP_SQL} IS NULL THEN ? ELSE NULL END WHERE id = ?`).bind(now, sessionId),
    env.DB.prepare(`UPDATE learning_tasks SET status = (SELECT status FROM task_learning_sessions WHERE id = ?), updated_at = ? WHERE id = ? AND wallet_address = ?`).bind(sessionId, now, taskId, walletAddress),
    env.DB.prepare(`INSERT INTO task_activation_requests (wallet_address, idempotency_key, device_id, task_id, session_id) VALUES (?, ?, ?, ?, ?)`).bind(walletAddress, key, deviceId, taskId, sessionId),
  )
  await env.DB.batch(statements)
  return json({ session: await loadTaskSession(env, sessionId), resumed: Boolean(existing) }, { status: existing ? 200 : 201 })
}
