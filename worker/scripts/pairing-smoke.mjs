import assert from 'node:assert/strict'
import { Hash, PrivateKey, PublicKey, Signature } from '@nimiq/core'

const baseUrl = process.env.TRULY_TEST_CORE_URL || 'http://127.0.0.1:8787'
const installation = `smoke-${crypto.randomUUID()}`
const privateKey = PrivateKey.generate()
const publicKey = PublicKey.derive(privateKey)
const address = publicKey.toAddress().toUserFriendlyAddress()

async function request(path, body, token, extraHeaders = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: response.status, body: await response.json() }
}

async function createAndApprove(testBadSignatures = false) {
  const challenge = await request('/v1/pairing/challenges', {
    installId: installation,
    deviceName: 'Truly API Test Mac',
    platform: 'macOS',
  })
  assert.equal(challenge.status, 201)
  const preview = await request(`/v1/pairing/code/${challenge.body.code}`)
  assert.equal(preview.status, 200)
  const bytes = new TextEncoder().encode(preview.body.message)
  const payload = new TextEncoder().encode(`\x16Nimiq Signed Message:\n${bytes.byteLength}${preview.body.message}`)
  const signature = Signature.create(privateKey, publicKey, Hash.computeSha256(payload)).toHex()
  const rawSignature = Signature.create(privateKey, publicKey, bytes).toHex()
  const input = { address, publicKey: publicKey.toHex(), signature }
  const approvalPath = `/v1/pairing/challenges/${challenge.body.challengeId}/approve`
  if (testBadSignatures) {
    const raw = await request(approvalPath, { ...input, signature: rawSignature })
    assert.equal(raw.status, 401)
    const tampered = await request(approvalPath, { ...input, signature: '00'.repeat(64) })
    assert.equal(tampered.status, 401)
  }
  const approvals = await Promise.all([request(approvalPath, input), request(approvalPath, input)])
  assert.deepEqual(approvals.map((result) => result.status).sort(), [200, 409])
  return { challenge: challenge.body, device: approvals.find((result) => result.status === 200).body.device }
}

const first = await createAndApprove(true)
const exchangePath = `/v1/pairing/challenges/${first.challenge.challengeId}/exchange`
assert.equal((await request(exchangePath, { exchangeSecret: 'not-the-secret' })).status, 401)
const exchanges = await Promise.all([
  request(exchangePath, { exchangeSecret: first.challenge.exchangeSecret }),
  request(exchangePath, { exchangeSecret: first.challenge.exchangeSecret }),
])
assert.deepEqual(exchanges.map((result) => result.status).sort(), [200, 409])
const session = exchanges.find((result) => result.status === 200).body
const authenticated = await fetch(`${baseUrl}/v1/desktop/session`, {
  headers: { authorization: `Bearer ${session.token}` },
})
assert.equal(authenticated.status, 200)
assert.equal((await authenticated.json()).deviceId, first.device.id)
assert.equal((await fetch(`${baseUrl}/v1/desktop/session`)).status, 401)
const second = await createAndApprove()
assert.equal(second.device.id, first.device.id, 'Re-pairing the same wallet/install preserves device identity')
assert.equal((await request('/v1/desktop/session', undefined, session.token)).status, 401, 'Re-pair invalidates the previous token')

