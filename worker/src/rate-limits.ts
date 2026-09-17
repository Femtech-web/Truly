import { HttpError } from './http'
import { normalizePairingCode, sha256 } from './security'
import type { Env } from './types'

// Persisted, atomic fixed-window counters: shared by all Worker instances.
export async function consumeLimit(
  env: Env,
  key: string,
  limit: number,
  now = Date.now(),
  windowMilliseconds = 60_000,
  message = 'Too many requests. Wait one minute, then try again.',
): Promise<void> {
  const window = Math.floor(now / windowMilliseconds)
  const row = await env.DB.prepare(`INSERT INTO rate_limit_windows (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = MIN(count + 1, ?) RETURNING count`)
    .bind(`${await sha256(`${key}:${windowMilliseconds}`)}:${window}`, (window + 1) * windowMilliseconds, limit + 1).first<{ count: number }>()
  if (!row || row.count > limit) throw new HttpError(429, 'rate_limited', message)
}

export async function rateLimit(request: Request, env: Env): Promise<void> {
  const path = new URL(request.url).pathname
  if (path === '/health') return
  // Cloudflare overwrites this header at the production edge. No X-Forwarded-For trust.
  const ip = request.headers.get('cf-connecting-ip') ?? 'local-development'
  await consumeLimit(env, `all:${ip}`, 240)
  if (path.startsWith('/v1/pairing/code/')) {
    await consumeLimit(env, `lookup:${ip}`, 30)
    await consumeLimit(env, `code:${normalizePairingCode(path.slice('/v1/pairing/code/'.length))}`, 60)
  } else if (path === '/v1/pairing/challenges' || path === '/v1/auth/challenges') {
    await consumeLimit(env, `create:${ip}`, 10)
  } else if (path.endsWith('/approve') || path.endsWith('/verify')) {
    await consumeLimit(env, `signature:${ip}`, 20)
    await consumeLimit(env, `signature-target:${path}`, 10)
  } else if (path.endsWith('/exchange')) {
    await consumeLimit(env, `exchange:${ip}`, 120)
    await consumeLimit(env, `exchange-target:${path}`, 60)
  }
}
