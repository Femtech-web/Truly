import { normalizeNimiqAddress } from './security'
import type { Env } from './types'

// Server configuration only: a creator cannot assign this role to themselves.
export function isReviewer(address: string, env: Env): boolean {
  const account = normalizeNimiqAddress(address)
  return (env.REVIEWER_WALLETS ?? '').split(',').map(normalizeNimiqAddress)
    .some(value => /^NQ\d{2}[0-9A-Z]{32}$/.test(value) && value === account)
}
