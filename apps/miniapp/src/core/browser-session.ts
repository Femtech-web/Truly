import { coreRequest } from './client'

export interface BrowserSession { account: string; expiresAt: string; scopes: string[] }

export async function resumeBrowserSession(): Promise<BrowserSession | null> {
  const { session } = await coreRequest<{ session: BrowserSession | null }>('/v1/auth/session', { signal: AbortSignal.timeout(5000) })
  return session
}

export async function endBrowserSession(): Promise<void> {
  await coreRequest('/v1/auth/session/logout', { method: 'POST' })
}
