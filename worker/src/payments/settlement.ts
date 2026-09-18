import { decodeEventLog, erc20Abi } from 'viem'
import { verifyAsync } from '@noble/ed25519'
import { blake2b } from '@noble/hashes/blake2.js'
import { HttpError } from '../http'
import { readBoundedText } from '../learning/groq'
import { nimiqAddressFromPublicKey, normalizeNimiqAddress } from '../security'
import type { PaymentOrder } from './protocol'

type RecordValue = Record<string, unknown>
function object(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid RPC object')
  return value as RecordValue
}
function integer(value: unknown): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value)
  if (typeof value === 'string' && /^(0x[0-9a-f]+|\d+)$/i.test(value)) return BigInt(value)
  throw new Error('invalid RPC integer')
}
const invalid = () => new HttpError(422, 'payment_mismatch', 'This payment does not match your purchase. No access was granted. Contact support before paying again.')
export interface Settlement { blockNumber: string; blockHash: string }
export interface LocatedNimSettlement extends Settlement { transactionHash: string }

function hexBytes(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})*$/i.test(value)) throw new Error('invalid transaction bytes')
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  return bytes
}

function addressBytes(value: unknown): Uint8Array {
  const address = normalizeNimiqAddress(String(value))
  if (!/^NQ\d{2}[0-9A-Z]{32}$/.test(address)) throw new Error('invalid Nimiq address')
  const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVXY'
  const output = new Uint8Array(20)
  let accumulator = 0, bits = 0, offset = 0
  for (const character of address.slice(4)) {
    const digit = alphabet.indexOf(character)
    if (digit < 0) throw new Error('invalid Nimiq address')
    accumulator = (accumulator << 5) | digit
    bits += 5
    if (bits >= 8) {
      output[offset++] = (accumulator >>> (bits - 8)) & 0xff
      bits -= 8
    }
  }
  if (offset !== 20 || bits !== 0) throw new Error('invalid Nimiq address')
  return output
}

function unsignedBytes(value: bigint, length: number): Uint8Array {
  if (value < 0n || value >= (1n << BigInt(length * 8))) throw new Error('integer out of range')
  const output = new Uint8Array(length)
  for (let index = length - 1; index >= 0; index--) { output[index] = Number(value & 0xffn); value >>= 8n }
  return output
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.length }
  return output
}

function transactionContent(tx: RecordValue): Uint8Array {
  const data = hexBytes(tx.recipientData ?? tx.data ?? '')
  const senderData = hexBytes(tx.senderData ?? '')
  if (data.length > 0xffff || senderData.length !== 0) throw new Error('unsupported transaction data')
  return concat(
    unsignedBytes(BigInt(data.length), 2), data,
    addressBytes(tx.from), Uint8Array.of(Number(tx.fromType)),
    addressBytes(tx.to), Uint8Array.of(Number(tx.toType)),
    unsignedBytes(integer(tx.value), 8), unsignedBytes(integer(tx.fee), 8),
    unsignedBytes(integer(tx.validityStartHeight), 4), Uint8Array.of(Number(tx.networkId), Number(tx.flags), 0),
  )
}

function standardProof(bytes: Uint8Array, offset: number) {
  if (bytes[offset] !== 0 || bytes[offset + 33] !== 0 || offset + 98 > bytes.length) throw new Error('unsupported signature proof')
  return { publicKey: bytes.slice(offset + 1, offset + 33), signature: bytes.slice(offset + 34, offset + 98), next: offset + 98 }
}

/**
 * Nimiq Pay can spend funds held in a vesting or HTLC account. In that case
 * the on-chain `from` address is the contract, not the wallet. Reconstruct and
 * verify the transaction before accepting a signer embedded in its proof.
 */
export async function nimiqTransactionAuthorizesPayer(tx: RecordValue, payer: string): Promise<boolean> {
  const expected = normalizeNimiqAddress(payer)
  if (tx.fromType === 0) return normalizeNimiqAddress(String(tx.from)) === expected
  if (![1, 2, 3].includes(Number(tx.fromType))) return false
  try {
    const content = transactionContent(tx)
    const hash = Array.from(blake2b(content, { dkLen: 32 }), byte => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== tx.hash) return false
    const proof = hexBytes(tx.proof)
    const signatures = Number(tx.fromType) === 2 && proof[0] === 1
      ? [standardProof(proof, 1), standardProof(proof, 99)]
      : [standardProof(proof, 0)]
    if (signatures.at(-1)?.next !== proof.length) return false
    for (const signature of signatures) {
      if (!await verifyAsync(signature.signature, content, signature.publicKey, { zip215: false })) return false
    }
    return signatures.some(signature => normalizeNimiqAddress(nimiqAddressFromPublicKey(signature.publicKey)) === expected)
  } catch {
    return false
  }
}

