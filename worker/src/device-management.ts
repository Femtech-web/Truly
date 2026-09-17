import { HttpError, json, readJson } from './http'
import { normalizeNimiqAddress, randomToken, sha256, verifyNimiqSignature } from './security'
import type { Env } from './types'

const walletControlScopes = 'devices:read devices:revoke learning:read learning:activate tasks:read tasks:create'

export async function createWalletChallenge(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ address?: string }>(request)
  if (typeof body.address !== 'string' || body.address.length > 80) throw new HttpError(400, 'invalid_address', 'Choose a Nimiq wallet.')
  const address = normalizeNimiqAddress(body.address)
  if (!/^NQ\d{2}[0-9A-Z]{32}$/.test(address)) throw new HttpError(400, 'invalid_address', 'Choose a valid Nimiq address.')
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
  const message = ['Truly · Approve access', '', `Wallet: ${address}`, `Truly app: ${env.PAIRING_ORIGIN}`,
    `Security code: ${randomToken(24)}`, `Valid until: ${expiresAt}`, '',
    'For 15 minutes, this lets Truly show and remove connected Macs, show and create your private Tasks, and start the Task or Path you choose. It cannot send money.'].join('\n')
  await env.DB.prepare('INSERT INTO wallet_auth_challenges (id, wallet_address, message, expires_at, scopes) VALUES (?, ?, ?, ?, ?)')
    .bind(id, address, message, expiresAt, walletControlScopes).run()
  return json({ challengeId: id, message, expiresAt, origin: env.PAIRING_ORIGIN, scopes: walletControlScopes.split(' ') }, { status: 201 })
}

export async function verifyWalletChallenge(id: string, request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ publicKey?: string; signature?: string }>(request)
  if (typeof body.publicKey !== 'string' || !/^[a-f0-9]{64}$/i.test(body.publicKey) ||
      typeof body.signature !== 'string' || !/^[a-f0-9]{128}$/i.test(body.signature)) {
    throw new HttpError(400, 'invalid_signature', 'Approve this action in Nimiq Pay and try again.')
  }
  const challenge = await env.DB.prepare('SELECT * FROM wallet_auth_challenges WHERE id = ?')
    .bind(id).first<{ wallet_address: string; message: string; expires_at: string; consumed_at: string | null; scopes: string }>()
  if (!challenge) throw new HttpError(404, 'challenge_not_found', 'Start Truly access approval again.')
  if (challenge.consumed_at) throw new HttpError(409, 'challenge_used', 'This approval was already used.')
  if (Date.parse(challenge.expires_at) <= Date.now()) throw new HttpError(410, 'challenge_expired', 'This approval expired. Try again.')
  if (!await verifyNimiqSignature({ address: challenge.wallet_address, message: challenge.message,
    publicKey: body.publicKey, signature: body.signature })) throw new HttpError(401, 'invalid_signature', 'Nimiq Pay could not approve this action. Try again.')
  const now = new Date().toISOString()
  const sessionId = crypto.randomUUID()
  const token = randomToken(48)
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString()
  const results = await env.DB.batch([
    env.DB.prepare('UPDATE wallet_auth_challenges SET consumed_at = ?, claim = ? WHERE id = ? AND consumed_at IS NULL AND expires_at > ?')
      .bind(now, sessionId, id, now),
    env.DB.prepare('INSERT OR IGNORE INTO wallet_accounts (nimiq_address) VALUES (?)').bind(challenge.wallet_address),
    env.DB.prepare(`INSERT INTO wallet_sessions (id, wallet_address, token_hash, expires_at, scopes)
      SELECT ?, wallet_address, ?, ?, scopes FROM wallet_auth_challenges WHERE id = ? AND claim = ?`)
      .bind(sessionId, await sha256(token), expiresAt, id, sessionId),
  ])
  if (results[0]?.meta.changes !== 1) throw new HttpError(409, 'challenge_used', 'This approval was already used.')
  return json({ token, expiresAt, scopes: challenge.scopes.split(' ') })
}

export interface WalletControlIdentity { walletAddress: string; scopes: Set<string> }

export async function requireWallet(request: Request, env: Env, requiredScope: string): Promise<WalletControlIdentity> {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token || token.length > 128) throw new HttpError(401, 'wallet_session_required', 'Approve this action with your wallet.')
  const session = await env.DB.prepare('SELECT wallet_address, scopes FROM wallet_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256(token), new Date().toISOString()).first<{ wallet_address: string; scopes: string }>()
  if (!session) throw new HttpError(401, 'wallet_session_expired', 'Your approval expired. Approve again.')
  const scopes = new Set(session.scopes.split(' ').filter(Boolean))
  if (!scopes.has(requiredScope)) throw new HttpError(403, 'wallet_scope_required', 'Approve this action with your wallet.')
  return { walletAddress: session.wallet_address, scopes }
}

export async function listDevices(request: Request, env: Env): Promise<Response> {
  const { walletAddress: wallet } = await requireWallet(request, env, 'devices:read')
  const rows = await env.DB.prepare(`SELECT id, name, platform, status, created_at AS createdAt, revoked_at AS revokedAt
    FROM devices WHERE wallet_address = ? ORDER BY created_at DESC`).bind(wallet).all()
  return json({ devices: rows.results })
}

export async function revokeDevice(id: string, request: Request, env: Env): Promise<Response> {
  const { walletAddress: wallet } = await requireWallet(request, env, 'devices:revoke')
  const owned = await env.DB.prepare('SELECT id FROM devices WHERE id = ? AND wallet_address = ?').bind(id, wallet).first()
  if (!owned) throw new HttpError(404, 'device_not_found', 'This Mac is no longer connected to your wallet.')
  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare("UPDATE devices SET status = 'revoked', revoked_at = COALESCE(revoked_at, ?) WHERE id = ? AND wallet_address = ?").bind(now, id, wallet),
    env.DB.prepare('UPDATE desktop_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE device_id = ?').bind(now, id),
    env.DB.prepare("UPDATE pairing_challenges SET status = 'cancelled' WHERE device_id = ? AND status = 'approved'").bind(id),
  ])
  return json({ status: 'revoked', deviceId: id })
}
