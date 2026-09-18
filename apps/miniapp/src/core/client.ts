const configuredCoreUrl = import.meta.env.VITE_TRULY_CORE_URL?.trim()
  || (import.meta.env.PROD ? window.location.origin : '')

interface CoreProblem {
  error?: {
    code?: string
    message?: string
  }
}

export interface PairingPreview {
  challengeId: string
  deviceName: string
  platform: string
  message: string
  expiresAt: string
  origin: string
}

export interface PairedDevice {
  status: 'approved'
  device: {
    id: string
    name: string
    platform: string
  }
}

export class CoreRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

export function hasCoreConfiguration(): boolean {
  return Boolean(configuredCoreUrl)
}

export async function findPairing(code: string): Promise<PairingPreview> {
  return coreRequest<PairingPreview>(`/v1/pairing/code/${encodeURIComponent(code)}`)
}

export async function approvePairing(input: {
  challengeId: string
  address: string
  publicKey: string
  signature: string
}): Promise<PairedDevice> {
  return coreRequest<PairedDevice>(`/v1/pairing/challenges/${input.challengeId}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      address: input.address,
      publicKey: input.publicKey,
      signature: input.signature,
    }),
  })
}

export async function coreRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!configuredCoreUrl) {
    throw new Error('Truly cannot connect right now. Check the app setup and try again.')
  }

  let response: Response
  try {
    const headers = new Headers(init?.headers)
    headers.set('x-truly-browser', '1')
    response = await fetch(`${configuredCoreUrl.replace(/\/$/, '')}${path}`, {
      ...init, headers, credentials: 'include', signal: init?.signal ?? AbortSignal.timeout(25_000),
    })
  } catch {
    throw new Error('Truly could not connect. Check your connection and try again.')
  }
  const body = await response.json() as T & CoreProblem

  if (!response.ok) {
    throw new CoreRequestError(response.status, body.error?.code || 'request_failed', body.error?.message || 'Truly could not finish that. Please try again.')
  }

  return body
}