export function dataCarriesOrderId(data: unknown, orderId: string): boolean {
  if (typeof data !== 'string' || !data) return false
  const source = data.toLowerCase()
  const expected = orderId.toLowerCase()
  if (source.includes(expected)) return true
  if (!/^[0-9a-f]+$/.test(source) || source.length % 2 !== 0) return false
  try {
    const bytes = new Uint8Array(source.length / 2)
    for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(source.slice(index * 2, index * 2 + 2), 16)
    return new TextDecoder().decode(bytes).toLowerCase().includes(expected)
  } catch { return false }
}

export async function verifyNimSettlementByOrder(order: PaymentOrder, url: string, fetcher: typeof fetch = fetch): Promise<LocatedNimSettlement | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 22_000)
  let nextId = 0
  async function rpc(method: string, params: unknown[]): Promise<unknown> {
    const id = ++nextId
    const response = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: controller.signal, redirect: 'manual' })
    if (!response.ok) throw new Error('RPC unavailable')
    const payload = object(JSON.parse(await readBoundedText(response, 256_000)))
    if (payload.id !== id || payload.jsonrpc !== '2.0' || payload.error) throw new Error('invalid RPC response')
    return object(payload.result).data
  }
  try {
    const [consensus, latest, history] = await Promise.all([
      rpc('isConsensusEstablished', []), rpc('getLatestBlock', [false]), rpc('getTransactionsByAddress', [order.recipient, 50, null]),
    ])
    if (consensus !== true) return null
    const head = object(latest)
    if (head.network !== 'TestAlbatross') throw invalid()
    if (!Array.isArray(history)) throw new Error('invalid transaction history')
    let match: RecordValue | undefined
    for (const candidate of history.map(object)) {
      if (dataCarriesOrderId(candidate.recipientData ?? candidate.data, order.id)
        && typeof candidate.hash === 'string' && /^[0-9a-f]{64}$/.test(candidate.hash)
        && candidate.executionResult === true && candidate.networkId === 5
        && await nimiqTransactionAuthorizesPayer(candidate, order.sender)
        && normalizeNimiqAddress(String(candidate.to)) === order.recipient
        && integer(candidate.value) === BigInt(order.amount_atomic)
        && candidate.toType === 0 && candidate.flags === 0
        && candidate.blockNumber !== undefined && candidate.blockNumber !== null) { match = candidate; break }
    }
    if (!match) return null
    const timestamp = integer(match.timestamp)
    if (timestamp < BigInt(Date.parse(order.created_at)) || timestamp > BigInt(Date.parse(order.expires_at))) throw invalid()
    const height = integer(match.blockNumber)
    const [finalized, blockResult] = await Promise.all([
      rpc('getLastMacroBlock', [Number(integer(head.number))]), rpc('getBlockByNumber', [Number(height), false]),
    ])
    const finalizedHeight = integer(finalized)
    if (height > finalizedHeight) return null
    const block = object(blockResult)
    if (integer(block.number) !== height || block.network !== 'TestAlbatross' || typeof block.hash !== 'string' || !/^[0-9a-f]{64}$/.test(block.hash)) throw invalid()
    return { transactionHash: String(match.hash), blockNumber: height.toString(), blockHash: block.hash }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'payment_check_unavailable', 'Could not check your payment yet. Refresh its status before paying again.')
  } finally { clearTimeout(timer) }
}

