import { HttpError, json, readJson } from './http'
import { normalizeNimiqAddress, randomToken, sha256, verifyNimiqSignature } from './security'
import type { Env } from './types'
import { browserCookie, browserToken, requireBrowserOrigin } from './browser-session'
import { isReviewer } from './reviewer'

const walletControlScopes = 'devices:read devices:revoke learning:read learning:activate tasks:read tasks:create tasks:edit purchases:read purchases:write'

export async function createWalletChallenge(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ address?: string; purpose?: string }>(request)
  if (typeof body.address !== 'string' || body.address.length > 80) throw new HttpError(400, 'invalid_address', 'Choose a Nimiq wallet.')
  const address = normalizeNimiqAddress(body.address)
  if (!/^NQ\d{2}[0-9A-Z]{32}$/.test(address)) throw new HttpError(400, 'invalid_address', 'Choose a valid Nimiq address.')
  if (body.purpose !== undefined && !['studio', 'review'].includes(body.purpose)) throw new HttpError(400, 'invalid_auth_purpose', 'Choose a supported approval.')
  const studio = body.purpose === 'studio'
  const reviewing = body.purpose === 'review'
  if (studio && await env.DB.prepare("SELECT id FROM creators WHERE nimiq_address = ? AND status = 'suspended'").bind(address).first())
    throw new HttpError(403, 'creator_suspended', 'Creator access for this wallet is suspended.')
  if (reviewing && !isReviewer(address, env)) throw new HttpError(403, 'reviewer_required', 'This wallet is not an authorized reviewer.')
  const scopes = studio ? `${walletControlScopes} studio:read studio:write` : reviewing ? `${walletControlScopes} review:read review:write` : walletControlScopes
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
  const message = [studio ? 'Truly · Approve Creator Studio' : reviewing ? 'Truly · Approve Path reviews' : 'Truly · Approve access', '', `Wallet: ${address}`, `Truly app: ${env.PAIRING_ORIGIN}`,
    `Security code: ${randomToken(24)}`, `Valid until: ${expiresAt}`, '',
    'For 15 minutes, this lets Truly show and remove connected Macs, show and create your private Tasks, edit personal Tasks before they start, start the Task or Path you choose, and prepare and check your Path purchases. This sign-in can resume when you return to Truly until it expires or you disconnect. It cannot send money. Every payment needs a separate Nimiq Pay approval.',
    ...(studio ? ['It also creates your public creator profile and lets you edit it, save and submit your own private Paths for review. It cannot publish without separate approval or read other learners’ private Tasks. Your signed Nimiq address is your NIM payment recipient.'] : []),
    ...(reviewing ? ['It also lets you read submitted Path snapshots and approve publication or reject them with notes. Each review decision requires your deliberate action in Truly. It cannot read other learners’ private Tasks or send money.'] : [])].join('\n')
  await env.DB.prepare('INSERT INTO wallet_auth_challenges (id, wallet_address, message, expires_at, scopes) VALUES (?, ?, ?, ?, ?)')
    .bind(id, address, message, expiresAt, scopes).run()
  return json({ challengeId: id, message, expiresAt, origin: env.PAIRING_ORIGIN, scopes: scopes.split(' ') }, { status: 201 })
}

export async function verifyWalletChallenge(id: string, request: Request, env: Env): Promise<Response> {
  const browser = request.headers.get('x-truly-browser') === '1'
  if (browser) requireBrowserOrigin(request, env)
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
  const studio = challenge.scopes.split(' ').includes('studio:write')
  if (studio && await env.DB.prepare("SELECT id FROM creators WHERE nimiq_address = ? AND status = 'suspended'").bind(challenge.wallet_address).first())
    throw new HttpError(403, 'creator_suspended', 'Creator access for this wallet is suspended.')
  if (challenge.scopes.split(' ').includes('review:write') && !isReviewer(challenge.wallet_address, env))
    throw new HttpError(403, 'reviewer_required', 'This wallet is no longer an authorized reviewer.')
  if (!await verifyNimiqSignature({ address: challenge.wallet_address, message: challenge.message,
    publicKey: body.publicKey, signature: body.signature })) throw new HttpError(401, 'invalid_signature', 'The signature did not match the selected wallet. Select that account in Nimiq Pay and try again.')
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
    ...(studio ? [env.DB.prepare(`INSERT OR IGNORE INTO creators (id, nimiq_address, slug, display_name, status)
      SELECT ?, wallet_address, ?, 'New creator', 'active' FROM wallet_auth_challenges WHERE id = ? AND claim = ?`)
      .bind(`creator_${challenge.wallet_address.toLowerCase()}`, `creator-${challenge.wallet_address.toLowerCase()}`, id, sessionId)] : []),
  ])
  if (results[0]?.meta.changes !== 1) throw new HttpError(409, 'challenge_used', 'This approval was already used.')
  return json({ token, expiresAt, scopes: challenge.scopes.split(' ') }, browser
    ? { headers: { 'set-cookie': browserCookie(env, token, expiresAt) } } : {})
}

export interface WalletControlIdentity { walletAddress: string; scopes: Set<string> }

export async function requireWallet(request: Request, env: Env, requiredScope: string): Promise<WalletControlIdentity> {
  const authorization = request.headers.get('authorization') ?? ''
  // Never fall back to a cookie when an explicit, invalid Authorization was supplied.
  const token = authorization ? (authorization.startsWith('Bearer ') ? authorization.slice(7) : '')
    : request.headers.get('cookie') ? browserToken(request, env) : ''
  if (!token || token.length > 128) throw new HttpError(401, 'wallet_session_required', 'Approve this action with your wallet.')
  const session = await env.DB.prepare('SELECT wallet_address, scopes FROM wallet_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256(token), new Date().toISOString()).first<{ wallet_address: string; scopes: string }>()
  if (!session) throw new HttpError(401, 'wallet_session_expired', 'Your approval expired. Approve again.')
  if ((!authorization || request.headers.has('x-truly-account')) && normalizeNimiqAddress(request.headers.get('x-truly-account') ?? '') !== session.wallet_address) {
    throw new HttpError(401, 'wallet_changed', 'Your wallet changed. Reconnect before continuing.')
  }
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
