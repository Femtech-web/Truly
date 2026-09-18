import { isAddress, recoverTypedDataAddress } from 'viem'
import { requireWallet } from '../device-management'
import { HttpError, json, readJson } from '../http'
import { consumeLimit } from '../rate-limits'
import { normalizeNimiqAddress, randomToken, sha256 } from '../security'
import type { Env } from '../types'
import { paymentConfiguration, POLYGON_USDT, rpcUrl, type PaymentAsset } from './config'
import { bindingData, publicOrder, type PaymentOrder } from './protocol'
import { verifyNimSettlementByOrder, verifySettlement, type Settlement } from './settlement'

export async function listPurchases(request: Request, env: Env): Promise<Response> {
  const identity = await requireWallet(request, env, 'purchases:read')
  const [orders, entitlements] = await Promise.all([
    env.DB.prepare(`SELECT payment_orders.*, skills.title AS path_title
      FROM payment_orders JOIN skills ON skills.id=payment_orders.skill_id
      WHERE payment_orders.wallet_address = ? ORDER BY payment_orders.created_at DESC LIMIT 50`).bind(identity.walletAddress).all<PaymentOrder>(),
    env.DB.prepare('SELECT skill_id AS pathId, source, created_at AS grantedAt FROM entitlements WHERE wallet_address = ?').bind(identity.walletAddress).all(),
  ])
  return json({ orders: orders.results.map(order => publicOrder(order, env.PAIRING_ORIGIN)), entitlements: entitlements.results })
}

