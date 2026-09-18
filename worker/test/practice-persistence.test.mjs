import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDatabase } from './helpers/sqlite-d1.mjs'
import { commitAssessment, createPracticeAttempt } from '../src/learning/practice'
import { loadSessionByIdentity, listWalletLearningSessions } from '../src/learning/sessions'
import { firstUnfinishedStep } from '../src/learning/progress-state'
import { activateTask } from '../src/learning/tasks'
import { activateLearningSession, getDesktopLearningSession } from '../src/learning/sessions'
import { createLearningTurn } from '../src/learning/turn'
import { sha256 } from '../src/security'

const steps = [
  { id: 'one', title: 'Write an explanation', summary: 'Explain the privacy model.', challenge: 'Write your own comparison.', rubric: ['A clear comparison is visible.'] },
  { id: 'two', title: 'Apply the concept', summary: 'Show one safe example.', challenge: 'Show your own example.', rubric: ['A safe example is visible.'] },
]
const identity = { deviceId: 'mac', deviceName: 'My Mac', walletAddress: 'NQ00', expiresAt: '2099-01-01' }
const good = { feedback: 'Your own comparison is visible.', criteria: [{ index: 0, status: 'met', confidence: .95, evidence: 'A comparison in the learner editor is visible.' }] }
let db, env, tokenHash

beforeEach(async () => {
  db = createTestDatabase()
  env = { DB: db.DB, GROQ_DATA_CONTROLS_CONFIRMED: 'true', AI_PROVIDER: 'groq', GROQ_API_KEY: 'test-only', GROQ_MODEL: 'test-only' }
  tokenHash = await sha256('test-token')
  db.sqlite.prepare('INSERT INTO wallet_accounts(nimiq_address) VALUES (?)').run('NQ00')
  db.sqlite.prepare(`INSERT INTO devices(id, wallet_address, name, platform, install_id, status) VALUES ('mac','NQ00','My Mac','macOS','local-mac','active')`).run()
  db.sqlite.prepare(`INSERT INTO desktop_sessions(id, device_id, token_hash, expires_at) VALUES ('credential','mac',?,'2099-01-01T00:00:00.000Z')`).run(tokenHash)
  db.sqlite.prepare(`INSERT INTO learning_tasks(id, wallet_address, goal, title, outcome, plan_json, status) VALUES ('task','NQ00','Learn privacy','Privacy Task','Explain it',?,'active')`).run(JSON.stringify({ title: 'Privacy Task', outcome: 'Explain it', steps }))
  db.sqlite.prepare(`INSERT INTO task_learning_sessions(id, wallet_address, device_id, task_id, status, current_step) VALUES ('session','NQ00','mac','task','active','one')`).run()
})
afterEach(() => { vi.restoreAllMocks(); db?.sqlite.close() })
const load = () => loadSessionByIdentity(env, 'session', 'NQ00', 'mac')
const commit = (session, assessment = good, key = 'attempt-1', hash = 'frame-hash') => commitAssessment(env, identity, tokenHash, session, assessment, key, hash)
const request = (stepId = 'one', key = 'attempt-1') => new Request('https://core.test/v1/learning/attempts', { method: 'POST', headers: {
  authorization: 'Bearer test-token', 'content-type': 'application/json', 'idempotency-key': key,
}, body: JSON.stringify({ learningSessionId: 'session', stepId, mode: 'guide', question: 'Check my work.',
  frame: { mimeType: 'image/jpeg', base64: '/9j/' }, consent: { processor: 'groq', revision: 'groq-learning-v2', approved: true } }) })

