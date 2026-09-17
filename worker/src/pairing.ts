import { HttpError, json, readJson } from './http'
import {
  constantTimeEqual,
  normalizeNimiqAddress,
  normalizePairingCode,
  randomPairingCode,
  randomToken,
  sha256,
  verifyNimiqSignature,
} from './security'
import type { Env, PairingChallengeRow } from './types'
import { consumeLimit } from './rate-limits'

const challengeLifetimeMs = 5 * 60 * 1000
const desktopSessionLifetimeMs = 30 * 24 * 60 * 60 * 1000

interface CreateChallengeBody {
  installId?: string
  deviceName?: string
  platform?: string
}

interface ApproveChallengeBody {
  address?: string
  publicKey?: string
  signature?: string
}

interface ExchangeChallengeBody {
  exchangeSecret?: string
}

export function buildPairingMessage(input: {
  deviceName: string
  origin: string
  nonce: string
  expiresAt: string
}): string {
  return [
    'Truly · Approve this Mac',
    '',
    `Mac: ${input.deviceName}`,
    `From: ${input.origin}`,
    `Security code: ${input.nonce}`,
    `Valid until: ${input.expiresAt}`,
    '',
    'This connects Truly on this Mac to your wallet. It cannot send money.',
  ].join('\n')
}

export async function createChallenge(request: Request, env: Env): Promise<Response> {
  const body = await readJson<CreateChallengeBody>(request)
  const installId = cleanRequired(body.installId, 'installId', 80)
  const deviceName = cleanRequired(body.deviceName, 'deviceName', 80)
  const platform = cleanRequired(body.platform, 'platform', 40)
  await consumeLimit(env, `installation:${installId}`, 5)
  const now = Date.now()
  const expiresAt = new Date(now + challengeLifetimeMs).toISOString()
  const id = crypto.randomUUID()
  const code = randomPairingCode()
  const nonce = randomToken(24)
  const exchangeSecret = randomToken()
  const message = buildPairingMessage({
    deviceName,
    origin: env.PAIRING_ORIGIN,
    nonce,
    expiresAt,
  })

  await env.DB.prepare(
    `INSERT INTO pairing_challenges (
      id, device_install_id, device_name, platform, code_hash, nonce,
      exchange_secret_hash, miniapp_origin, message, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    installId,
    deviceName,
    platform,
    await sha256(code),
    nonce,
    await sha256(exchangeSecret),
    env.PAIRING_ORIGIN,
    message,
    expiresAt,
  ).run()

  return json({
    challengeId: id,
    code,
    exchangeSecret,
    expiresAt,
  }, { status: 201 })
}

export async function getChallengeByCode(codeValue: string, env: Env): Promise<Response> {
  const code = normalizePairingCode(codeValue)
  if (code.length !== 6) throw new HttpError(400, 'invalid_pairing_code', 'Enter the six-character code shown on your Mac.')

  const challenge = await env.DB.prepare(
    'SELECT * FROM pairing_challenges WHERE code_hash = ? LIMIT 1',
  ).bind(await sha256(code)).first<PairingChallengeRow>()

  if (!challenge) throw new HttpError(404, 'pairing_not_found', 'That pairing code was not found.')
  await assertPending(challenge, env)

  return json({
    challengeId: challenge.id,
    deviceName: challenge.device_name,
    platform: challenge.platform,
    origin: challenge.miniapp_origin,
    message: challenge.message,
    expiresAt: challenge.expires_at,
  })
}

export async function approveChallenge(id: string, request: Request, env: Env): Promise<Response> {
  const body = await readJson<ApproveChallengeBody>(request)
  const address = cleanRequired(body.address, 'address', 80)
  const publicKey = cleanHex(body.publicKey, 'publicKey', 64)
  const signature = cleanHex(body.signature, 'signature', 128)
  const challenge = await challengeById(id, env)
  await assertPending(challenge, env)

  if (!await verifyNimiqSignature({ address, publicKey, signature, message: challenge.message })) {
    throw new HttpError(401, 'invalid_pairing_signature', 'Nimiq Pay could not approve this Mac. Try again.')
  }

  const normalizedAddress = normalizeNimiqAddress(address)
  const existingDevice = await env.DB.prepare(
    'SELECT id FROM devices WHERE wallet_address = ? AND install_id = ? LIMIT 1',
  ).bind(normalizedAddress, challenge.device_install_id).first<{ id: string }>()
  const deviceId = existingDevice?.id ?? crypto.randomUUID()
  const completedAt = new Date().toISOString()
  const approvalClaim = crypto.randomUUID()

  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE pairing_challenges
       SET status = 'approved', approved_wallet = ?, device_id = ?, public_key = ?, completed_at = ?, approval_claim = ?
       WHERE id = ? AND status = 'pending' AND expires_at > ?`,
    ).bind(normalizedAddress, deviceId, publicKey, completedAt, approvalClaim, id, completedAt),
    env.DB.prepare('INSERT OR IGNORE INTO wallet_accounts (nimiq_address) VALUES (?)').bind(normalizedAddress),
    env.DB.prepare(
      `INSERT INTO devices (id, wallet_address, install_id, name, platform, last_seen_at)
       SELECT ?, ?, ?, ?, ?, ? FROM pairing_challenges WHERE id = ? AND approval_claim = ?
       ON CONFLICT(wallet_address, install_id) DO UPDATE SET
         name = excluded.name,
         platform = excluded.platform,
         status = 'active',
         last_seen_at = excluded.last_seen_at,
         revoked_at = NULL`,
    ).bind(deviceId, normalizedAddress, challenge.device_install_id, challenge.device_name, challenge.platform, completedAt, id, approvalClaim),
    env.DB.prepare(`UPDATE desktop_sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL
      AND EXISTS (SELECT 1 FROM pairing_challenges WHERE id = ? AND approval_claim = ?)`)
      .bind(completedAt, deviceId, id, approvalClaim),
  ])

  const approvalResult = results.at(0)
  if (!approvalResult?.success || approvalResult.meta.changes !== 1) {
    throw new HttpError(409, 'pairing_already_used', 'This pairing request has already been completed.')
  }

  return json({
    status: 'approved',
    device: { id: deviceId, name: challenge.device_name, platform: challenge.platform },
  })
}

