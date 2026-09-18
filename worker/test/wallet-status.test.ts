import { afterEach, describe, expect, it, vi } from 'vitest'
import { readNimiqWalletStatus } from '../src/wallet/status'

const account = 'NQ47GFC8SCHC7R9901CJY7971EMH22532AG1'

afterEach(() => vi.restoreAllMocks())

describe('read-only Nimiq wallet status', () => {
  it('returns the liquid balance and observation block without claiming wallet spendability', async () => {
    const fetcher = vi.fn(async (_url, options) => {
      const { id, method } = JSON.parse(String(options?.body))
      return Response.json({ jsonrpc: '2.0', id, result: method === 'getLatestBlock'
        ? { data: { network: 'MainAlbatross', number: 51_000_000 } }
        : { data: { address: account, balance: 11_000_000_000, type: 'basic' }, metadata: { blockNumber: 51_000_000, blockHash: 'a'.repeat(64) } } })
    }) as unknown as typeof fetch

    await expect(readNimiqWalletStatus('https://rpc.test', account, fetcher)).resolves.toEqual({
      network: 'nimiq-mainnet',
      availableAtomic: '11000000000',
      observedAtBlock: '51000000',
    })
    expect(fetcher).toHaveBeenCalledWith('https://rpc.test', expect.objectContaining({ redirect: 'manual' }))
  })

  it('rejects malformed balances instead of displaying untrusted RPC data', async () => {
    const fetcher = vi.fn(async (_url, options) => {
      const { id, method } = JSON.parse(String(options?.body))
      return Response.json({ jsonrpc: '2.0', id, result: method === 'getLatestBlock'
        ? { data: { network: 'MainAlbatross', number: 1 } }
        : { data: { address: account, balance: -1 }, metadata: { blockNumber: 1 } } })
    }) as unknown as typeof fetch

    await expect(readNimiqWalletStatus('https://rpc.test', account, fetcher)).rejects.toThrow('invalid RPC balance')
  })

  it('rejects a Testnet RPC instead of labelling its result as Mainnet', async () => {
    const fetcher = vi.fn(async (_url, options) => {
      const { id } = JSON.parse(String(options?.body))
      return Response.json({ jsonrpc: '2.0', id, result: { data: { network: 'TestAlbatross', number: 1 } } })
    }) as unknown as typeof fetch

    await expect(readNimiqWalletStatus('https://rpc.test', account, fetcher)).rejects.toThrow('unexpected Nimiq network')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