describe('transactional practice progress', () => {
  it('does not advance failed or unclear work', async () => {
    const initial = await load()
    await commit(initial, { ...good, criteria: [{ ...good.criteria[0], status: 'unclear' }] })
    const updated = await load()
    expect(updated.currentStep.id).toBe('one')
    expect(updated.progress.completedCount).toBe(0)
    expect(db.sqlite.prepare('SELECT criteria_json FROM practice_attempts').get().criteria_json).not.toContain('comparison')
  })
  it('advances once, replays the receipt and rejects changed keys or stale steps', async () => {
    const initial = await load()
    const receipt = await commit(initial)
    expect((await load()).currentStep.id).toBe('two')
    expect((await load()).progress.completedCount).toBe(1)
    expect((await commit(initial)).id).toBe(receipt.id)
    await expect(commit(initial, good, 'attempt-1', 'different-frame')).rejects.toMatchObject({ status: 409 })
    await expect(commit(initial, good, 'attempt-2')).rejects.toMatchObject({ status: 409 })
    expect((await load()).progress.completedCount).toBe(1)
    expect(await firstUnfinishedStep(env, 'task', steps)).toBe('two')
  })
  it('durably completes the last step and Task without a completion button', async () => {
    await commit(await load())
    await commit(await load(), good, 'attempt-2')
    const persisted = await load()
    expect(persisted.status).toBe('completed')
    expect(persisted.progress.completedStepIds).toEqual(['one', 'two'])
    expect(db.sqlite.prepare(`SELECT status FROM learning_tasks WHERE id='task'`).get().status).toBe('completed')
    expect(await firstUnfinishedStep(env, 'task', steps)).toBeNull()
  })
  it.each(['device', 'credential', 'expired', 'paused', 'foreign'])('rejects %s authority changes before commit', async kind => {
    const initial = await load()
    if (kind === 'device') db.sqlite.exec(`UPDATE devices SET status='revoked' WHERE id='mac'`)
    if (kind === 'credential') db.sqlite.exec(`UPDATE desktop_sessions SET revoked_at='2026-01-01'`)
    if (kind === 'expired') db.sqlite.exec(`UPDATE desktop_sessions SET expires_at='2000-01-01'`)
    if (kind === 'paused') db.sqlite.exec(`UPDATE task_learning_sessions SET status='paused'`)
    const owner = kind === 'foreign' ? { ...identity, walletAddress: 'NQ99' } : identity
    await expect(commitAssessment(env, owner, tokenHash, initial, good, 'attempt', 'hash')).rejects.toMatchObject({ status: kind === 'foreign' ? 404 : 409 })
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM practice_attempts').get().n).toBe(0)
  })
  it('rolls the receipt back when a state write fails', async () => {
    db.sqlite.exec(`CREATE TRIGGER fail_progress BEFORE UPDATE ON task_learning_sessions BEGIN SELECT RAISE(ABORT, 'test failure'); END`)
    await expect(commit(await load())).rejects.toThrow('test failure')
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM practice_attempts').get().n).toBe(0)
    expect((await load()).currentStep.id).toBe('one')
  })
  it('uses the real assessment endpoint and recovers a lost response without calling AI twice', async () => {
    const upstream = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(good) } }] })))
    const first = await (await createPracticeAttempt(request(), env)).json()
    expect(first.passed).toBe(true)
    expect(first.session.currentStep.id).toBe('two')
    const replay = await (await createPracticeAttempt(request(), env)).json()
    expect(replay.replayed).toBe(true)
    expect(replay.attemptId).toBe(first.attemptId)
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM ai_request_leases').get().n).toBe(0)
  })
  it('leaves no receipt or progress after upstream failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }))
    await expect(createPracticeAttempt(request(), env)).rejects.toMatchObject({ status: 502 })
    expect((await load()).progress.completedCount).toBe(0)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM practice_attempts').get().n).toBe(0)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM ai_request_leases').get().n).toBe(0)
  })
  it('keeps Explain/Guide teaching powerless even when the model claims completion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      explanation: 'The code is visible.', nextAction: 'Inspect it.', clarification: null, target: null, evidence: null, completed: true,
    }) } }] })))
    const answer = await (await createLearningTurn(request(), env)).json()
    expect(answer.progressRecorded).toBe(false)
    expect((await load()).progress.completedCount).toBe(0)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM practice_attempts').get().n).toBe(0)
  })
  it('lists completed progress only with an owner-scoped grant and restores it on desktop', async () => {
    await commit(await load()); await commit(await load(), good, 'attempt-2')
    db.sqlite.prepare(`INSERT INTO wallet_sessions(id, wallet_address, token_hash, expires_at, scopes) VALUES ('owner','NQ00',?,'2099-01-01','learning:read')`).run(await sha256('wallet-token'))
    const result = await (await listWalletLearningSessions(new Request('https://core.test/v1/learning/sessions', { headers: { authorization: 'Bearer wallet-token' } }), env)).json()
    expect(result.sessions[0].status).toBe('completed')
    expect(result.sessions[0].progress.completedCount).toBe(2)
    const desktop = await (await getDesktopLearningSession(request(), env)).json()
    expect(desktop.session.status).toBe('completed')
    await expect(listWalletLearningSessions(new Request('https://core.test/v1/learning/sessions'), env)).rejects.toMatchObject({ status: 401 })
  })
  it('moves a Task to another Mac at its saved next step, never restarting progress', async () => {
    await commit(await load())
    db.sqlite.exec(`INSERT INTO devices(id,wallet_address,install_id,name,platform,status) VALUES ('mac-2','NQ00','install-2','Second Mac','macOS','active')`)
    db.sqlite.prepare(`INSERT INTO wallet_sessions(id,wallet_address,token_hash,expires_at,scopes) VALUES ('owner','NQ00',?,'2099-01-01','learning:activate')`).run(await sha256('wallet-token'))
    const launch = new Request('https://core.test/v1/tasks/task/activate', { method: 'POST', headers: {
      authorization: 'Bearer wallet-token', 'content-type': 'application/json', 'idempotency-key': 'move-task',
    }, body: JSON.stringify({ deviceId: 'mac-2' }) })
    const result = await (await activateTask('task', launch, env)).json()
    expect(result.session.device.id).toBe('mac-2')
    expect(result.session.currentStep.id).toBe('two')
    expect(result.session.progress.completedCount).toBe(1)
    expect((await load()).status).toBe('paused')
  })
  it('recomputes the next step if a practice check commits during Mac handoff', async () => {
    const initial = await load()
    db.sqlite.exec(`INSERT INTO devices(id,wallet_address,install_id,name,platform,status) VALUES ('mac-2','NQ00','install-2','Second Mac','macOS','active')`)
    db.sqlite.prepare(`INSERT INTO wallet_sessions(id,wallet_address,token_hash,expires_at,scopes) VALUES ('owner','NQ00',?,'2099-01-01','learning:activate')`).run(await sha256('wallet-token'))
    const original = db.DB.batch
    let injected = false
    db.DB.batch = async statements => {
      if (!injected) { injected = true; await commit(initial) }
      return original(statements)
    }
    const launch = new Request('https://core.test/v1/tasks/task/activate', { method: 'POST', headers: {
      authorization: 'Bearer wallet-token', 'content-type': 'application/json', 'idempotency-key': 'move-during-check',
    }, body: JSON.stringify({ deviceId: 'mac-2' }) })
    const result = await (await activateTask('task', launch, env)).json()
    expect(result.session.currentStep.id).toBe('two')
    expect(result.session.progress.completedCount).toBe(1)
  })
  it('checks the pinned Nimiq Path rubric and keeps paid curricula locked', async () => {
    db.sqlite.prepare(`INSERT INTO wallet_sessions(id,wallet_address,token_hash,expires_at,scopes) VALUES ('owner','NQ00',?,'2099-01-01','learning:activate')`).run(await sha256('wallet-token'))
    const launch = id => new Request('https://core.test/v1/learning/sessions/activate', { method: 'POST', headers: {
      authorization: 'Bearer wallet-token', 'content-type': 'application/json', 'idempotency-key': 'start-' + id,
    }, body: JSON.stringify({ deviceId: 'mac', skillId: id, skillVersion: 1 }) })
    const started = await (await activateLearningSession(launch('skill_nimiq_first_mini_app'), env)).json()
    expect(started.session.source.version).toBe(1)
    expect(started.session.currentStep.rubric.length).toBe(2)
    const assessment = { ...good, criteria: [...good.criteria, { ...good.criteria[0], index: 1 }] }
    await commit(started.session, assessment)
    const next = await loadSessionByIdentity(env, started.session.id, 'NQ00', 'mac')
    expect(next.currentStep.id).toBe('account')
    expect(next.progress.completedCount).toBe(1)
    await expect(activateLearningSession(launch('skill_nim_payments'), env)).rejects.toMatchObject({ status: 403 })
    const original = db.DB.batch
    db.DB.batch = async statements => {
      db.sqlite.exec(`UPDATE skills SET status='draft' WHERE id='skill_nimiq_first_mini_app'`)
      return original(statements)
    }
    await expect(commit(next, assessment, 'attempt-2')).rejects.toMatchObject({ status: 409 })
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM practice_attempts WHERE decision='passed'`).get().n).toBe(1)
  })
})