export async function exchangeChallenge(id: string, request: Request, env: Env): Promise<Response> {
  const body = await readJson<ExchangeChallengeBody>(request)
  const exchangeSecret = cleanRequired(body.exchangeSecret, 'exchangeSecret', 128)
  const challenge = await challengeById(id, env)

  if (!constantTimeEqual(await sha256(exchangeSecret), challenge.exchange_secret_hash)) {
    throw new HttpError(401, 'invalid_exchange_secret', 'This pairing request is no longer valid. Create a new code.')
  }

  if ((challenge.status === 'pending' || challenge.status === 'approved') && Date.parse(challenge.expires_at) <= Date.now()) {
    await expireChallenge(challenge.id, env)
    throw new HttpError(410, 'pairing_expired', 'This pairing code expired. Create a new one on your Mac.')
  }

  if (challenge.status === 'pending') {
    return json({ status: 'pending', expiresAt: challenge.expires_at })
  }

  if (challenge.status !== 'approved' || !challenge.device_id || !challenge.approved_wallet) {
    throw new HttpError(409, 'pairing_not_exchangeable', 'This pairing request is no longer available. Create a new code.')
  }

  const token = randomToken(48)
  const sessionId = crypto.randomUUID()
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + desktopSessionLifetimeMs).toISOString()
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE pairing_challenges SET status = 'exchanged', exchanged_at = ?, exchange_claim = ?
       WHERE id = ? AND status = 'approved' AND expires_at > ?
         AND EXISTS (SELECT 1 FROM devices WHERE devices.id = pairing_challenges.device_id AND status = 'active')`,
    ).bind(now, sessionId, id, now),
    env.DB.prepare(
      `INSERT INTO desktop_sessions (id, device_id, token_hash, expires_at)
       SELECT ?, ?, ?, ? FROM pairing_challenges WHERE id = ? AND exchange_claim = ?`,
    ).bind(sessionId, challenge.device_id, await sha256(token), expiresAt, id, sessionId),
  ])

  const exchangeResult = results.at(0)
  if (!exchangeResult?.success || exchangeResult.meta.changes !== 1) {
    throw new HttpError(409, 'pairing_already_exchanged', 'This Mac has already been paired with this code.')
  }

  return json({
    status: 'paired',
    token,
    expiresAt,
    walletAddress: challenge.approved_wallet,
    device: { id: challenge.device_id, name: challenge.device_name, platform: challenge.platform },
  })
}

export async function cancelChallenge(id: string, request: Request, env: Env): Promise<Response> {
  const body = await readJson<ExchangeChallengeBody>(request)
  const secret = cleanRequired(body.exchangeSecret, 'exchangeSecret', 128)
  const challenge = await challengeById(id, env)
  if (!constantTimeEqual(await sha256(secret), challenge.exchange_secret_hash)) {
    throw new HttpError(401, 'invalid_exchange_secret', 'Truly could not cancel this pairing request. Create a new code if needed.')
  }
  await env.DB.prepare("UPDATE pairing_challenges SET status = 'cancelled' WHERE id = ? AND status IN ('pending', 'approved')")
    .bind(id).run()
  return json({ status: 'cancelled' })
}

async function challengeById(id: string, env: Env): Promise<PairingChallengeRow> {
  const challenge = await env.DB.prepare(
    'SELECT * FROM pairing_challenges WHERE id = ? LIMIT 1',
  ).bind(id).first<PairingChallengeRow>()
  if (!challenge) throw new HttpError(404, 'pairing_not_found', 'This pairing request was not found.')
  return challenge
}

async function assertPending(challenge: PairingChallengeRow, env: Env): Promise<void> {
  if (Date.parse(challenge.expires_at) <= Date.now()) {
    await expireChallenge(challenge.id, env)
    throw new HttpError(410, 'pairing_expired', 'This pairing code expired. Create a new one on your Mac.')
  }
  if (challenge.status !== 'pending') {
    throw new HttpError(409, 'pairing_unavailable', 'This pairing code has already been used or cancelled.')
  }
}

async function expireChallenge(id: string, env: Env): Promise<void> {
  await env.DB.prepare(
    "UPDATE pairing_challenges SET status = 'expired' WHERE id = ? AND status IN ('pending', 'approved')",
  ).bind(id).run()
}

function cleanRequired(value: string | undefined, field: string, maxLength: number): string {
  const cleaned = typeof value === 'string' ? value.trim() : ''
  if (!cleaned) throw new HttpError(400, 'invalid_request', `${field} is required.`)
  if (cleaned.length > maxLength) throw new HttpError(400, 'invalid_request', `${field} is too long.`)
  if (/[\u0000-\u001f\u007f]/.test(cleaned)) throw new HttpError(400, 'invalid_request', `${field} contains invalid control characters.`)
  return cleaned
}

function cleanHex(value: string | undefined, field: string, expectedLength: number): string {
  const cleaned = cleanRequired(value, field, expectedLength)
  if (cleaned.length !== expectedLength || !/^[a-fA-F0-9]+$/.test(cleaned)) {
    throw new HttpError(400, 'invalid_request', `${field} must be ${expectedLength} hexadecimal characters.`)
  }
  return cleaned
}