async function authenticate(key = privateKey) {
  const pub = PublicKey.derive(key)
  const auth = await request('/v1/auth/challenges', { address: pub.toAddress().toUserFriendlyAddress() })
  assert.equal(auth.status, 201)
  const bytes = new TextEncoder().encode(auth.body.message)
  const payload = new TextEncoder().encode(`\x16Nimiq Signed Message:\n${bytes.byteLength}${auth.body.message}`)
  const input = { publicKey: pub.toHex(), signature: Signature.create(key, pub, Hash.computeSha256(payload)).toHex() }
  const path = `/v1/auth/challenges/${auth.body.challengeId}/verify`
  assert.equal((await request(path, { ...input, signature: '00'.repeat(64) })).status, 401)
  const results = await Promise.all([request(path, input), request(path, input)])
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409])
  return results.find((result) => result.status === 200).body.token
}
assert.equal((await request('/v1/devices')).status, 401)
const walletToken = await authenticate()
const owned = await request('/v1/devices', undefined, walletToken)
assert.equal(owned.status, 200)
assert.equal(owned.body.devices.length, 1)
assert.equal(owned.body.devices[0].id, first.device.id)
assert.equal((await request('/v1/devices', undefined, session.token)).status, 401, 'Desktop token cannot manage wallet devices')
const strangerToken = await authenticate(PrivateKey.generate())
assert.equal((await request(`/v1/devices/${first.device.id}/revoke`, {}, strangerToken)).status, 404)
assert.equal((await request(`/v1/devices/${first.device.id}/revoke`, {}, walletToken)).status, 200)
assert.equal((await request(`/v1/devices/${first.device.id}/revoke`, {}, walletToken)).status, 200, 'Revocation is idempotent')
assert.equal((await request(`/v1/pairing/challenges/${second.challenge.challengeId}/exchange`, { exchangeSecret: second.challenge.exchangeSecret })).status, 409, 'Revoked approved pairing cannot exchange')
const third = await createAndApprove()
const restored = await request(`/v1/pairing/challenges/${third.challenge.challengeId}/exchange`, { exchangeSecret: third.challenge.exchangeSecret })
assert.equal(restored.status, 200)
assert.equal((await request('/v1/desktop/session', undefined, restored.body.token)).status, 200)
await request(`/v1/devices/${third.device.id}/revoke`, {}, walletToken)
assert.equal((await request('/v1/desktop/session', undefined, restored.body.token)).status, 401, 'Revoked active token is rejected immediately')
const fourth = await createAndApprove()
const liveDesktop = await request(`/v1/pairing/challenges/${fourth.challenge.challengeId}/exchange`, { exchangeSecret: fourth.challenge.exchangeSecret })
assert.equal(liveDesktop.status, 200)
const cancelled = await request('/v1/pairing/challenges', { installId: `cancel-${crypto.randomUUID()}`, deviceName: 'Cancellation Test Mac', platform: 'macOS' })
assert.equal(cancelled.status, 201)
assert.equal((await request(`/v1/pairing/challenges/${cancelled.body.challengeId}/cancel`, { exchangeSecret: 'wrong' })).status, 401)
assert.equal((await request(`/v1/pairing/challenges/${cancelled.body.challengeId}/cancel`, { exchangeSecret: cancelled.body.exchangeSecret })).status, 200)
assert.equal((await request(`/v1/pairing/code/${cancelled.body.code}`)).status, 409)
const catalog = await request('/v1/catalog')
assert.equal(catalog.status, 200)
assert.equal(catalog.body.skills.length, 3)
assert.ok(catalog.body.skills.every((skill) => skill.runtimeReady === true))
assert.ok(catalog.body.skills.every((skill) => skill.steps.length === 3))
assert.ok(catalog.body.skills.flatMap((skill) => skill.prices).every((price) => price.active === 0))
const activationInput = { deviceId: fourth.device.id, skillId: 'skill_nimiq_first_mini_app', skillVersion: 1 }
const activationHeaders = { 'idempotency-key': crypto.randomUUID() }
const activation = await request('/v1/learning/sessions/activate', activationInput, walletToken, activationHeaders)
assert.equal(activation.status, 201)
assert.equal(activation.body.session.source.kind, 'path')
assert.ok(activation.body.session.source.taskId, 'Starting a Path creates a learner-owned Task')
assert.equal(activation.body.session.source.title, 'Build your first Nimiq Mini App')
assert.equal(activation.body.session.currentStep.id, 'provider')
assert.equal(activation.body.session.currentStep.workspaceLink.url, 'https://nimiq.dev/mini-apps/tutorials/mini-app-tutorial')
const repeatedActivation = await request('/v1/learning/sessions/activate', activationInput, walletToken, activationHeaders)
assert.equal(repeatedActivation.status, 200)
assert.equal(repeatedActivation.body.session.id, activation.body.session.id, 'Activation is idempotent')
const walletSessions = await request('/v1/learning/sessions', undefined, walletToken)
assert.equal(walletSessions.status, 200)
assert.equal(walletSessions.body.sessions[0].id, activation.body.session.id)
const walletTasks = await request('/v1/tasks', undefined, walletToken)
assert.equal(walletTasks.status, 200)
assert.ok(walletTasks.body.tasks.some((task) => task.id === activation.body.session.source.taskId && task.source.kind === 'path'))
const desktopLearning = await request('/v1/desktop/learning-session', undefined, liveDesktop.body.token)
assert.equal(desktopLearning.status, 200)
assert.equal(desktopLearning.body.session.id, activation.body.session.id)
assert.equal((await request('/v1/desktop/learning-session')).status, 401)
assert.equal((await request('/v1/learning/sessions/activate', activationInput, strangerToken,
  { 'idempotency-key': crypto.randomUUID() })).status, 404, 'Another wallet cannot activate this Mac')
assert.equal((await request('/v1/learning/sessions/activate',
  { ...activationInput, skillId: 'skill_nim_payments' }, walletToken,
  { 'idempotency-key': crypto.randomUUID() })).status, 403, 'Paid Skill requires an entitlement')
assert.equal((await request('/v1/creators/truly-studio')).status, 200)
const disallowed = await fetch(`${baseUrl}/v1/catalog`, { headers: { origin: 'https://not-truly.invalid' } })
assert.equal(disallowed.status, 403)
assert.equal((await fetch(`${baseUrl}/v1/pairing/code/ZZZZZZ/extra`)).status, 404, 'Extra route segments cannot bypass target limits')
const tooLarge = await fetch(`${baseUrl}/v1/auth/challenges`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '学'.repeat(6000) }),
})
assert.equal(tooLarge.status, 413)
// Stress only the local development host; do not hammer a public deployment.
if (['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  const attempts = await Promise.all(Array.from({ length: 35 }, () => request('/v1/pairing/code/ZZZZZZ')))
  assert.ok(attempts.some((result) => result.status === 429), 'Repeated guesses are limited')
  assert.ok(attempts.some((result) => result.status === 404), 'Initial guesses reach the bounded lookup before throttling')
  const limited = await fetch(`${baseUrl}/v1/pairing/code/ZZZZZZ`)
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('retry-after'), '60')
}
console.log('PASS: pairing, scoped wallet control, device ownership/revocation, catalog, idempotent Path-to-Task activation, reviewed resources, wallet-owned Task listing, selected-desktop delivery, paid entitlement enforcement, CORS and rate limiting.')
console.log('API smoke tests use generated test wallets, not Nimiq Pay. No secrets are printed. Local test records remain in the ignored development database.')
