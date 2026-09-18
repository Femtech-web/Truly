import { afterEach, describe, expect, it, vi } from 'vitest'
import { readNimiqWalletStatus } from '../src/wallet/status'

const account = 'NQ47GFC8SCHC7R9901CJY7971EMH22532AG1'

afterEach(() => vi.restoreAllMocks())

describe('read-only Nimiq wallet status', () => {
  it('returns the liquid balance and observation block without claiming wallet spendability', async () => {
    const fetcher = vi.fn(async () => Response.json({
      jsonrpc: '2.0',
      id: 1,
      result: {
        data: { address: account, balance: 11_000_000_000, type: 'basic' },
        metadata: { blockNumber: 11_685_994, blockHash: 'a'.repeat(64) },
      },
    })) as unknown as typeof fetch

    await expect(readNimiqWalletStatus('https://rpc.test', account, fetcher)).resolves.toEqual({
      network: 'nimiq-testnet',
      availableAtomic: '11000000000',
      observedAtBlock: '11685994',
    })
    expect(fetcher).toHaveBeenCalledWith('https://rpc.test', expect.objectContaining({ redirect: 'manual' }))
  })

  it('rejects malformed balances instead of displaying untrusted RPC data', async () => {
    const fetcher = vi.fn(async () => Response.json({
      jsonrpc: '2.0', id: 1, result: { data: { address: account, balance: -1 }, metadata: { blockNumber: 1 } },
    })) as unknown as typeof fetch

    await expect(readNimiqWalletStatus('https://rpc.test', account, fetcher)).rejects.toThrow('invalid RPC balance')
  })
})
