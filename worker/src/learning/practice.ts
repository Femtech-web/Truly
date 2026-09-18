import { HttpError, json, readJson } from '../http'
import { consumeLimit } from '../rate-limits'
import { authenticateDesktop, type DesktopIdentity } from '../sessions'
import { sha256 } from '../security'
import type { Env } from '../types'
import { assessAttempt, assessmentPassed, parseAssessment, type Assessment } from './assessment'
import { getGroqConfiguration } from './groq'
import { MAX_AI_REQUEST_BYTES, parseLearningTurn } from './protocol'
import { activationKey, loadSessionByIdentity, type SessionPayload } from './sessions'
import { acquireLease, dailyLimit } from './turn'
import { progressScope, sessionSteps } from './progress-state'

interface AttemptReceipt {
  id: string; session_id: string; step_id: string; request_hash: string; decision: 'passed' | 'not_passed'
}

/** All statements run inside one D1 batch transaction. The SELECT guards the live
 * credential AND expected session/step at commit time, after potentially slow AI.
 * Neither the desktop nor the model supplies a progress counter or next step. */
export async function commitAssessment(env: Env, identity: DesktopIdentity, tokenHash: string,
  session: SessionPayload, assessment: Assessment, key: string, requestHash: string): Promise<AttemptReceipt> {
  const steps = await sessionSteps(env, session, identity.walletAddress)
  const index = steps.findIndex(step => step.id === session.currentStep.id)
  if (index < 0) throw new HttpError(409, 'learning_context_changed', 'This Task changed. Open it again before checking your work.')
  assessment = parseAssessment(assessment, session.currentStep.rubric.length)
  const passed = assessmentPassed(assessment)
  const next = passed ? steps[index + 1] : null
  const finished = passed && !next
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const table = session.source.taskId ? 'task_learning_sessions' : 'learning_sessions'
  const criteria = JSON.stringify(assessment.criteria.map(({ index, status }) => ({ index, status })))
  const statements = [env.DB.prepare(`INSERT OR IGNORE INTO practice_attempts
    (id, device_id, wallet_address, session_id, scope_id, step_id, idempotency_key, request_hash, decision, criteria_json, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (
      SELECT 1 FROM ${table} s JOIN devices d ON d.id = s.device_id
      JOIN desktop_sessions credential ON credential.device_id = d.id
      WHERE s.id = ? AND s.device_id = ? AND s.wallet_address = ? AND s.status = 'active' AND s.current_step = ?
        AND d.status = 'active' AND credential.token_hash = ? AND credential.revoked_at IS NULL AND credential.expires_at > ?
        AND (? = 'task' OR EXISTS (
          SELECT 1 FROM skills path JOIN skill_versions version ON version.skill_id = path.id
          WHERE path.id = ? AND version.version = ? AND path.status = 'published' AND version.review_status = 'approved'
            AND (version.access_kind = 'free'
              OR EXISTS (SELECT 1 FROM entitlements WHERE skill_id = path.id AND wallet_address = s.wallet_address))
        ))
    )`).bind(id, identity.deviceId, identity.walletAddress, session.id, progressScope(session), session.currentStep.id,
      key, requestHash, passed ? 'passed' : 'not_passed', criteria, now,
      session.id, identity.deviceId, identity.walletAddress, session.currentStep.id, tokenHash, now,
      session.source.kind, session.source.id, session.source.version ?? 0)]
  if (passed) {
    statements.push(env.DB.prepare(`UPDATE ${table} SET current_step = ?, status = ?, updated_at = ?, completed_at = ?
      WHERE id = ? AND current_step = ? AND status = 'active'
        AND EXISTS (SELECT 1 FROM practice_attempts WHERE id = ? AND decision = 'passed')`)
      .bind(next?.id ?? session.currentStep.id, finished ? 'completed' : 'active', now, finished ? now : null,
        session.id, session.currentStep.id, id))
    if (session.source.taskId) statements.push(env.DB.prepare(`UPDATE learning_tasks SET status = ?, updated_at = ?
      WHERE id = ? AND wallet_address = ? AND EXISTS (SELECT 1 FROM practice_attempts WHERE id = ? AND decision = 'passed')`)
      .bind(finished ? 'completed' : 'active', now, session.source.taskId, identity.walletAddress, id))
  }
  await env.DB.batch(statements)
  const receipt = await env.DB.prepare(`SELECT id, session_id, step_id, request_hash, decision FROM practice_attempts WHERE device_id = ? AND idempotency_key = ?`)
    .bind(identity.deviceId, key).first<AttemptReceipt>()
  if (!receipt) throw new HttpError(409, 'learning_context_changed', 'This Task changed or this Mac lost access. Refresh before checking again.')
  if (receipt.request_hash !== requestHash) throw new HttpError(409, 'idempotency_key_reused', 'This check already belongs to another attempt. Check again from Truly.')
  return receipt
}

export async function createPracticeAttempt(request: Request, env: Env): Promise<Response> {
  const identity = await authenticateDesktop(request, env)
  const input = parseLearningTurn(await readJson<unknown>(request, MAX_AI_REQUEST_BYTES))
  const key = activationKey(request, 'practice attempt')
  const requestHash = await sha256(JSON.stringify(input))
  const prior = await env.DB.prepare(`SELECT id, session_id, step_id, request_hash, decision FROM practice_attempts WHERE device_id = ? AND idempotency_key = ?`)
    .bind(identity.deviceId, key).first<AttemptReceipt>()
  if (prior) {
    if (prior.request_hash !== requestHash) throw new HttpError(409, 'idempotency_key_reused', 'This check belongs to a different attempt. Check your work again.')
    const session = await loadSessionByIdentity(env, prior.session_id, identity.walletAddress, identity.deviceId)
    return json({ attemptId: prior.id, passed: prior.decision === 'passed', replayed: true,
      feedback: prior.decision === 'passed' ? 'This step was already AI-checked. Your progress is saved.' : 'This attempt did not pass. Share your updated work to try again.', session })
  }
  const session = await loadSessionByIdentity(env, input.learningSessionId, identity.walletAddress, identity.deviceId)
  if (session.status !== 'active' || session.currentStep.id !== input.stepId) throw new HttpError(409, 'learning_context_changed', 'Your current step changed. Reopen the Task before checking your work.')
  if (!session.currentStep.rubric.length || !session.currentStep.challenge) throw new HttpError(409, 'practice_not_available', 'This step does not have a practice check yet. You can still ask Truly for help.')
  const configuration = getGroqConfiguration(env)
  await consumeLimit(env, `ai-device:${identity.deviceId}`, 6)
  await consumeLimit(env, 'ai-project-daily', dailyLimit(env), Date.now(), 86_400_000, 'Truly has reached today’s free learning limit. Try again tomorrow.')
  const lease = await acquireLease(env, identity.deviceId)
  try {
    const assessment = await assessAttempt(configuration, input, session)
    const tokenHash = await sha256(request.headers.get('authorization')!.slice(7))
    const receipt = await commitAssessment(env, identity, tokenHash, session, assessment, key, requestHash)
    const updated = await loadSessionByIdentity(env, session.id, identity.walletAddress, identity.deviceId)
    return json({ attemptId: receipt.id, passed: receipt.decision === 'passed', replayed: false, feedback: assessment.feedback, criteria: assessment.criteria, session: updated })
  } finally { await env.DB.prepare('DELETE FROM ai_request_leases WHERE id = ?').bind(lease).run() }
}