export async function verifySettlement(order: PaymentOrder, url: string, hash: string, fetcher: typeof fetch = fetch): Promise<Settlement | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 22_000)
  let nextId = 0
  async function rpc(method: string, params: unknown[]): Promise<unknown> {
    const id = ++nextId
    const response = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: controller.signal, redirect: 'manual' })
    if (!response.ok) throw new Error('RPC unavailable')
    const payload = object(JSON.parse(await readBoundedText(response, 256_000)))
    if (payload.id !== id || payload.jsonrpc !== '2.0') throw new Error('invalid RPC response')
    if (payload.error) {
      // A submitted NIM transfer is absent from transaction history while it is
      // still propagating or waiting for inclusion. Nimiq history nodes expose
      // that normal state as an RPC error rather than `null`; keep the order
      // pending so the learner can safely check the same transaction again.
      if (method === 'getTransactionByHash') {
        const rpcError = object(payload.error)
        if (rpcError.code === -32603 && /^Transaction not found: [0-9a-f]{64}$/i.test(String(rpcError.data ?? ''))) return null
      }
      throw new Error('RPC error')
    }
    return order.asset === 'NIM' ? object(payload.result).data : payload.result
  }
  function checkTime(timestamp: bigint) {
    // Polygon timestamps have whole-second resolution; comparing them to milliseconds
    // would reject a genuine payment in the same second as its quote.
    const created = order.asset === 'USDT' ? Math.floor(Date.parse(order.created_at) / 1000) * 1000 : Date.parse(order.created_at)
    if (timestamp < BigInt(created) || timestamp > BigInt(Date.parse(order.expires_at))) throw invalid()
  }
  try {
    if (order.asset === 'NIM') {
      const [consensus, latest, result] = await Promise.all([
        rpc('isConsensusEstablished', []), rpc('getLatestBlock', [false]), rpc('getTransactionByHash', [hash]),
      ])
      if (consensus !== true) return null
      const head = object(latest)
      if (head.network !== 'TestAlbatross') throw invalid()
      if (result === null) return null
      const tx = object(result)
      if (tx.hash !== hash || tx.executionResult !== true || tx.networkId !== 5 ||
          !await nimiqTransactionAuthorizesPayer(tx, order.sender) || normalizeNimiqAddress(String(tx.to)) !== order.recipient ||
          integer(tx.value) !== BigInt(order.amount_atomic) || tx.toType !== 0 || tx.flags !== 0) throw invalid()
      if (tx.blockNumber === undefined || tx.blockNumber === null) return null
      checkTime(integer(tx.timestamp))
      const height = integer(tx.blockNumber)
      const [finalized, blockResult] = await Promise.all([
        rpc('getLastMacroBlock', [Number(integer(head.number))]), rpc('getBlockByNumber', [Number(height), false]),
      ])
      const finalizedHeight = integer(finalized)
      if (height > finalizedHeight) return null
      const block = object(blockResult)
      if (integer(block.number) !== height || block.network !== 'TestAlbatross' || typeof block.hash !== 'string' || !/^[0-9a-f]{64}$/.test(block.hash)) throw invalid()
      return { blockNumber: height.toString(), blockHash: block.hash }
    }
    if (integer(await rpc('eth_chainId', [])) !== 137n) throw invalid()
    const result = await rpc('eth_getTransactionReceipt', [hash])
    if (result === null) return null
    const receipt = object(result)
    if (receipt.transactionHash !== hash || receipt.status !== '0x1' || String(receipt.from).toLowerCase() !== order.sender ||
        String(receipt.to).toLowerCase() !== order.token_address || typeof receipt.blockHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(receipt.blockHash)) throw invalid()
    const height = integer(receipt.blockNumber)
    const final = object(await rpc('eth_getBlockByNumber', ['finalized', false]))
    if (height > integer(final.number)) return null
    const block = object(await rpc('eth_getBlockByNumber', [receipt.blockNumber, false]))
    if (block.hash !== receipt.blockHash || integer(block.number) !== height) throw invalid()
    checkTime(integer(block.timestamp) * 1000n)
    if (!Array.isArray(receipt.logs)) throw invalid()
    let matching = 0
    for (const item of receipt.logs) {
      const log = object(item)
      if (String(log.address).toLowerCase() !== order.token_address) continue
      try {
        const decoded = decodeEventLog({ abi: erc20Abi, eventName: 'Transfer', data: log.data as `0x${string}`,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]], strict: true })
        if (decoded.args.from.toLowerCase() === order.sender && decoded.args.to.toLowerCase() === order.recipient &&
            decoded.args.value === BigInt(order.amount_atomic) && log.removed !== true && log.transactionHash === hash && log.blockHash === receipt.blockHash) matching++
      } catch { /* Other token events are not payment evidence. */ }
    }
    if (matching !== 1) throw invalid()
    return { blockNumber: height.toString(), blockHash: receipt.blockHash }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'payment_check_unavailable', 'Could not check your payment yet. Refresh its status before paying again.')
  } finally { clearTimeout(timer) }
}
