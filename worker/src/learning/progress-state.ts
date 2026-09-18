import { HttpError } from '../http'
import type { Env } from '../types'
import type { SessionPayload } from './sessions'
import { resolveSkillVersion } from './access'
import { parseTaskPlan } from './task-plan'

export function progressScope(session: SessionPayload): string {
  return session.source.taskId ? `task:${session.source.taskId}` : `path-session:${session.id}`
}

export async function completedSteps(env: Env, scope: string): Promise<string[]> {
  const { results } = await env.DB.prepare(`SELECT step_id FROM practice_attempts WHERE scope_id = ? AND decision = 'passed' ORDER BY created_at`)
    .bind(scope).all<{ step_id: string }>()
  return results.map(row => row.step_id)
}

export async function withProgress(env: Env, session: SessionPayload): Promise<SessionPayload> {
  const ids = await completedSteps(env, progressScope(session))
  return { ...session, progress: { completedStepIds: ids, completedCount: ids.length,
    total: session.source.stepCount, assessment: 'ai_checked' } }
}

export async function sessionSteps(env: Env, session: SessionPayload, wallet: string): Promise<Array<{ id: string }>> {
  if (session.source.kind === 'path' && session.source.version) {
    return (await resolveSkillVersion(env, wallet, session.source.id, session.source.version)).steps
  }
  const row = await env.DB.prepare('SELECT plan_json FROM learning_tasks WHERE id = ? AND wallet_address = ?')
    .bind(session.source.taskId, wallet).first<{ plan_json: string }>()
  if (!row) throw new HttpError(404, 'task_not_found', 'This Task is no longer available.')
  return parseTaskPlan(JSON.parse(row.plan_json)).steps
}

export async function firstUnfinishedStep(env: Env, taskId: string, steps: Array<{ id: string }>): Promise<string | null> {
  const completed = new Set(await completedSteps(env, `task:${taskId}`))
  return steps.find(step => !completed.has(step.id))?.id ?? null
}

// Correlated with task_learning_sessions.task_id inside the activation transaction.
// Recompute here, not only before the batch: a check may finish during handoff.
export const NEXT_TASK_STEP_SQL = `(SELECT json_extract(step.value, '$.id')
  FROM learning_tasks task, json_each(task.plan_json, '$.steps') step
  WHERE task.id = task_learning_sessions.task_id AND NOT EXISTS (
    SELECT 1 FROM practice_attempts passed WHERE passed.scope_id = 'task:' || task.id
      AND passed.step_id = json_extract(step.value, '$.id') AND passed.decision = 'passed'
  ) ORDER BY CAST(step.key AS INTEGER) LIMIT 1)`
