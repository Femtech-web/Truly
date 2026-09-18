import type { Env, JsonError } from './types'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  })
}

export function problem(status: number, code: string, message: string): Response {
  return json({ error: { code, message } } satisfies JsonError, { status })
}

export async function readJson<T>(request: Request, maxBytes = 16_384): Promise<T> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Truly could not read that request. Please try again.')
  }

  try {
    const reader = request.body?.getReader()
    if (!reader) throw new HttpError(400, 'invalid_json', 'Truly could not read that request. Please try again.')
    let size = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new HttpError(413, 'body_too_large', 'That request is too large. Please try again.')
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const value = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new HttpError(400, 'invalid_json', 'Truly could not read that request. Please try again.')
    }
    return value as T
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'invalid_json', 'Truly could not read that request. Please try again.')
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

function configuredOrigins(env: Env): Set<string> {
  return new Set(env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean))
}

export function withCors(request: Request, env: Env, response: Response): Response {
  const origin = request.headers.get('origin')
  if (!origin || !configuredOrigins(env).has(origin)) return response

  const next = new Response(response.body, response)
  next.headers.set('access-control-allow-origin', origin)
  next.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS')
  next.headers.set('access-control-allow-headers', 'content-type, authorization, idempotency-key, x-truly-consent-revision, x-truly-browser, x-truly-account')
  next.headers.set('access-control-allow-credentials', 'true')
  next.headers.set('access-control-max-age', '86400')
  next.headers.set('vary', 'Origin')
  return next
}

export function isOriginAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin')
  return !origin || configuredOrigins(env).has(origin)
}
