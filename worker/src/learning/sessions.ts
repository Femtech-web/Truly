import { requireWallet } from '../device-management'
import { HttpError, json, readJson } from '../http'
import { authenticateDesktop } from '../sessions'
import type { Env } from '../types'
import { parseManifest, resolveSkillVersion, type SkillManifest } from './access'
import { parseTaskPlan } from './task-plan'
import { parseStoredResources, type LearningLink } from './resources'

interface ActivationBody { deviceId?: string; skillId?: string; skillVersion?: number }

interface PathSessionRow {
  id: string; wallet_address: string; device_id: string; device_name: string
  skill_id: string; skill_slug: string; skill_title: string; skill_summary: string
  creator_name: string; skill_version: number; current_step: string | null
  status: 'active' | 'paused' | 'completed'; started_at: string; updated_at: string | null
  manifest_json: string
}

interface TaskSessionRow {
  id: string; wallet_address: string; device_id: string; device_name: string; task_id: string
  task_title: string; task_goal: string; task_outcome: string; plan_json: string
  workspace_url: string | null; resources_json: string; current_step: string
  source_kind: 'direct' | 'path'; source_skill_id: string | null; source_skill_version: number | null
  source_path_title: string | null; source_path_summary: string | null; creator_name: string | null
  manifest_json: string | null
  status: 'active' | 'paused' | 'completed'; started_at: string; updated_at: string | null
}

export interface SessionPayload {
  id: string
  status: 'active' | 'paused' | 'completed'
  device: { id: string; name: string }
  source: {
    kind: 'path' | 'task'; id: string; taskId: string | null; title: string; summary: string; creatorName: string | null
    version: number | null; outcomes: string[]; prerequisites: string[]
    supportedEnvironments: string[]; estimatedMinutes: number | null; stepCount: number
    workspaceLink: LearningLink | null; resources: LearningLink[]
  }
  currentStep: {
    id: string; title: string; summary: string; index: number; total: number
    workspaceLink: LearningLink | null; resources: LearningLink[]; challenge: string | null; rubric: string[]
  }
  startedAt: string
  updatedAt: string
}

function identifier(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > 96 || !/^[A-Za-z0-9_-]+$/.test(text)) {
    throw new HttpError(400, 'invalid_learning_activation', `${field} is invalid.`)
  }
  return text
}

function parseActivation(body: ActivationBody) {
  if (!Number.isSafeInteger(body.skillVersion) || Number(body.skillVersion) < 1) {
    throw new HttpError(400, 'invalid_learning_activation', 'This Path could not be started. Refresh and try again.')
  }
  return { deviceId: identifier(body.deviceId, 'deviceId'), skillId: identifier(body.skillId, 'skillId'), skillVersion: Number(body.skillVersion) }
}

export function activationKey(request: Request, label = 'Path'): string {
  const key = request.headers.get('idempotency-key')?.trim() ?? ''
  if (!key || key.length > 100 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    throw new HttpError(400, 'idempotency_key_required', `Start this ${label} again from the Truly Mini App.`)
  }
  return key
}

function pathPayload(row: PathSessionRow, manifest: SkillManifest): SessionPayload {
  const currentIndex = Math.max(0, manifest.steps.findIndex((step) => step.id === row.current_step))
  const currentStep = manifest.steps[currentIndex] ?? manifest.steps[0]
  if (!currentStep) throw new HttpError(503, 'skill_runtime_unavailable', 'The guided steps for this Path are not ready yet.')
  return {
    id: row.id, status: row.status, device: { id: row.device_id, name: row.device_name },
    source: { kind: 'path', id: row.skill_id, taskId: null, title: row.skill_title, summary: row.skill_summary,
      creatorName: row.creator_name, version: row.skill_version, outcomes: manifest.outcomes,
      prerequisites: manifest.prerequisites, supportedEnvironments: manifest.supportedEnvironments,
      estimatedMinutes: manifest.estimatedMinutes, stepCount: manifest.steps.length,
      workspaceLink: null, resources: [] },
    currentStep: { ...currentStep, index: currentIndex + 1, total: manifest.steps.length },
    startedAt: row.started_at, updatedAt: row.updated_at ?? row.started_at,
  }
}

