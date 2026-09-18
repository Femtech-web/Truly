import type { ErrorResponse } from '@nimiq/mini-app-sdk'

const MESSAGE_KEYS = ['message', 'reason', 'description', 'localizedDescription'] as const
const NESTED_ERROR_KEYS = ['error', 'cause'] as const

function readableMessage(value: unknown, depth = 0): string | null {
  if (typeof value === 'string') {
    const message = value.trim()
    return message ? message.slice(0, 300) : null
  }
  if (value instanceof Error) return readableMessage(value.message, depth)
  if (!value || typeof value !== 'object' || depth > 2) return null

  const record = value as Record<string, unknown>
  for (const key of MESSAGE_KEYS) {
    const message = readableMessage(record[key], depth + 1)
    if (message) return message
  }
  for (const key of NESTED_ERROR_KEYS) {
    const message = readableMessage(record[key], depth + 1)
    if (message) return message
  }
  return null
}

function readableCode(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const code = record.code ?? record.type
  return typeof code === 'string' && /^[A-Z][A-Z0-9_-]{1,48}$/.test(code)
    ? code
    : null
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return Boolean(
    value
      && typeof value === 'object'
      && 'error' in value
      && typeof (value as ErrorResponse).error?.message === 'string',
  )
}

export function getWalletError(
  error: unknown,
  fallback = 'Nimiq Pay could not complete the request. No payment was sent. Close and reopen Truly, then try again.',
) {
  const message = readableMessage(error)
  if (message) return message
  const code = readableCode(error)
  return code ? `Nimiq Pay could not complete the request (${code}). No payment was sent.` : fallback
}

export function getPaymentError(error: unknown, account: string) {
  const message = getWalletError(error)
  if (/sync(?:ing)? your account/i.test(message)) {
    const compactAccount = account.replace(/\s/g, '')
    const shortAccount = compactAccount.length > 12
      ? `${compactAccount.slice(0, 4)}…${compactAccount.slice(-4)}`
      : compactAccount
    return `Nimiq Pay could not prepare ${shortAccount} for this payment. In Nimiq Pay, make sure this account has enough available—not pending or staked—test NIM, then reopen Truly. No payment was sent.`
  }
  return message
}

export function wasRejected(error: unknown) {
  const message = getWalletError(error).toLowerCase()
  return message.includes('reject') || message.includes('cancel') || message.includes('denied')
}
