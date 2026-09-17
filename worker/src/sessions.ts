import { HttpError, json } from './http'
import { sha256 } from './security'
import type { Env } from './types'

export interface DesktopIdentity {
  deviceId: string
  deviceName: string
  walletAddress: string
  expiresAt: string
}

export async function authenticateDesktop(request: Request, env: Env): Promise<DesktopIdentity> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'session_required', 'Pair this Mac to continue.')
  const token = authorization.slice(7)
  if (token.length > 128) throw new HttpError(401, 'invalid_session', 'This Mac needs to be paired again.')
  const session = await env.DB.prepare(
    `SELECT devices.id AS deviceId, devices.name AS deviceName, devices.wallet_address AS walletAddress,
            desktop_sessions.expires_at AS expiresAt
     FROM desktop_sessions JOIN devices ON devices.id = desktop_sessions.device_id
     WHERE desktop_sessions.token_hash = ? AND desktop_sessions.revoked_at IS NULL
       AND desktop_sessions.expires_at > ? AND devices.status = 'active' LIMIT 1`,
  ).bind(await sha256(token), new Date().toISOString()).first<DesktopIdentity>()
  if (!session) throw new HttpError(401, 'invalid_session', 'This Mac is no longer connected. Pair it again to continue.')
  return session
}

export async function getDesktopSession(request: Request, env: Env): Promise<Response> {
  return json(await authenticateDesktop(request, env))
}
