import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { createTestDatabase } from './helpers/sqlite-d1.mjs'
import { studioRequest } from '../src/creator-studio.ts'
import { resolveSkillVersion } from '../src/learning/access.ts'
import { sha256 } from '../src/security.ts'
import { getPublicKeyAsync, signAsync } from '@noble/ed25519'
import { nimiqAddressFromPublicKey, nimiqSignedMessageHash, normalizeNimiqAddress } from '../src/security.ts'
import { createWalletChallenge, verifyWalletChallenge, requireWallet } from '../src/device-management.ts'
import { getCatalog, getCreator } from '../src/catalog.ts'

let sqlite, env
const address = 'NQ1237R4KTF9AC69S6SMVMA5K0TAKYPCPB5G'
const document = { slug: 'learn-by-doing', title: 'Learn by doing', summary: 'A useful first step', description: 'Practise in the real tool.',
  category: 'Design', language: 'English', outcomes: ['Make a shape'], prerequisites: [], supportedEnvironments: ['Browser'],
  estimatedMinutes: 20, tags: [], priceNim: null, steps: [{ id: 'step-one', title: 'Make a shape', summary: 'Draw a circle.',
    workspaceLink: null, resources: [], challenge: 'Show your circle.', rubric: ['A circle is visible.'], hints: [] }] }
