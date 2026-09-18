import { isAddress } from 'viem'
import { HttpError } from '../http'
import { normalizeNimiqAddress } from '../security'
import type { Env } from '../types'

export const POLYGON_USDT = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
export type PaymentAsset = 'NIM' | 'USDT'
export function rpcUrl(value?: string): string {
  try {
    const url = new URL(value ?? '')
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error()
    return url.toString()
  } catch { throw new HttpError(503, 'payments_unavailable', 'Payments are not available yet. Your saved work is safe.') }
}
export function paymentConfiguration(env: Env, asset: PaymentAsset) {
  if (asset === 'NIM' && env.NIM_PAYMENTS_ENABLED === 'true' && isNimiqAddress(env.NIM_PAYMENT_RECIPIENT ?? '') &&
      !/^NQ\d{2}0{32}$/.test(normalizeNimiqAddress(env.NIM_PAYMENT_RECIPIENT!))) {
    return { network: 'nimiq-testnet' as const, rpc: rpcUrl(env.NIM_RPC_URL), recipient: normalizeNimiqAddress(env.NIM_PAYMENT_RECIPIENT!), decimals: 5, token: null }
  }
  if (asset === 'USDT' && env.USDT_PAYMENTS_ENABLED === 'true' && env.USDT_MAINNET_APPROVED === 'true' &&
      isAddress(env.USDT_PAYMENT_RECIPIENT ?? '', { strict: false }) && !/^0x0{40}$/i.test(env.USDT_PAYMENT_RECIPIENT!)) {
    return { network: 'polygon' as const, rpc: rpcUrl(env.POLYGON_RPC_URL), recipient: env.USDT_PAYMENT_RECIPIENT!.toLowerCase(), decimals: 6, token: POLYGON_USDT }
  }
  throw new HttpError(503, 'payments_unavailable', 'Payments are not available yet. Your saved work is safe.')
}
export function isNimiqAddress(value: string): boolean {
  const address = normalizeNimiqAddress(value)
  if (!/^NQ\d{2}[0-9A-HJ-NP-VXY]{32}$/.test(address)) return false
  let remainder = 0
  for (const character of address.slice(4) + address.slice(0, 4)) {
    const digits = /\d/.test(character) ? character : String(character.charCodeAt(0) - 55)
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}