export async function createOrder(request: Request, env: Env): Promise<Response> {
  const identity = await requireWallet(request, env, 'purchases:write')
  await consumeLimit(env, `purchase-create:${identity.walletAddress}`, 6)
  const body = await readJson<{ pathId?: unknown; version?: unknown; asset?: unknown; sender?: unknown }>(request)
  const key = request.headers.get('idempotency-key') ?? ''
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(key) || typeof body.pathId !== 'string' || body.pathId.length > 128 ||
      !Number.isSafeInteger(body.version) || (body.asset !== 'NIM' && body.asset !== 'USDT')) {
    throw new HttpError(400, 'invalid_purchase', 'Reopen this Path and review your purchase again.')
  }
  const asset: PaymentAsset = body.asset
  const sender = asset === 'NIM' ? identity.walletAddress : String(body.sender ?? '').toLowerCase()
  if (asset === 'USDT' && !isAddress(sender, { strict: false })) throw new HttpError(400, 'invalid_sender', 'Choose your USDT wallet in Nimiq Pay.')
  const fingerprint = await sha256(JSON.stringify([body.pathId, body.version, asset, sender]))
  const existing = await env.DB.prepare('SELECT * FROM payment_orders WHERE wallet_address = ? AND request_key = ?')
    .bind(identity.walletAddress, key).first<PaymentOrder>()
  if (existing) {
    if (existing.request_hash !== fingerprint) throw new HttpError(409, 'purchase_conflict', 'This purchase changed. Review it again.')
    return json({ order: publicOrder(existing, env.PAIRING_ORIGIN) })
  }
  await env.DB.prepare("UPDATE payment_orders SET status='rejected' WHERE wallet_address=? AND status='quoted' AND transaction_hash IS NULL AND expires_at<=?")
    .bind(identity.walletAddress, new Date().toISOString()).run()
  const open = await env.DB.prepare("SELECT * FROM payment_orders WHERE wallet_address=? AND skill_id=? AND status IN ('quoted','submitted')")
    .bind(identity.walletAddress, body.pathId).first<PaymentOrder>()
  if (open) {
    if (open.asset !== asset || open.sender !== sender || open.skill_version !== body.version) throw new HttpError(409, 'purchase_in_progress', 'Finish checking your existing purchase before starting another.')
    return json({ order: publicOrder(open, env.PAIRING_ORIGIN) })
  }
  const configuration = paymentConfiguration(env, asset)
  const owned = await env.DB.prepare('SELECT id FROM entitlements WHERE wallet_address = ? AND skill_id = ?')
    .bind(identity.walletAddress, body.pathId).first()
  if (owned) throw new HttpError(409, 'path_already_owned', 'You already own this Path. Refresh to start it on your Mac.')
  const price = await env.DB.prepare(`SELECT p.amount_atomic, p.recipient, p.decimals, p.chain_id, p.token_address,
    c.nimiq_address, c.evm_address, c.status AS creator_status, v.manifest_json
    FROM skill_prices p JOIN skills s ON s.id=p.skill_id JOIN creators c ON c.id=s.creator_id
    JOIN skill_versions v ON v.skill_id=s.id AND v.version=s.current_version
    WHERE p.skill_id=? AND p.asset=? AND p.active=1 AND s.current_version=? AND s.status='published' AND v.review_status='approved'`)
    .bind(body.pathId, asset, body.version).first<{ amount_atomic: string; recipient: string; decimals: number;
      chain_id: string | null; token_address: string | null; nimiq_address: string; evm_address: string | null; creator_status: string; manifest_json: string }>()
  if (!price || price.creator_status !== 'active' || !/^[1-9]\d{0,14}$/.test(price.amount_atomic) ||
      BigInt(price.amount_atomic) > BigInt(Number.MAX_SAFE_INTEGER) || price.decimals !== configuration.decimals) {
    throw new HttpError(503, 'path_payment_unavailable', 'This Path is not ready for purchase yet.')
  }
  const manifest = JSON.parse(price.manifest_json) as { steps?: Array<{ challenge?: string; rubric?: string[] }> }
  if (!manifest.steps?.length || manifest.steps.some(step => !step.challenge || !step.rubric?.length)) {
    throw new HttpError(503, 'path_practice_unavailable', 'This Path’s guided practice is still being prepared.')
  }
  const recipient = asset === 'NIM' ? normalizeNimiqAddress(price.recipient) : price.recipient.toLowerCase()
  const creatorRecipient = asset === 'NIM' ? normalizeNimiqAddress(price.nimiq_address) : price.evm_address?.toLowerCase()
  if (recipient !== configuration.recipient || recipient !== creatorRecipient || recipient === sender ||
      (asset === 'USDT' && (price.chain_id !== '0x89' || price.token_address?.toLowerCase() !== POLYGON_USDT))) {
    throw new HttpError(503, 'recipient_unverified', 'This seller’s payment details are not ready yet.')
  }
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await env.DB.prepare(`INSERT OR IGNORE INTO payment_orders
    (id,wallet_address,skill_id,skill_version,asset,network,token_address,sender,recipient,amount_atomic,decimals,request_key,request_hash,binding_nonce,sender_verified_at,created_at,expires_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, identity.walletAddress, body.pathId, body.version, asset,
    configuration.network, configuration.token, sender, recipient, price.amount_atomic, price.decimals, key,
    fingerprint, randomToken(), asset === 'NIM' ? now : null, now, new Date(Date.now() + 30 * 60_000).toISOString()).run()
  const order = await env.DB.prepare('SELECT * FROM payment_orders WHERE wallet_address = ? AND request_key = ?')
    .bind(identity.walletAddress, key).first<PaymentOrder>()
  if (!order || order.request_hash !== fingerprint) throw new HttpError(409, 'purchase_conflict', 'Review your purchase again.')
  return json({ order: publicOrder(order, env.PAIRING_ORIGIN) }, { status: 201 })
}

async function ownedOrder(id: string, request: Request, env: Env): Promise<PaymentOrder> {
  const identity = await requireWallet(request, env, 'purchases:write')
  const order = await env.DB.prepare('SELECT * FROM payment_orders WHERE id = ? AND wallet_address = ?').bind(id, identity.walletAddress).first<PaymentOrder>()
  if (!order) throw new HttpError(404, 'purchase_not_found', 'This purchase was not found in your wallet.')
  return order
}

export async function bindOrderSender(id: string, request: Request, env: Env): Promise<Response> {
  const order = await ownedOrder(id, request, env)
  if (order.asset !== 'USDT' || order.status !== 'quoted' || Date.parse(order.expires_at) <= Date.now()) {
    throw new HttpError(409, 'purchase_expired', 'Review this purchase again before paying.')
  }
  const { signature } = await readJson<{ signature?: unknown }>(request)
  if (typeof signature !== 'string' || !/^0x[0-9a-f]{130}$/i.test(signature)) throw new HttpError(400, 'invalid_signature', 'Approve your USDT wallet before paying.')
  try {
    const sender = await recoverTypedDataAddress({ ...bindingData(order, env.PAIRING_ORIGIN), signature: signature as `0x${string}` })
    if (sender.toLowerCase() !== order.sender) throw new Error()
  } catch { throw new HttpError(401, 'invalid_signature', 'This approval does not match your USDT wallet.') }
  await env.DB.prepare("UPDATE payment_orders SET sender_verified_at=COALESCE(sender_verified_at,?) WHERE id=? AND status='quoted' AND expires_at>?")
    .bind(new Date().toISOString(), id, new Date().toISOString()).run()
  return json({ order: publicOrder((await ownedOrder(id, request, env)), env.PAIRING_ORIGIN) })
}

export async function verifyOrder(id: string, request: Request, env: Env): Promise<Response> {
  let order = await ownedOrder(id, request, env)
  if (order.status === 'validated') return json({ order: publicOrder(order, env.PAIRING_ORIGIN), unlocked: true })
  if (order.status === 'rejected') throw new HttpError(422, 'payment_rejected', 'This payment did not match. Contact support before paying again.')
  if (!order.sender_verified_at) throw new HttpError(403, 'sender_unverified', 'Approve your USDT wallet before paying.')
  await consumeLimit(env, `purchase-check:${order.wallet_address}`, 12)
  const body = await readJson<{ transactionHash?: unknown }>(request)
  let hash = typeof body.transactionHash === 'string' ? body.transactionHash.toLowerCase() : order.transaction_hash
  if ((order.asset === 'USDT' && (!hash || !/^0x[0-9a-f]{64}$/.test(hash))) ||
      (order.asset === 'NIM' && hash && !/^[0-9a-f]{64}$/.test(hash))) {
    throw new HttpError(400, 'invalid_transaction_hash', 'Use the transaction reference from Nimiq Pay.')
  }
  let settlement: (Settlement & { transactionHash?: string }) | null | undefined
  if (order.asset === 'NIM' && !hash) {
    await env.DB.prepare("UPDATE payment_orders SET status='submitted' WHERE id=? AND status='quoted'").bind(id).run()
    order = await ownedOrder(id, request, env)
    try { settlement = await verifyNimSettlementByOrder(order, rpcUrl(env.NIM_RPC_URL)) }
    catch (error) { throw error }
    if (!settlement) return json({ order: publicOrder(order, env.PAIRING_ORIGIN), unlocked: false, pending: true })
    hash = settlement.transactionHash!
  }
  if (!hash) throw new HttpError(400, 'invalid_transaction_hash', 'Use the transaction reference from Nimiq Pay.')
  if (order.transaction_hash && order.transaction_hash !== hash) throw new HttpError(409, 'purchase_conflict', 'This purchase already has a payment. Check its status before paying again.')
  const used = await env.DB.prepare('SELECT id FROM payment_orders WHERE transaction_hash=? AND id!=?').bind(hash, id).first()
  if (used) throw new HttpError(409, 'payment_already_used', 'This payment belongs to another purchase.')
  try {
    await env.DB.prepare("UPDATE payment_orders SET transaction_hash=?,status='submitted' WHERE id=? AND transaction_hash IS NULL AND status IN ('quoted','submitted')").bind(hash, id).run()
  } catch { throw new HttpError(409, 'payment_already_used', 'This payment belongs to another purchase.') }
  order = await ownedOrder(id, request, env)
  if (order.transaction_hash !== hash) throw new HttpError(409, 'purchase_conflict', 'This purchase changed. Refresh its status.')
  if (settlement === undefined) {
    try { settlement = await verifySettlement(order, rpcUrl(order.asset === 'NIM' ? env.NIM_RPC_URL : env.POLYGON_RPC_URL), hash) }
    catch (error) {
      if (error instanceof HttpError && error.status === 422) {
        await env.DB.prepare("UPDATE payment_orders SET status='rejected' WHERE id=? AND status='submitted'").bind(id).run()
      }
      throw error
    }
  }
  if (!settlement) return json({ order: publicOrder(order, env.PAIRING_ORIGIN), unlocked: false, pending: true })
  await ownedOrder(id, request, env) // Recheck live wallet authority after the RPC wait.
  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO payment_settlements(id,order_id,network,transaction_hash,block_number,block_hash,created_at)
      SELECT ?,id,network,transaction_hash,?,?,? FROM payment_orders WHERE id=? AND status='submitted' AND transaction_hash=?`)
      .bind(crypto.randomUUID(), settlement.blockNumber, settlement.blockHash, now, id, hash),
    env.DB.prepare(`UPDATE payment_orders SET status='validated',validated_at=? WHERE id=? AND status='submitted'
      AND EXISTS(SELECT 1 FROM payment_settlements WHERE order_id=payment_orders.id AND transaction_hash=payment_orders.transaction_hash)`)
      .bind(now, id),
    env.DB.prepare(`INSERT OR IGNORE INTO purchases(id,wallet_address,skill_id,asset,chain_id,transaction_hash,recipient,amount_atomic,status,validated_at)
      SELECT id,wallet_address,skill_id,asset,network,transaction_hash,recipient,amount_atomic,'validated',? FROM payment_orders WHERE id=? AND status='validated'`)
      .bind(now, id),
    env.DB.prepare(`INSERT OR IGNORE INTO entitlements(id,wallet_address,skill_id,source,purchase_id)
      SELECT ?,wallet_address,skill_id,'purchase',id FROM payment_orders WHERE id=? AND status='validated'
      AND EXISTS(SELECT 1 FROM purchases WHERE purchases.id=payment_orders.id AND purchases.status='validated')`)
      .bind(crypto.randomUUID(), id),
  ])
  order = await ownedOrder(id, request, env)
  return json({ order: publicOrder(order, env.PAIRING_ORIGIN), unlocked: order.status === 'validated' })
}
