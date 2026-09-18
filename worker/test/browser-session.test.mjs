import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { getPublicKeyAsync, signAsync } from '@noble/ed25519'
import { createTestDatabase } from './helpers/sqlite-d1.mjs'
import { browserCookie, readBrowserSession, logoutBrowserSession } from '../src/browser-session'
import { createWalletChallenge, verifyWalletChallenge, requireWallet, listDevices } from '../src/device-management'
import { normalizeNimiqAddress, nimiqAddressFromPublicKey, nimiqSignedMessageHash, sha256 } from '../src/security'
import { withCors } from '../src/http'
import { listTasks, updateTaskPlan } from '../src/learning/tasks'

let db, env
const origin = 'https://app.truly.test'
const core = 'https://core.truly.test'
const request = (path = '/v1/auth/session', options = {}) => new Request(`${core}${path}`, {
  ...options, headers: { origin, 'x-truly-browser': '1', 'x-truly-account': 'NQ00', cookie: 'truly_access=test-token', ...options.headers },
})
const plan = { title: 'Understand privacy', outcome: 'Explain it clearly.', steps: [
  { id: 'one', title: 'Compare', summary: 'Write your own contrast.', challenge: 'Show your explanation.', rubric: ['The contrast is explicit.'] },
] }
const save = (id = 'draft', revision, changedPlan = plan, headers = {}) => request(`/v1/tasks/${id}/plan`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ plan: changedPlan, updatedAt: revision }),
})
beforeEach(async () => {
  db = createTestDatabase()
  env = { DB: db.DB, PAIRING_ORIGIN: origin, ALLOWED_ORIGINS: origin }
  db.sqlite.exec(`INSERT INTO wallet_accounts(nimiq_address) VALUES ('NQ00'), ('NQ11');
    INSERT INTO devices(id,wallet_address,name,platform,install_id,status) VALUES ('mac','NQ00','My Mac','macOS','installed','active');`)
  db.sqlite.prepare(`INSERT INTO wallet_sessions(id,wallet_address,token_hash,expires_at,scopes) VALUES ('browser','NQ00',?,'2099-01-01T00:00:00.000Z','devices:read tasks:read tasks:edit')`).run(await sha256('test-token'))
  db.sqlite.prepare(`INSERT INTO learning_tasks(id,wallet_address,goal,title,outcome,plan_json,status) VALUES ('draft','NQ00','Understand privacy','Privacy','Explain it',?,'draft'), ('foreign','NQ11','Other','Other','Other',?,'draft')`).run(JSON.stringify(plan), JSON.stringify(plan))
})
afterEach(() => db.sqlite.close())

