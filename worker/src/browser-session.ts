import { HttpError, json } from './http'
import { sha256 } from './security'
import type { Env } from './types'

const cookieName = 'truly_access'

// The custom header prevents simple form/image CSRF; CORS admits only configured apps.
export function requireBrowserOrigin(request: Request, env: Env): void {
  const origin = request.headers.get('origin')
  const allowed = env.ALLOWED_ORIGINS.split(',').map(value => value.trim())
  const sameOrigin = request.headers.get('sec-fetch-site') === 'same-origin'
    && allowed.includes(new URL(request.url).origin)
  if (request.headers.get('x-truly-browser') !== '1' || !(origin ? allowed.includes(origin) : sameOrigin)) {
    throw new HttpError(403, 'browser_origin_required', 'Open Truly from its approved app address.')
  }
}

export function browserToken(request: Request, env: Env): string {
  requireBrowserOrigin(request, env)
  const value = (request.headers.get('cookie') ?? '').split(';').map(item => item.trim())
    .find(item => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? ''
  return /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : ''
}

export function browserCookie(env: Env, token: string, expiresAt?: string): string {
  const secure = new URL(env.PAIRING_ORIGIN).protocol === 'https:' ? '; Secure' : ''
  const age = expiresAt ? Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)) : 0
  return `${cookieName}=${token}; Path=/v1; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`
}

export async function readBrowserSession(request: Request, env: Env): Promise<Response> {
  const token = browserToken(request, env)
  const session = token ? await env.DB.prepare('SELECT wallet_address, expires_at, scopes FROM wallet_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256(token), new Date().toISOString()).first<{ wallet_address: string; expires_at: string; scopes: string }>() : null
  if (!session) return json({ session: null }, { headers: { 'set-cookie': browserCookie(env, '') } })
  return json({ session: { account: session.wallet_address, expiresAt: session.expires_at, scopes: session.scopes.split(' ') } })
}

export async function logoutBrowserSession(request: Request, env: Env): Promise<Response> {
  const token = browserToken(request, env)
  if (token) await env.DB.prepare('DELETE FROM wallet_sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  return json({ status: 'disconnected' }, { headers: { 'set-cookie': browserCookie(env, '') } })
}