async function call(method, path, body, token = 'creator-token') {
  return studioRequest(path.split('/'), new Request(`https://core.test/v1/studio/${path}`, { method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }), env)
}
async function draft(doc = document) { return (await call('POST', 'drafts', { document: doc })).json() }
async function publish(d) {
  await call('POST', `drafts/${d.id}/submit`, { revision: d.revision })
  return call('POST', `review/${d.id}`, { revision: d.revision, decision: 'published', note: 'Exercised and reviewed.' }, 'review-secret')
}
beforeEach(async () => {
  const database = createTestDatabase(); sqlite = database.sqlite
  env = { DB: database.DB, CREATOR_REVIEW_TOKEN: 'review-secret', PAIRING_ORIGIN: 'https://app.test', ALLOWED_ORIGINS: 'https://app.test' }
  sqlite.prepare('INSERT OR IGNORE INTO wallet_accounts (nimiq_address) VALUES (?)').run(address)
  sqlite.prepare("INSERT INTO creators (id,nimiq_address,slug,display_name,status) VALUES ('test-creator',?,'test-creator','Creator','invited')").run(address)
  sqlite.prepare('INSERT INTO wallet_sessions (id,wallet_address,token_hash,expires_at,scopes) VALUES (?,?,?,?,?)')
    .run('creator-session', address, await sha256('creator-token'), new Date(Date.now() + 60000).toISOString(), 'studio:read studio:write')
})
afterEach(() => sqlite.close())
describe('Creator Studio boundary', () => {
  it('lets a creator delete a private draft and removes its abandoned Path shell', async () => {
    const d = await draft()
    const response = await call('DELETE', `drafts/${d.id}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'deleted', draftId: d.id })
    expect((await (await call('GET', 'drafts')).json()).drafts).toHaveLength(0)
    expect(sqlite.prepare('SELECT id FROM skills WHERE id=?').get(d.skillId)).toBeUndefined()
  })
  it('deletes an unpublished update without touching its published Path', async () => {
    const original = await draft(); await publish(original)
    const update = await (await call('POST', 'drafts', { skillId: original.skillId })).json()
    expect((await call('DELETE', `drafts/${update.id}`)).status).toBe(200)
    expect(sqlite.prepare('SELECT status,current_version FROM skills WHERE id=?').get(original.skillId))
      .toEqual({ status: 'published', current_version: 1 })
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM skill_versions WHERE skill_id=?').get(original.skillId).count).toBe(1)
  })
  it('keeps submitted snapshots locked while they are in review', async () => {
    const d = await draft(); await call('POST', `drafts/${d.id}/submit`, { revision: d.revision })
    await expect(call('DELETE', `drafts/${d.id}`)).rejects.toMatchObject({ status: 409, code: 'creator_draft_locked' })
    expect(sqlite.prepare('SELECT status FROM creator_drafts WHERE id=?').get(d.id).status).toBe('review')
  })
  it('keeps drafts private, submits an immutable revision, and explicitly publishes', async () => {
    const d = await draft()
    expect(sqlite.prepare('SELECT status FROM skills WHERE id=?').get(d.skillId).status).toBe('draft')
    expect((await call('POST', `drafts/${d.id}/submit`, { revision: 1 })).status).toBe(200)
    await expect(call('POST', `drafts/${d.id}`, { revision: 1, document })).rejects.toMatchObject({ status: 409 })
    const response = await call('POST', `review/${d.id}`, { revision: 1, decision: 'published', note: 'Reviewed.' }, 'review-secret')
    expect(response.status).toBe(200)
    expect(sqlite.prepare('SELECT status FROM skills WHERE id=?').get(d.skillId).status).toBe('published')
    await expect(call('POST', `review/${d.id}`, { revision: 1, decision: 'published', note: 'Reviewed.' }, 'review-secret')).rejects.toMatchObject({ status: 409 })
  })
  it('requires creator scope, non-suspended access, and a separate reviewer credential', async () => {
    const d = await draft()
    await expect(call('POST', `review/${d.id}`, { revision: 1, decision: 'published', note: 'Self review' })).rejects.toMatchObject({ status: 401 })
    sqlite.prepare("UPDATE wallet_sessions SET scopes='tasks:read'").run()
    await expect(call('GET', 'drafts')).rejects.toMatchObject({ status: 403 })
    sqlite.prepare("UPDATE wallet_sessions SET scopes='studio:read studio:write';").run()
    sqlite.prepare("UPDATE creators SET status='suspended' WHERE id='test-creator'").run()
    await expect(call('GET', 'drafts')).rejects.toMatchObject({ status: 403 })
  })
  it('rejects expired sign-in and foreign drafts without revealing their content', async () => {
    const d = await draft()
    sqlite.prepare("UPDATE creator_drafts SET creator_id='creator_truly_studio'").run()
    await expect(call('POST', `drafts/${d.id}`, { revision: 1, document })).rejects.toMatchObject({ status: 404 })
    sqlite.prepare("UPDATE wallet_sessions SET expires_at='2000-01-01T00:00:00Z'").run()
    await expect(call('GET', 'drafts')).rejects.toMatchObject({ status: 401 })
  })
  it('rejects stale saves, unsafe links and incomplete submissions', async () => {
    const d = await draft()
    await call('POST', `drafts/${d.id}`, { revision: 1, document })
    await expect(call('POST', `drafts/${d.id}`, { revision: 1, document })).rejects.toMatchObject({ status: 409 })
    await expect(draft({ ...document, steps: [{ ...document.steps[0], resources: [{ title: 'Bad', url: 'javascript:alert(1)' }] }] })).rejects.toMatchObject({ status: 400 })
    const incomplete = await draft({ ...document, title: '', steps: [] })
    await expect(call('POST', `drafts/${incomplete.id}/submit`, { revision: 1 })).rejects.toMatchObject({ status: 400 })
  })
  it('signs purpose-bound creator access and does not silently upgrade learner approval', async () => {
    const privateKey = new Uint8Array(32).fill(19)
    const publicKey = await getPublicKeyAsync(privateKey)
    const invited = normalizeNimiqAddress(nimiqAddressFromPublicKey(publicKey))
    sqlite.prepare('INSERT INTO wallet_accounts (nimiq_address) VALUES (?)').run(invited)
    sqlite.prepare("INSERT INTO creators (id,nimiq_address,slug,display_name,status) VALUES ('signed-creator',?,'signed-creator','Signed creator','invited')").run(invited)
    const challengeRequest = purpose => new Request('https://core.test/v1/auth/challenges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: invited, purpose }) })
    const learner = await (await createWalletChallenge(challengeRequest(undefined), env)).json()
    expect(learner.scopes).not.toContain('studio:write')
    const challenge = await (await createWalletChallenge(challengeRequest('studio'), env)).json()
    expect(challenge.message).toContain('cannot publish without separate approval')
    const signature = Buffer.from(await signAsync(await nimiqSignedMessageHash(challenge.message), privateKey)).toString('hex')
    const verify = () => new Request('https://core.test/v1/auth/challenges/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey: Buffer.from(publicKey).toString('hex'), signature }) })
    const session = await (await verifyWalletChallenge(challenge.challengeId, verify(), env)).json()
    expect(session.scopes).toContain('studio:write')
    expect((await call('GET', 'drafts', null, session.token)).status).toBe(200)
    await expect(verifyWalletChallenge(challenge.challengeId, verify(), env)).rejects.toMatchObject({ status: 409 })
    const revoked = await (await createWalletChallenge(challengeRequest('studio'), env)).json()
    sqlite.prepare("UPDATE creators SET status='suspended' WHERE id='signed-creator'").run()
    await expect(verifyWalletChallenge(revoked.challengeId, verify(), env)).rejects.toMatchObject({ status: 403 })
  })
  it('opens authoring only after a valid signature, preserving the profile on repeat approvals', async () => {
    const key = new Uint8Array(32).fill(27), publicKey = await getPublicKeyAsync(key)
    const wallet = normalizeNimiqAddress(nimiqAddressFromPublicKey(publicKey))
    async function challenge() {
      return (await createWalletChallenge(new Request('https://core.test/v1/auth/challenges', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: wallet, purpose: 'studio' }) }), env)).json()
    }
    async function verify(c, signingKey = key) {
      const pk = await getPublicKeyAsync(signingKey)
      return verifyWalletChallenge(c.challengeId, new Request('https://core.test/v1/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publicKey: Buffer.from(pk).toString('hex'), signature: Buffer.from(await signAsync(await nimiqSignedMessageHash(c.message), signingKey)).toString('hex') }) }), env)
    }
    const c = await challenge()
    expect(sqlite.prepare('SELECT id FROM creators WHERE nimiq_address=?').get(wallet)).toBeUndefined()
    await expect(verify(c, new Uint8Array(32).fill(28))).rejects.toMatchObject({ status: 401 })
    expect(sqlite.prepare('SELECT id FROM creators WHERE nimiq_address=?').get(wallet)).toBeUndefined()
    const session = await (await verify(c)).json()
    expect(session.scopes).toContain('studio:write'); expect(session.scopes).not.toContain('review:write')
    const library = await (await call('GET', 'drafts', null, session.token)).json()
    expect(library.canReview).toBe(false); expect(library.creator.nimiqAddress).toBe(wallet)
    sqlite.prepare("UPDATE creators SET display_name='My chosen name' WHERE nimiq_address=?").run(wallet)
    await verify(await challenge())
    expect(sqlite.prepare('SELECT display_name FROM creators WHERE nimiq_address=?').get(wallet).display_name).toBe('My chosen name')
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM creators WHERE nimiq_address=?').get(wallet).count).toBe(1)
    sqlite.prepare("UPDATE creators SET status='suspended' WHERE nimiq_address=?").run(wallet)
    await expect(challenge()).rejects.toMatchObject({ status: 403 })
  })
  it('requires live admin authorization and review scopes, and audits the exact reviewer snapshot', async () => {
    env.REVIEWER_WALLETS = address
    const d = await draft(); await call('POST', `drafts/${d.id}/submit`, { revision: d.revision })
    await expect(call('GET', 'review-queue')).rejects.toMatchObject({ status: 403 })
    sqlite.prepare("UPDATE wallet_sessions SET scopes='review:read review:write'").run()
    expect((await (await call('GET', 'review-queue')).json()).drafts.map(item => item.id)).toEqual([d.id])
    env.REVIEWER_WALLETS = ''
    await expect(call('GET', 'review-queue')).rejects.toMatchObject({ status: 403 })
    env.REVIEWER_WALLETS = address
    await expect(call('POST', `review-queue/${d.id}`, { revision: 999, decision: 'published', note: 'Reviewed.' })).rejects.toMatchObject({ status: 409 })
    expect((await call('POST', `review-queue/${d.id}`, { revision: d.revision, decision: 'published', note: 'Exercised the submitted steps.' })).status).toBe(200)
    expect(sqlite.prepare('SELECT reviewer_wallet,revision,decision FROM creator_reviews WHERE draft_id=?').get(d.id))
      .toEqual({ reviewer_wallet: address, revision: d.revision, decision: 'published' })
    expect((await (await call('GET', 'review-queue')).json()).drafts).toHaveLength(0)
    await expect(call('POST', `review-queue/${d.id}`, { revision: d.revision, decision: 'published', note: 'Again' })).rejects.toMatchObject({ status: 409 })
  })
  it('binds reviewer signatures to purpose, wallet and the current server allowlist', async () => {
    const key = new Uint8Array(32).fill(29), pk = await getPublicKeyAsync(key), wallet = normalizeNimiqAddress(nimiqAddressFromPublicKey(pk))
    const request = purpose => new Request('https://core.test/v1/auth/challenges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: wallet, purpose }) })
    await expect(createWalletChallenge(request('review'), env)).rejects.toMatchObject({ status: 403 })
    env.REVIEWER_WALLETS = wallet
    const c = await (await createWalletChallenge(request('review'), env)).json()
    expect(c.scopes).toContain('review:write'); expect(c.scopes).not.toContain('studio:write'); expect(c.message).toContain('approve publication')
    const verify = () => new Request('https://core.test/v1/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      publicKey: Buffer.from(pk).toString('hex'), signature: Buffer.from(signing).toString('hex') }) })
    const signing = await signAsync(await nimiqSignedMessageHash(c.message), key)
    env.REVIEWER_WALLETS = ''
    await expect(verifyWalletChallenge(c.challengeId, verify(), env)).rejects.toMatchObject({ status: 403 })
    env.REVIEWER_WALLETS = wallet
    const session = await (await verifyWalletChallenge(c.challengeId, verify(), env)).json()
    expect((await call('GET', 'review-queue', null, session.token)).status).toBe(200)
    expect(sqlite.prepare('SELECT id FROM creators WHERE nimiq_address=?').get(wallet)).toBeUndefined()
    sqlite.prepare("UPDATE wallet_sessions SET expires_at='2000-01-01T00:00:00Z' WHERE wallet_address=?").run(wallet)
    await expect(call('GET', 'review-queue', null, session.token)).rejects.toMatchObject({ status: 401 })
  })
  it('rejects bearer grants for a different selected account as well as cookie mismatches', async () => {
    await expect(requireWallet(new Request('https://core.test/v1/studio/drafts', { headers: { authorization: 'Bearer creator-token', 'x-truly-account': 'NQ4700000000000000000000000000000000' } }), env, 'studio:read')).rejects.toMatchObject({ status: 401 })
  })
  it('keeps public catalog and profile free of drafts, and pins the payout to the signed creator', async () => {
    const d = await draft({ ...document, priceNim: '0.01001', recipient: 'attacker' })
    expect(JSON.stringify(await (await getCatalog(env)).json())).not.toContain(d.skillId)
    expect((await (await getCreator('test-creator', env)).json()).skills).toHaveLength(0)
    await publish(d)
    const price = sqlite.prepare('SELECT recipient,amount_atomic FROM skill_prices WHERE skill_id=?').get(d.skillId)
    expect(price).toEqual({ recipient: address, amount_atomic: '1001' })
    const publication = JSON.parse(sqlite.prepare('SELECT publication_json FROM skill_versions WHERE skill_id=?').get(d.skillId).publication_json)
    expect(publication.nimPayment).toEqual({ recipient: address, amountAtomic: '1001', decimals: 5 })
    env.NIM_PAYMENTS_ENABLED = 'true'; env.NIM_RPC_URL = 'https://nim-rpc.test'
    expect((await (await getCreator('test-creator', env)).json()).skills.map(s => s.id)).toEqual([d.skillId])
    const listing = (await (await getCatalog(env)).json()).skills.find(s => s.id === d.skillId)
    expect(listing.prices[0].checkoutEnabled).toBe(true)
    expect(listing.steps).toEqual([{ id: 'step-one', title: 'Make a shape', summary: '', workspaceLink: null, resources: [], challenge: null, rubric: [] }])
    await expect(resolveSkillVersion(env, address, d.skillId, 1)).rejects.toMatchObject({ status: 403 })
    sqlite.prepare("INSERT INTO entitlements (id,wallet_address,skill_id,source) VALUES ('test-paid-access',?,?,'grant')").run(address, d.skillId)
    const owned = await resolveSkillVersion(env, address, d.skillId, 1)
    expect(owned.steps[0].summary).toBe('Draw a circle.')
    expect(owned.steps[0].challenge).toBe('Show your circle.')
    expect(owned.steps[0].rubric).toEqual(['A circle is visible.'])
    sqlite.prepare("UPDATE skill_versions SET review_status='review' WHERE skill_id=?").run(d.skillId)
    expect((await (await getCatalog(env)).json()).skills.map(s => s.id)).not.toContain(d.skillId)
    expect((await (await getCreator('test-creator', env)).json()).skills).toHaveLength(0)
  })
  it('keeps suspended creators out of public discovery', async () => {
    const d = await draft(); await publish(d)
    sqlite.prepare("UPDATE creators SET status='suspended' WHERE id='test-creator'").run()
    expect((await (await getCatalog(env)).json()).skills.map(s => s.id)).not.toContain(d.skillId)
    expect((await getCreator('test-creator', env)).status).toBe(404)
  })
  it('makes creation retries safe and rolls back conflicting publication links', async () => {
    const id = crypto.randomUUID()
    const first = await (await call('POST', 'drafts', { id, document })).json()
    expect((await (await call('POST', 'drafts', { id, document })).json()).id).toBe(first.id)
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM creator_drafts').get().count).toBe(1)
    await publish(first)
    const other = await draft()
    await call('POST', `drafts/${other.id}/submit`, { revision: 1 })
    await expect(call('POST', `review/${other.id}`, { revision: 1, decision: 'published', note: 'Checked' }, 'review-secret')).rejects.toMatchObject({ status: 409 })
    expect(sqlite.prepare('SELECT status FROM creator_drafts WHERE id=?').get(other.id).status).toBe('review')
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM skill_versions WHERE skill_id=?').get(other.skillId).count).toBe(0)
  })
  it('supports reviewer rejection and deliberate revision without making the Path public', async () => {
    const d = await draft(); await call('POST', `drafts/${d.id}/submit`, { revision: 1 })
    await call('POST', `review/${d.id}`, { revision: 1, decision: 'rejected', note: 'Clarify the evidence.' }, 'review-secret')
    const revised = await (await call('POST', `drafts/${d.id}/revise`, { revision: 1 })).json()
    expect(revised.status).toBe('draft'); expect(revised.revision).toBe(2)
    expect(revised.reviewNote).toBe('Clarify the evidence.')
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM creator_reviews WHERE draft_id=?').get(d.id).count).toBe(1)
    expect((await (await getCreator('test-creator', env)).json()).skills).toHaveLength(0)
  })
  it('pins free access, content and presentation when a new paid version is published', async () => {
    const d = await draft(); await publish(d)
    const before = await resolveSkillVersion(env, address, d.skillId, 1)
    const next = await (await call('POST', 'drafts', { skillId: d.skillId })).json()
    const edited = await (await call('POST', `drafts/${next.id}`, { revision: 1, document: { ...document, title: 'New paid edition', priceNim: '0.01', steps: [{ ...document.steps[0], title: 'Different step' }] } })).json()
    await publish(edited)
    const old = await resolveSkillVersion(env, address, d.skillId, 1)
    expect(old.title).toBe(before.title); expect(old.steps).toEqual(before.steps)
    await expect(resolveSkillVersion(env, address, d.skillId, 2)).rejects.toMatchObject({ status: 403 })
    expect(sqlite.prepare('SELECT access_kind FROM skill_versions WHERE skill_id=? ORDER BY version').all(d.skillId)).toEqual([{ access_kind: 'free' }, { access_kind: 'paid' }])
  })
  it('freezes each approved paid version price independently', async () => {
    const d = await draft({ ...document, priceNim: '0.01' }); await publish(d)
    const next = await (await call('POST', 'drafts', { skillId: d.skillId })).json()
    const edited = await (await call('POST', `drafts/${next.id}`, { revision: 1, document: { ...document, priceNim: '0.02' } })).json()
    await publish(edited)
    const versions = sqlite.prepare('SELECT publication_json FROM skill_versions WHERE skill_id=? ORDER BY version').all(d.skillId)
    expect(versions.map(v => JSON.parse(v.publication_json).nimPayment)).toEqual([
      { recipient: address, amountAtomic: '1000', decimals: 5 },
      { recipient: address, amountAtomic: '2000', decimals: 5 },
    ])
  })
})