function taskPayload(row: TaskSessionRow): SessionPayload {
  if (row.source_kind === 'path' && row.source_skill_id && row.source_skill_version && row.manifest_json) {
    const manifest = parseManifest(row.manifest_json)
    const currentIndex = Math.max(0, manifest.steps.findIndex((step) => step.id === row.current_step))
    const currentStep = manifest.steps[currentIndex] ?? manifest.steps[0]
    if (!currentStep) throw new HttpError(503, 'skill_runtime_unavailable', 'The guided steps for this Path are not ready yet.')
    return {
      id: row.id, status: row.status, device: { id: row.device_id, name: row.device_name },
      source: { kind: 'path', id: row.source_skill_id, taskId: row.task_id,
        title: row.source_path_title ?? row.task_title, summary: row.source_path_summary ?? row.task_goal,
        creatorName: row.creator_name, version: row.source_skill_version, outcomes: manifest.outcomes,
        prerequisites: manifest.prerequisites, supportedEnvironments: manifest.supportedEnvironments,
        estimatedMinutes: manifest.estimatedMinutes, stepCount: manifest.steps.length,
        workspaceLink: null, resources: [] },
      currentStep: { ...currentStep, index: currentIndex + 1, total: manifest.steps.length },
      startedAt: row.started_at, updatedAt: row.updated_at ?? row.started_at,
    }
  }
  let plan
  try { plan = parseTaskPlan(JSON.parse(row.plan_json)) } catch {
    throw new HttpError(503, 'task_runtime_unavailable', 'This Task is not ready on Mac yet. Reopen it and try again.')
  }
  const currentIndex = Math.max(0, plan.steps.findIndex((step) => step.id === row.current_step))
  const currentStep = plan.steps[currentIndex] ?? plan.steps[0]
  if (!currentStep) throw new HttpError(503, 'task_runtime_unavailable', 'This Task has no steps yet.')
  return {
    id: row.id, status: row.status, device: { id: row.device_id, name: row.device_name },
    source: { kind: 'task', id: row.task_id, taskId: row.task_id, title: row.task_title, summary: row.task_goal,
      creatorName: null, version: null, outcomes: [row.task_outcome], prerequisites: [],
      supportedEnvironments: ['Mac'], estimatedMinutes: null, stepCount: plan.steps.length,
      workspaceLink: row.workspace_url ? { title: 'Starting point', url: row.workspace_url } : null,
      resources: parseStoredResources(row.resources_json) },
    currentStep: { ...currentStep, index: currentIndex + 1, total: plan.steps.length,
      workspaceLink: null, resources: [], challenge: null, rubric: [] },
    startedAt: row.started_at, updatedAt: row.updated_at ?? row.started_at,
  }
}

export async function loadPathSession(env: Env, sessionId: string): Promise<SessionPayload> {
  const row = await env.DB.prepare(
    `SELECT learning_sessions.id, learning_sessions.wallet_address, learning_sessions.device_id,
            devices.name AS device_name, learning_sessions.skill_id, skills.slug AS skill_slug,
            skills.title AS skill_title, skills.summary AS skill_summary,
            creators.display_name AS creator_name, learning_sessions.skill_version,
            learning_sessions.current_step, learning_sessions.status, learning_sessions.started_at,
            learning_sessions.updated_at, skill_versions.manifest_json
     FROM learning_sessions JOIN devices ON devices.id = learning_sessions.device_id
     JOIN skills ON skills.id = learning_sessions.skill_id JOIN creators ON creators.id = skills.creator_id
     JOIN skill_versions ON skill_versions.skill_id = learning_sessions.skill_id AND skill_versions.version = learning_sessions.skill_version
     WHERE learning_sessions.id = ? LIMIT 1`,
  ).bind(sessionId).first<PathSessionRow>()
  if (!row) throw new HttpError(404, 'learning_session_not_found', 'Truly could not find this learning session. Start the Path again.')
  return pathPayload(row, parseManifest(row.manifest_json))
}

