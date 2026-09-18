import { requireWallet } from '../device-management'
import { HttpError, json } from '../http'
import { readBoundedText } from '../learning/groq'
import { normalizeNimiqAddress } from '../security'
import type { Env } from '../types'
import { rpcUrl } from '../payments/config'

type RecordValue = Record<string, unknown>

function object(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid RPC object')
  return value as RecordValue
}

function unsignedInteger(value: unknown, label: string): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value)
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value)
  throw new Error(`invalid RPC ${label}`)
}

export interface NimiqWalletStatus {
  network: 'nimiq-testnet'
  availableAtomic: string
  observedAtBlock: string
}

/** Reads public chain state only. It never represents Nimiq Pay's local sync state. */
export async function readNimiqWalletStatus(
  url: string,
  address: string,
  fetcher: typeof fetch = fetch,
): Promise<NimiqWalletStatus> {
  const controller = new AbortController()
  // The public history node occasionally needs more than ten seconds on a
  // cold request. Stay below the Mini App's 25-second request deadline.
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountByAddress', params: [address] }),
      signal: controller.signal,
      redirect: 'manual',
    })
    if (!response.ok) throw new Error('RPC unavailable')
    const payload = object(JSON.parse(await readBoundedText(response, 32_000)))
    if (payload.jsonrpc !== '2.0' || payload.id !== 1 || payload.error) throw new Error('invalid RPC response')
    const result = object(payload.result)
    const account = object(result.data)
    const metadata = object(result.metadata)
    if (normalizeNimiqAddress(String(account.address ?? '')) !== normalizeNimiqAddress(address)) {
      throw new Error('invalid RPC address')
    }
    return {
      network: 'nimiq-testnet',
      availableAtomic: unsignedInteger(account.balance, 'balance').toString(),
      observedAtBlock: unsignedInteger(metadata.blockNumber, 'block height').toString(),
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function getWalletStatus(request: Request, env: Env): Promise<Response> {
  const { walletAddress } = await requireWallet(request, env, 'devices:read')
  try {
    return json(await readNimiqWalletStatus(rpcUrl(env.NIM_RPC_URL), walletAddress))
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'wallet_status_unavailable', 'Available balance could not be checked. Open Nimiq Pay to view your funds.')
  }
}
