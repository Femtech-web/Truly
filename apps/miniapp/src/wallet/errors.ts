import type { ErrorResponse } from '@nimiq/mini-app-sdk'

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return Boolean(
    value
      && typeof value === 'object'
      && 'error' in value
      && typeof (value as ErrorResponse).error?.message === 'string',
  )
}

export function getWalletError(error: unknown) {
  if (isErrorResponse(error)) return error.error.message
  if (error instanceof Error && error.message) return error.message
  return 'The wallet could not be reached. Please try again.'
}

export function wasRejected(error: unknown) {
  const message = getWalletError(error).toLowerCase()
  return message.includes('reject') || message.includes('cancel') || message.includes('denied')
}