export async function loadTaskSession(env: Env, sessionId: string): Promise<SessionPayload> {
  const row = await env.DB.prepare(
    `SELECT task_learning_sessions.id, task_learning_sessions.wallet_address, task_learning_sessions.device_id,
            devices.name AS device_name, task_learning_sessions.task_id, learning_tasks.title AS task_title,
            learning_tasks.goal AS task_goal, learning_tasks.outcome AS task_outcome, learning_tasks.plan_json,
            learning_tasks.workspace_url, learning_tasks.resources_json,
            learning_tasks.source_kind, learning_tasks.source_skill_id, learning_tasks.source_skill_version,
            skills.title AS source_path_title, skills.summary AS source_path_summary,
            creators.display_name AS creator_name, skill_versions.manifest_json,
            task_learning_sessions.current_step, task_learning_sessions.status, task_learning_sessions.started_at,
            task_learning_sessions.updated_at
     FROM task_learning_sessions JOIN devices ON devices.id = task_learning_sessions.device_id
     JOIN learning_tasks ON learning_tasks.id = task_learning_sessions.task_id
     LEFT JOIN skills ON skills.id = learning_tasks.source_skill_id
     LEFT JOIN creators ON creators.id = skills.creator_id
     LEFT JOIN skill_versions ON skill_versions.skill_id = learning_tasks.source_skill_id
       AND skill_versions.version = learning_tasks.source_skill_version
     WHERE task_learning_sessions.id = ? LIMIT 1`,
  ).bind(sessionId).first<TaskSessionRow>()
  if (!row) throw new HttpError(404, 'learning_session_not_found', 'Truly could not find this learning session. Start the Task again.')
  return taskPayload(row)
}

export async function loadSessionByIdentity(env: Env, sessionId: string, walletAddress: string, deviceId: string): Promise<SessionPayload> {
  const task = await env.DB.prepare('SELECT id FROM task_learning_sessions WHERE id = ? AND wallet_address = ? AND device_id = ? LIMIT 1')
    .bind(sessionId, walletAddress, deviceId).first<{ id: string }>()
  if (task) {
    const session = await loadTaskSession(env, task.id)
    if (session.source.kind === 'path' && session.source.version) {
      await resolveSkillVersion(env, walletAddress, session.source.id, session.source.version)
    }
    return session
  }
  const path = await env.DB.prepare('SELECT id FROM learning_sessions WHERE id = ? AND wallet_address = ? AND device_id = ? LIMIT 1')
    .bind(sessionId, walletAddress, deviceId).first<{ id: string }>()
  if (path) {
    const session = await loadPathSession(env, path.id)
    if (session.source.version) await resolveSkillVersion(env, walletAddress, session.source.id, session.source.version)
    return session
  }
  throw new HttpError(404, 'learning_session_not_found', 'This learning session is no longer active on this Mac.')
}

