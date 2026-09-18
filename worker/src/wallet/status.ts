import { requireWallet } from '../device-management'
import { HttpError, json } from '../http'
import { readBoundedText } from '../learning/groq'
import { normalizeNimiqAddress } from '../security'
import type { Env } from '../types'
import { NIMIQ_MAINNET, rpcUrl } from '../payments/config'

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
  network: 'nimiq-mainnet'
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
    let nextId = 0
    async function rpc(method: string, params: unknown[]): Promise<RecordValue> {
      const id = ++nextId
      const response = await fetcher(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: controller.signal, redirect: 'manual',
      })
      if (!response.ok) throw new Error('RPC unavailable')
      const payload = object(JSON.parse(await readBoundedText(response, 32_000)))
      if (payload.jsonrpc !== '2.0' || payload.id !== id || payload.error) throw new Error('invalid RPC response')
      return object(payload.result)
    }
    const head = object((await rpc('getLatestBlock', [false])).data)
    if (head.network !== NIMIQ_MAINNET.rpcNetwork) throw new Error('unexpected Nimiq network')
    const result = await rpc('getAccountByAddress', [address])
    const account = object(result.data)
    const metadata = object(result.metadata)
    if (normalizeNimiqAddress(String(account.address ?? '')) !== normalizeNimiqAddress(address)) {
      throw new Error('invalid RPC address')
    }
    return {
      network: NIMIQ_MAINNET.orderNetwork,
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