describe('approved browser session resumption', () => {
  it('resumes only a server-valid signed identity, without returning an access token', async () => {
    const body = await (await readBrowserSession(request(), env)).json()
    expect(body.session.account).toBe('NQ00')
    expect(body.session.expiresAt).toBe('2099-01-01T00:00:00.000Z')
    expect(JSON.stringify(body)).not.toContain('test-token')
    expect((await (await listDevices(request('/v1/devices'), env)).json()).devices).toHaveLength(1)
    expect((await (await listTasks(request('/v1/tasks'), env)).json()).tasks.map(task => task.id)).toEqual(['draft'])
  })
  it('expires without renewal or deleted data and rejects a forged cookie', async () => {
    db.sqlite.exec(`UPDATE wallet_sessions SET expires_at='2000-01-01T00:00:00.000Z'`)
    const response = await readBrowserSession(request(), env)
    expect(await response.json()).toEqual({ session: null })
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    await expect(requireWallet(request('/v1/tasks'), env, 'tasks:read')).rejects.toMatchObject({ status: 401 })
    expect(await (await readBrowserSession(request(undefined, { headers: { cookie: 'truly_access=forged-token' } }), env)).json()).toEqual({ session: null })
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM learning_tasks').get().count).toBe(2)
  })
  it.each([
    { origin: 'https://attacker.test' }, { origin: '' }, { 'x-truly-browser': '' },
  ])('refuses cookie CSRF and unapproved origins: %j', async headers => {
    await expect(readBrowserSession(request(undefined, { headers }), env)).rejects.toMatchObject({ status: 403 })
    await expect(logoutBrowserSession(request('/v1/auth/session/logout', { method: 'POST', headers }), env)).rejects.toMatchObject({ status: 403 })
  })
  it('allows an approved same-origin proxy but not an unauthenticated same-origin claim', async () => {
    const same = new Request(`${origin}/v1/auth/session`, { headers: { 'sec-fetch-site': 'same-origin', 'x-truly-browser': '1', cookie: 'truly_access=test-token' } })
    expect((await (await readBrowserSession(same, env)).json()).session.account).toBe('NQ00')
    const wrong = new Request(`${core}/v1/auth/session`, { headers: { 'sec-fetch-site': 'same-origin', 'x-truly-browser': '1', cookie: 'truly_access=test-token' } })
    await expect(readBrowserSession(wrong, env)).rejects.toMatchObject({ status: 403 })
  })
  it('checks scopes and expected account, never falling back from an invalid bearer to a cookie', async () => {
    await expect(requireWallet(request(), env, 'learning:activate')).rejects.toMatchObject({ status: 403 })
    await expect(requireWallet(request(undefined, { headers: { 'x-truly-account': 'NQ11' } }), env, 'tasks:read')).rejects.toMatchObject({ status: 401 })
    await expect(requireWallet(request(undefined, { headers: { authorization: 'Bearer invalid' } }), env, 'tasks:read')).rejects.toMatchObject({ status: 401 })
    expect((await requireWallet(new Request(`${core}/v1/tasks`, { headers: { authorization: 'Bearer test-token' } }), env, 'tasks:read')).walletAddress).toBe('NQ00')
  })
  it('disconnect invalidates the sign-in but preserves Tasks and paired Macs', async () => {
    const response = await logoutBrowserSession(request('/v1/auth/session/logout', { method: 'POST' }), env)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect((await (await readBrowserSession(request(), env)).json()).session).toBeNull()
    await expect(requireWallet(new Request(`${core}/v1/tasks`, { headers: { authorization: 'Bearer test-token' } }), env, 'tasks:read')).rejects.toMatchObject({ status: 401 })
    expect(db.sqlite.prepare(`SELECT status FROM devices WHERE id='mac'`).get().status).toBe('active')
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM learning_tasks').get().count).toBe(2)
  })
  it('uses HttpOnly, same-site, bounded cookies; Secure is mandatory on the production app origin', () => {
    const cookie = browserCookie(env, 'test-token', new Date(Date.now() + 900_000).toISOString())
    expect(cookie).toContain('HttpOnly; SameSite=Strict; Max-Age=')
    expect(cookie).toContain('; Secure')
    const age = Number(cookie.match(/Max-Age=(\d+)/)[1])
    expect(age).toBeLessThanOrEqual(900)
    expect(browserCookie({ ...env, PAIRING_ORIGIN: 'http://192.168.18.3:5173' }, 'test-token', new Date(Date.now() + 900_000).toISOString())).not.toContain('; Secure')
  })
  it('allows credentialed CORS only for configured origins and admits the CSRF/account headers', () => {
    const response = withCors(request(), env, Response.json({ ok: true }))
    expect(response.headers.get('access-control-allow-origin')).toBe(origin)
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    expect(response.headers.get('access-control-allow-headers')).toContain('x-truly-browser')
    expect(response.headers.get('access-control-allow-headers')).toContain('x-truly-account')
    expect(withCors(request(undefined, { headers: { origin: 'https://attacker.test' } }), env, Response.json({})).headers.get('access-control-allow-credentials')).toBeNull()
  })
  it('issues a cookie only after a real valid signature and cannot replay or forge the approval', async () => {
    const privateKey = new Uint8Array(32).fill(7)
    const publicKey = await getPublicKeyAsync(privateKey)
    const address = normalizeNimiqAddress(nimiqAddressFromPublicKey(publicKey))
    const challenge = await (await createWalletChallenge(request('/v1/auth/challenges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) }), env)).json()
    expect(challenge.message).toContain('edit personal Tasks before they start')
    const hex = bytes => Buffer.from(bytes).toString('hex')
    const signature = hex(await signAsync(await nimiqSignedMessageHash(challenge.message), privateKey))
    const verify = body => request(`/v1/auth/challenges/${challenge.challengeId}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    await expect(verifyWalletChallenge(challenge.challengeId, verify({ publicKey: hex(publicKey), signature: '00'.repeat(64) }), env)).rejects.toMatchObject({ status: 401 })
    const response = await verifyWalletChallenge(challenge.challengeId, verify({ publicKey: hex(publicKey), signature }), env)
    const body = await response.json()
    expect(response.headers.get('set-cookie')).toContain(`truly_access=${body.token}`)
    const resumed = await readBrowserSession(request(undefined, { headers: { cookie: `truly_access=${body.token}` } }), env)
    expect((await resumed.json()).session.account).toBe(address)
    await expect(verifyWalletChallenge(challenge.challengeId, verify({ publicKey: hex(publicKey), signature }), env)).rejects.toMatchObject({ status: 409 })
  })
})

describe('reviewing an unstarted personal plan', () => {
  it('saves edits to a draft without rewriting the original goal/resources or fabricating progress', async () => {
    const row = db.sqlite.prepare(`SELECT updated_at FROM learning_tasks WHERE id='draft'`).get()
    const response = await updateTaskPlan('draft', save('draft', row.updated_at, { ...plan, title: 'Understand Zama' }), env)
    const task = (await response.json()).task
    expect(task.title).toBe('Understand Zama')
    expect(task.goal).toBe('Understand privacy')
    expect(task.steps).toHaveLength(1)
    expect(task.status).toBe('draft')
    expect(task.updatedAt).not.toBe(row.updated_at)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM practice_attempts').get().count).toBe(0)
    await expect(updateTaskPlan('draft', save('draft', row.updated_at), env)).rejects.toMatchObject({ status: 409 })
  })
  it('refuses foreign Tasks, reviewed Paths, started work and missing edit scope', async () => {
    const row = db.sqlite.prepare(`SELECT updated_at FROM learning_tasks WHERE id='draft'`).get()
    await expect(updateTaskPlan('foreign', save('foreign', row.updated_at), env)).rejects.toMatchObject({ status: 404 })
    db.sqlite.exec(`UPDATE learning_tasks SET source_kind='path' WHERE id='draft'`)
    await expect(updateTaskPlan('draft', save('draft', row.updated_at), env)).rejects.toMatchObject({ status: 409 })
    db.sqlite.exec(`UPDATE learning_tasks SET source_kind='direct', status='active' WHERE id='draft'`)
    await expect(updateTaskPlan('draft', save('draft', row.updated_at), env)).rejects.toMatchObject({ status: 409 })
    db.sqlite.exec(`UPDATE learning_tasks SET status='draft' WHERE id='draft'; UPDATE wallet_sessions SET scopes='tasks:read';`)
    await expect(updateTaskPlan('draft', save('draft', row.updated_at), env)).rejects.toMatchObject({ status: 403 })
  })
  it('refuses empty, uncheckable or duplicate plans', async () => {
    const row = db.sqlite.prepare(`SELECT updated_at FROM learning_tasks WHERE id='draft'`).get()
    for (const steps of [[], [{ ...plan.steps[0], challenge: null, rubric: [] }], [plan.steps[0], plan.steps[0]]]) {
      await expect(updateTaskPlan('draft', save('draft', row.updated_at, { ...plan, steps }), env)).rejects.toMatchObject({ status: 400 })
    }
  })
  it('cannot edit a plan with session history even if its status was incorrectly reset to draft', async () => {
    db.sqlite.exec(`INSERT INTO task_learning_sessions(id,wallet_address,device_id,task_id,status,current_step) VALUES ('old','NQ00','mac','draft','paused','one')`)
    const row = db.sqlite.prepare(`SELECT updated_at FROM learning_tasks WHERE id='draft'`).get()
    await expect(updateTaskPlan('draft', save('draft', row.updated_at), env)).rejects.toMatchObject({ status: 409 })
  })
})
