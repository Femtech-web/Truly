import { HttpError, json, readJson } from '../http'
import { consumeLimit } from '../rate-limits'
import { authenticateDesktop } from '../sessions'
import type { Env } from '../types'
import type { LearningContext } from './access'
import { askGroq, getGroqConfiguration } from './groq'
import { MAX_AI_REQUEST_BYTES, parseLearningTurn } from './protocol'
import { loadSessionByIdentity } from './sessions'

function dailyLimit(env: Env): number {
  const configured = Number.parseInt(env.AI_DAILY_LIMIT ?? '100', 10)
  return Number.isSafeInteger(configured) && configured >= 1 && configured <= 1_000 ? configured : 100
}

async function acquireLease(env: Env, deviceId: string): Promise<string> {
  const now = Date.now()
  await env.DB.prepare('DELETE FROM ai_request_leases WHERE expires_at <= ?').bind(now).run()
  const id = crypto.randomUUID()
  const result = await env.DB.prepare(
    `INSERT INTO ai_request_leases (id, device_id, expires_at)
     SELECT ?, ?, ? WHERE
       (SELECT COUNT(*) FROM ai_request_leases WHERE expires_at > ?) < 2 AND
       (SELECT COUNT(*) FROM ai_request_leases WHERE device_id = ? AND expires_at > ?) < 1`,
  ).bind(id, deviceId, now + 25_000, now, deviceId, now).run()
  if (!result.meta.changes) throw new HttpError(429, 'ai_concurrency_limited', 'Another Truly request is still running. Wait for it to finish.')
  return id
}

export async function createLearningTurn(request: Request, env: Env): Promise<Response> {
  const identity = await authenticateDesktop(request, env)
  const configuration = getGroqConfiguration(env)
  const input = parseLearningTurn(await readJson<unknown>(request, MAX_AI_REQUEST_BYTES))
  const session = await loadSessionByIdentity(env, input.learningSessionId, identity.walletAddress, identity.deviceId)
  if (session.status !== 'active' || session.currentStep.id !== input.stepId) {
    throw new HttpError(409, 'learning_context_changed', 'This Task changed. Reopen Truly and try again.')
  }
  const context: LearningContext = {
    id: session.source.id,
    slug: session.source.id,
    title: session.source.title,
    summary: session.source.summary,
    creatorName: session.source.creatorName ?? 'You',
    outcomes: session.source.outcomes,
    prerequisites: session.source.prerequisites,
    supportedEnvironments: session.source.supportedEnvironments,
    estimatedMinutes: session.source.estimatedMinutes,
    steps: [session.currentStep],
    step: session.currentStep,
  }

  await consumeLimit(env, `ai-device:${identity.deviceId}`, 6)
  await consumeLimit(
    env,
    'ai-project-daily',
    dailyLimit(env),
    Date.now(),
    86_400_000,
    'Truly has reached today’s free learning limit. Try again tomorrow.',
  )

  const lease = await acquireLease(env, identity.deviceId)
  try {
    const output = await askGroq(configuration, input, context)
    return json({
      turnId: crypto.randomUUID(),
      learningSessionId: input.learningSessionId,
      stepId: input.stepId,
      mode: input.mode,
      ...output,
      progressRecorded: false,
    })
  } finally {
    await env.DB.prepare('DELETE FROM ai_request_leases WHERE id = ?').bind(lease).run()
  }
}