export async function activateLearningSession(request: Request, env: Env): Promise<Response> {
  const { walletAddress } = await requireWallet(request, env, 'learning:activate')
  const input = parseActivation(await readJson<ActivationBody>(request))
  const key = activationKey(request)
  const device = await env.DB.prepare(`SELECT id FROM devices WHERE id = ? AND wallet_address = ? AND status = 'active' LIMIT 1`)
    .bind(input.deviceId, walletAddress).first<{ id: string }>()
  if (!device) throw new HttpError(404, 'active_device_not_found', 'Choose an active Mac paired to this wallet.')
  const runtime = await resolveSkillVersion(env, walletAddress, input.skillId, input.skillVersion)

  const candidateTaskId = crypto.randomUUID()
  const now = new Date().toISOString()
  const plan = { title: runtime.title, outcome: runtime.outcomes[0] ?? runtime.summary,
    steps: runtime.steps.map(({ id, title, summary }) => ({ id, title, summary })) }
  await env.DB.prepare(`INSERT OR IGNORE INTO learning_tasks
      (id, wallet_address, goal, title, outcome, plan_json, workspace_url, resources_json,
       source_kind, source_skill_id, source_skill_version, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'path', ?, ?, 'draft', ?, ?)`)
    .bind(candidateTaskId, walletAddress, `Complete ${runtime.title}`, runtime.title, plan.outcome,
      JSON.stringify(plan), runtime.step.workspaceLink?.url ?? null, JSON.stringify(runtime.step.resources),
      input.skillId, input.skillVersion, now, now).run()
  const pathTask = await env.DB.prepare(`SELECT id FROM learning_tasks
    WHERE wallet_address = ? AND source_kind = 'path' AND source_skill_id = ? AND source_skill_version = ? LIMIT 1`)
    .bind(walletAddress, input.skillId, input.skillVersion).first<{ id: string }>()
  if (!pathTask) throw new HttpError(503, 'task_runtime_unavailable', 'This Path could not prepare your Task. Try again.')

  const repeated = await env.DB.prepare(`SELECT device_id, task_id, session_id FROM task_activation_requests WHERE wallet_address = ? AND idempotency_key = ?`)
    .bind(walletAddress, key).first<{ device_id: string; task_id: string; session_id: string }>()
  if (repeated) {
    if (repeated.device_id !== input.deviceId || repeated.task_id !== pathTask.id) {
      throw new HttpError(409, 'idempotency_key_reused', 'This Path is already opening elsewhere. Refresh and try again.')
    }
    return json({ session: await loadTaskSession(env, repeated.session_id), resumed: true })
  }

  const existing = await env.DB.prepare(`SELECT id FROM task_learning_sessions
    WHERE wallet_address = ? AND device_id = ? AND task_id = ? AND status IN ('active', 'paused')
    ORDER BY started_at DESC LIMIT 1`)
    .bind(walletAddress, input.deviceId, pathTask.id).first<{ id: string }>()
  const sessionId = existing?.id ?? crypto.randomUUID()
  const statements = [
    env.DB.prepare(`UPDATE learning_sessions SET status = 'paused', updated_at = ? WHERE device_id = ? AND status = 'active'`).bind(now, input.deviceId),
    env.DB.prepare(`UPDATE task_learning_sessions SET status = 'paused', updated_at = ? WHERE device_id = ? AND status = 'active' AND id <> ?`).bind(now, input.deviceId, sessionId),
  ]
  if (existing) statements.push(env.DB.prepare(`UPDATE task_learning_sessions SET status = 'active', current_step = COALESCE(current_step, ?), updated_at = ? WHERE id = ? AND wallet_address = ? AND device_id = ?`).bind(runtime.step.id, now, sessionId, walletAddress, input.deviceId))
  else statements.push(env.DB.prepare(`INSERT INTO task_learning_sessions (id, wallet_address, device_id, task_id, status, current_step, started_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`).bind(sessionId, walletAddress, input.deviceId, pathTask.id, runtime.step.id, now, now))
  statements.push(
    env.DB.prepare(`UPDATE learning_tasks SET status = 'active', updated_at = ? WHERE id = ? AND wallet_address = ?`).bind(now, pathTask.id, walletAddress),
    env.DB.prepare(`INSERT INTO task_activation_requests (wallet_address, idempotency_key, device_id, task_id, session_id) VALUES (?, ?, ?, ?, ?)`).bind(walletAddress, key, input.deviceId, pathTask.id, sessionId),
  )
  await env.DB.batch(statements)
  return json({ session: await loadTaskSession(env, sessionId), resumed: Boolean(existing) }, { status: existing ? 200 : 201 })
}

export async function listWalletLearningSessions(request: Request, env: Env): Promise<Response> {
  const { walletAddress } = await requireWallet(request, env, 'learning:read')
  const [paths, tasks] = await Promise.all([
    env.DB.prepare(`SELECT id FROM learning_sessions WHERE wallet_address = ? AND status IN ('active', 'paused') ORDER BY updated_at DESC LIMIT 20`).bind(walletAddress).all<{ id: string }>(),
    env.DB.prepare(`SELECT id FROM task_learning_sessions WHERE wallet_address = ? AND status IN ('active', 'paused') ORDER BY updated_at DESC LIMIT 20`).bind(walletAddress).all<{ id: string }>(),
  ])
  const sessions = await Promise.all([
    ...paths.results.map((row) => loadPathSession(env, row.id)),
    ...tasks.results.map((row) => loadTaskSession(env, row.id)),
  ])
  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return json({ sessions: sessions.slice(0, 20) })
}

export async function getDesktopLearningSession(request: Request, env: Env): Promise<Response> {
  const identity = await authenticateDesktop(request, env)
  const task = await env.DB.prepare(`SELECT id FROM task_learning_sessions WHERE device_id = ? AND wallet_address = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1`)
    .bind(identity.deviceId, identity.walletAddress).first<{ id: string }>()
  if (task) return json({ session: await loadTaskSession(env, task.id) })
  const path = await env.DB.prepare(`SELECT id FROM learning_sessions WHERE device_id = ? AND wallet_address = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1`)
    .bind(identity.deviceId, identity.walletAddress).first<{ id: string }>()
  return json({ session: path ? await loadPathSession(env, path.id) : null })
}
