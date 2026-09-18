import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { encodeEventTopics, encodeAbiParameters, erc20Abi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createTestDatabase } from './helpers/sqlite-d1.mjs'
import { normalizeNimiqAddress, nimiqAddressFromPublicKey, sha256 } from '../src/security'
import { paymentConfiguration, POLYGON_USDT } from '../src/payments/config'
import { createOrder, bindOrderSender, verifyOrder, listPurchases } from '../src/payments/orders'
import { bindingData } from '../src/payments/protocol'
import { nimiqTransactionAuthorizesPayer } from '../src/payments/settlement'
import { getCatalog } from '../src/catalog'
import { readFileSync } from 'node:fs'

// Fixed synthetic test identities; never fund or reuse these as real wallets.
const buyer = normalizeNimiqAddress(nimiqAddressFromPublicKey(new Uint8Array(32).fill(3)))
const seller = normalizeNimiqAddress(nimiqAddressFromPublicKey(new Uint8Array(32).fill(4)))
const evm = privateKeyToAccount(`0x${'11'.repeat(32)}`)
const evmSeller = '0x2222222222222222222222222222222222222222'
const path = 'skill_nim_payments'
const nimHash = 'a'.repeat(64), evmHash = `0x${'b'.repeat(64)}`, blockHash = `0x${'c'.repeat(64)}`
let db, env
const request = (body = {}, key = 'order-request-0001') => new Request('https://core.truly.test/v1/purchases', {
  method: 'POST', headers: { authorization: 'Bearer payment-test', 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body),
})
const prepare = async (asset = 'NIM', key) => (await (await createOrder(request({ pathId: path, version: 1, asset, sender: evm.address }, key), env)).json()).order
const counts = () => ({ orders: db.sqlite.prepare('SELECT COUNT(*) AS n FROM payment_orders').get().n,
  receipts: db.sqlite.prepare('SELECT COUNT(*) AS n FROM payment_settlements').get().n,
  access: db.sqlite.prepare('SELECT COUNT(*) AS n FROM entitlements').get().n })
const row = id => db.sqlite.prepare('SELECT * FROM payment_orders WHERE id=?').get(id)
const hex = value => Buffer.from(value, 'utf8').toString('hex')
function rpc(results) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, options) => {
    const { id, method, params } = JSON.parse(options.body)
    const value = typeof results[method] === 'function' ? results[method](params) : results[method]
    if (value === undefined) throw new Error(`Unexpected method ${method}`)
    return Response.json({ jsonrpc: '2.0', id, result: method.startsWith('eth_') ? value : { data: value } })
  })
}
function nimEvidence(order, changes = {}, finalized = 40) {
  return { isConsensusEstablished: true, getLatestBlock: { network: 'MainAlbatross', number: 41 },
    getTransactionByHash: { hash: nimHash, executionResult: true, networkId: 24, from: buyer, to: seller,
      value: Number(order.amountAtomic), fromType: 0, toType: 0, flags: 0, blockNumber: 40,
      timestamp: Date.parse(order.createdAt) + 1000, ...changes }, getLastMacroBlock: finalized,
    getBlockByNumber: { network: 'MainAlbatross', number: 40, hash: 'c'.repeat(64) } }
}
function nimMemoEvidence(order, changes = {}, history = null) {
  const transaction = { hash: nimHash, executionResult: true, networkId: 24, from: buyer, to: seller,
    value: Number(order.amountAtomic), fromType: 0, toType: 0, flags: 0, blockNumber: 40,
    timestamp: Date.parse(order.createdAt) + 1000, recipientData: hex(order.id), ...changes }
  return { isConsensusEstablished: true, getLatestBlock: { network: 'MainAlbatross', number: 41 },
    getTransactionsByAddress: history ?? [transaction], getLastMacroBlock: 40,
    getBlockByNumber: { network: 'MainAlbatross', number: 40, hash: 'c'.repeat(64) } }
}
function usdtEvidence(order, logChanges = {}, chain = '0x89') {
  const log = { address: POLYGON_USDT, transactionHash: evmHash, blockHash, removed: false,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from: evm.address, to: evmSeller } }),
    data: encodeAbiParameters([{ type: 'uint256' }], [BigInt(order.amountAtomic)]), ...logChanges }
  return { eth_chainId: chain, eth_getTransactionReceipt: { transactionHash: evmHash, status: '0x1',
    from: evm.address, to: POLYGON_USDT, blockNumber: '0x28', blockHash, logs: [log] },
    eth_getBlockByNumber: { number: '0x28', hash: blockHash, timestamp: `0x${Math.floor(Date.parse(order.createdAt) / 1000).toString(16)}` } }
}
beforeEach(async () => {
  db = createTestDatabase()
  env = { DB: db.DB, PAIRING_ORIGIN: 'https://app.truly.test', ALLOWED_ORIGINS: 'https://app.truly.test',
    NIM_PAYMENTS_ENABLED: 'true', NIM_RPC_URL: 'https://nim-rpc.test',
    USDT_PAYMENTS_ENABLED: 'true', USDT_MAINNET_APPROVED: 'true', POLYGON_RPC_URL: 'https://polygon-rpc.test', USDT_PAYMENT_RECIPIENT: evmSeller }
  db.sqlite.prepare('INSERT INTO wallet_accounts(nimiq_address) VALUES (?)').run(buyer)
  db.sqlite.prepare('INSERT INTO wallet_accounts(nimiq_address) VALUES (?)').run(seller)
  db.sqlite.prepare(`INSERT INTO wallet_sessions(id,wallet_address,token_hash,expires_at,scopes) VALUES ('checkout',?,?,'2099-01-01T00:00:00.000Z','purchases:read purchases:write')`).run(buyer, await sha256('payment-test'))
  db.sqlite.prepare(`UPDATE creators SET status='active',nimiq_address=?,evm_address=? WHERE id='creator_truly_studio'`).run(seller, evmSeller)
  db.sqlite.prepare(`UPDATE skill_prices SET active=1,recipient=? WHERE asset='NIM'`).run(seller)
  db.sqlite.prepare(`UPDATE skill_versions SET publication_json=json_set(publication_json,'$.nimPayment',json(
    (SELECT json_object('recipient',recipient,'amountAtomic',amount_atomic,'decimals',decimals)
     FROM skill_prices WHERE skill_id=skill_versions.skill_id AND asset='NIM')))
    WHERE access_kind='paid'`).run()
  db.sqlite.prepare(`UPDATE skill_prices SET active=1,recipient=? WHERE asset='USDT'`).run(evmSeller)
})
afterEach(() => { vi.restoreAllMocks(); db.sqlite.close() })
describe('independently verified Path purchases', () => {
  it('supports different signed creator recipients without a global payout address', async () => {
    const secondSeller = normalizeNimiqAddress(nimiqAddressFromPublicKey(new Uint8Array(32).fill(7)))
    db.sqlite.prepare('INSERT INTO wallet_accounts(nimiq_address) VALUES (?)').run(secondSeller)
    db.sqlite.prepare("INSERT INTO creators(id,nimiq_address,slug,display_name,status) VALUES ('second',?,'second','Second creator','active')").run(secondSeller)
    db.sqlite.exec(`INSERT INTO skills(id,creator_id,slug,title,summary,description,category,status,current_version)
      SELECT 'second-path','second','second-path',title,summary,description,category,status,current_version FROM skills WHERE id='${path}';
      INSERT INTO skill_versions(id,skill_id,version,manifest_json,review_status,access_kind,publication_json)
      SELECT 'second-version','second-path',version,manifest_json,review_status,access_kind,publication_json FROM skill_versions WHERE skill_id='${path}';`)
    db.sqlite.prepare("INSERT INTO skill_prices(id,skill_id,asset,decimals,amount_atomic,recipient,active) VALUES ('second-price','second-path','NIM',5,'2000',?,1)").run(secondSeller)
    db.sqlite.prepare("UPDATE skill_versions SET publication_json=json_set(publication_json,'$.nimPayment',json(?)) WHERE skill_id='second-path'")
      .run(JSON.stringify({ recipient: secondSeller, amountAtomic: '2000', decimals: 5 }))
    const first = await prepare()
    const second = (await (await createOrder(request({ pathId: 'second-path', version: 1, asset: 'NIM' }, 'second-order-request'), env)).json()).order
    expect(first.recipient).toBe(seller)
    expect(second.recipient).toBe(secondSeller)
    const listing = (await (await getCatalog(env)).json()).skills
    expect(listing.find(s => s.id === 'second-path').prices[0].checkoutEnabled).toBe(true)
    rpc(nimMemoEvidence(second, { to: secondSeller }))
    expect((await (await verifyOrder(second.id, request({}), env)).json()).unlocked).toBe(true)
  })
  it.each(['recipient', 'amount', 'snapshot', 'creator', 'free'])('blocks a changed %s instead of quoting unapproved payment details', async change => {
    if (change === 'recipient') db.sqlite.prepare("UPDATE skill_prices SET recipient=? WHERE skill_id=? AND asset='NIM'").run(buyer, path)
    if (change === 'amount') db.sqlite.prepare("UPDATE skill_prices SET amount_atomic='1234' WHERE skill_id=? AND asset='NIM'").run(path)
    if (change === 'snapshot') db.sqlite.prepare("UPDATE skill_versions SET publication_json='{}' WHERE skill_id=?").run(path)
    if (change === 'creator') db.sqlite.prepare("UPDATE creators SET nimiq_address=? WHERE id='creator_truly_studio'").run(buyer)
    if (change === 'free') db.sqlite.prepare("UPDATE skill_versions SET access_kind='free' WHERE skill_id=?").run(path)
    await expect(prepare()).rejects.toMatchObject({ status: 503 })
    const listing = (await (await getCatalog(env)).json()).skills.find(s => s.id === path)
    expect(listing.prices.find(p => p.asset === 'NIM').checkoutEnabled).toBe(false)
    expect(counts()).toEqual({ orders: 0, receipts: 0, access: 0 })
  })
  it('requires configured payments and separately approved Polygon spending', async () => {
    await expect(createOrder(request({ pathId: path, version: 1, asset: 'NIM' }), { ...env, NIM_PAYMENTS_ENABLED: 'false' })).rejects.toMatchObject({ status: 503 })
    expect(() => paymentConfiguration({ ...env, USDT_MAINNET_APPROVED: 'false' }, 'USDT')).toThrow()
    expect(() => paymentConfiguration({ ...env, USDT_PAYMENT_RECIPIENT: `0x${'0'.repeat(40)}` }, 'USDT')).toThrow()
    expect(counts().orders).toBe(0)
    const listing = (await (await getCatalog({ ...env, NIM_PAYMENTS_ENABLED: 'false', USDT_PAYMENTS_ENABLED: 'false' })).json()).skills.find(s => s.id === path)
    expect(listing.prices.every(p => !p.checkoutEnabled)).toBe(true)
  })
  it('creates only Mainnet NIM orders and rejects historical Testnet orders at settlement', async () => {
    const order = await prepare()
    expect(order.network).toBe('nimiq-mainnet')
    db.sqlite.prepare("UPDATE payment_orders SET network='nimiq-testnet' WHERE id=?").run(order.id)
    rpc(nimEvidence(order))
    await expect(verifyOrder(order.id, request({ transactionHash: nimHash }), env)).rejects.toMatchObject({ status: 422 })
    expect(counts().access).toBe(0)
  })
  it('backfills only missing current-version NIM snapshots without modifying orders', async () => {
    const order = await prepare()
    const pinnedOrder = row(order.id)
    db.sqlite.prepare("UPDATE skill_versions SET publication_json='{}',version=2 WHERE skill_id=?").run(path)
    db.sqlite.prepare('UPDATE skills SET current_version=2 WHERE id=?').run(path)
    db.sqlite.prepare(`INSERT INTO skill_versions(id,skill_id,version,manifest_json,review_status,access_kind,publication_json)
      SELECT 'historical',skill_id,1,manifest_json,review_status,access_kind,'{}' FROM skill_versions WHERE skill_id=?`).run(path)
    const migration = readFileSync(new URL('../../migrations/0015_creator_nim_prices.sql', import.meta.url), 'utf8')
    db.sqlite.exec(migration)
    const versions = db.sqlite.prepare('SELECT version,publication_json FROM skill_versions WHERE skill_id=? ORDER BY version').all(path)
    expect(JSON.parse(versions[0].publication_json).nimPayment).toBeUndefined()
    expect(JSON.parse(versions[1].publication_json).nimPayment).toEqual({ recipient: seller, amountAtomic: order.amountAtomic, decimals: 5 })
    db.sqlite.prepare("UPDATE skill_prices SET amount_atomic='9999' WHERE skill_id=? AND asset='NIM'").run(path)
    db.sqlite.exec(migration)
    expect(JSON.parse(db.sqlite.prepare('SELECT publication_json FROM skill_versions WHERE skill_id=? AND version=2').get(path).publication_json).nimPayment.amountAtomic).toBe(order.amountAtomic)
    expect(row(order.id)).toEqual(pinnedOrder)
  })
  it('pins the reviewed quote and replays one request without adopting a changed price', async () => {
    const order = await prepare()
    db.sqlite.exec(`UPDATE skill_prices SET amount_atomic='500000' WHERE skill_id='${path}' AND asset='NIM'`)
    expect((await prepare()).amountAtomic).toBe('190000')
    expect((await prepare('NIM', 'different-request-0002')).id).toBe(order.id)
    await expect(prepare('USDT')).rejects.toMatchObject({ status: 409 })
    expect(counts()).toEqual({ orders: 1, receipts: 0, access: 0 })
  })
  it('settles against the pinned order after listing prices and recipients change', async () => {
    const order = await prepare()
    db.sqlite.prepare("UPDATE skill_prices SET amount_atomic='1234',recipient=? WHERE skill_id=? AND asset='NIM'").run(buyer, path)
    rpc(nimMemoEvidence(order))
    expect((await (await verifyOrder(order.id, request({}), env)).json()).unlocked).toBe(true)
    expect(row(order.id).recipient).toBe(seller)
    expect(row(order.id).amount_atomic).toBe(order.amountAtomic)
  })
  it('does not grant access from a callback before finality, then grants durably exactly once', async () => {
    const order = await prepare()
    const upstream = rpc(nimEvidence(order, {}, 39))
    expect((await (await verifyOrder(order.id, request({ transactionHash: nimHash }), env)).json()).pending).toBe(true)
    expect(counts().access).toBe(0)
    upstream.mockRestore(); rpc(nimEvidence(order))
    expect((await (await verifyOrder(order.id, request({}), env)).json()).unlocked).toBe(true)
    await verifyOrder(order.id, request({}), env)
    expect(counts()).toEqual({ orders: 1, receipts: 1, access: 1 })
    const persisted = await (await listPurchases(request(), env)).json()
    expect(persisted.orders[0].status).toBe('validated')
    expect(persisted.entitlements[0].pathId).toBe(path)
  })
  it('finds a NIM payment by its order memo when Nimiq Pay returns no transaction hash', async () => {
    const order = await prepare()
    rpc(nimMemoEvidence(order))
    const result = await (await verifyOrder(order.id, request({}), env)).json()
    expect(result.unlocked).toBe(true)
    expect(row(order.id).transaction_hash).toBe(nimHash)
    expect(counts()).toEqual({ orders: 1, receipts: 1, access: 1 })
  })
  it('cryptographically recognizes the wallet behind a Nimiq Pay contract-funded transfer', async () => {
    // Finalized public testnet fixture. The direct sender is an HTLC, while
    // the purchase wallet is the creator who co-signed the early redemption.
    const transaction = {
      hash: '08447c3049053caaa5dd5856e225fb191b61c9a7cbfbf199c904249ca425d6b8',
      from: 'NQ61 TF4G 9VPF TCRA P6DQ 44XA TXD3 4SC3 QU6V', fromType: 2, senderData: '',
      to: 'NQ12 37R4 KTF9 AC69 S6SM VMA5 K0TA KYPC PB5G', toType: 0,
      value: 1000, fee: 0, flags: 0, validityStartHeight: 11686094, networkId: 5,
      recipientData: '62376139333162392d356632322d343263312d623563642d616335333865343564643831',
      proof: '0100c1534c708122968212c6709526801d18218ce9303590f2bca473213d99b24aaf0027695a283d83271715d8b8b5111be478150b6268f2a6cc4b9db65bbc621eb2d463d6374ddb80e3b9d6e5fdd3e6bb4e6ef7ccc2ea8be7d49df54d4e78b57d1406008514ab7cafeb72113aa91adea14fcd988ced144837b74a8946115d8227b5294b00ee50b408767eb551d52cd30d90144ed82a7f9c78934fa494cd91a43bd04751be47e9cb69d011254e59b4496e55e63756747485e6029f9f9b532a5bda41415600',
    }
    await expect(nimiqTransactionAuthorizesPayer(transaction, 'NQ47 GFC8 SCHC 7R99 01CJ Y797 1EMH 2253 2AG1')).resolves.toBe(true)
    await expect(nimiqTransactionAuthorizesPayer(transaction, seller)).resolves.toBe(false)
  })
  it.each([
    { recipientData: hex('another-order') },
    { value: 1 },
    { from: seller },
  ])('does not grant access from mismatched memo-based NIM evidence %j', async changes => {
    const order = await prepare(); rpc(nimMemoEvidence(order, changes))
    const result = await (await verifyOrder(order.id, request({}), env)).json()
    expect(result.pending).toBe(true)
    expect(row(order.id).status).toBe('submitted')
    expect(row(order.id).transaction_hash).toBeNull()
    expect(counts().access).toBe(0)
  })
  it.each([{ value: 1 }, { to: buyer }, { from: seller }, { executionResult: false }, { networkId: 5 }, { timestamp: 1 }])('rejects mismatched NIM evidence %j', async changes => {
    const order = await prepare(); rpc(nimEvidence(order, changes))
    await expect(verifyOrder(order.id, request({ transactionHash: nimHash }), env)).rejects.toMatchObject({ status: 422 })
    expect(counts().access).toBe(0)
    expect(row(order.id).status).toBe('rejected')
  })
  it('retains a submitted reference after an RPC outage without asking for another payment', async () => {
    const order = await prepare()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    await expect(verifyOrder(order.id, request({ transactionHash: nimHash }), env)).rejects.toMatchObject({ status: 503 })
    expect(row(order.id).transaction_hash).toBe(nimHash)
    expect(row(order.id).status).toBe('submitted')
    expect(counts().access).toBe(0)
  })
  it('keeps a newly broadcast NIM transfer pending while the history node has not indexed it', async () => {
    const order = await prepare()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, options) => {
      const { id, method } = JSON.parse(options.body)
      if (method === 'isConsensusEstablished') return Response.json({ jsonrpc: '2.0', id, result: { data: true } })
      if (method === 'getLatestBlock') return Response.json({ jsonrpc: '2.0', id, result: { data: { network: 'MainAlbatross', number: 41 } } })
      if (method === 'getTransactionByHash') return Response.json({ jsonrpc: '2.0', id,
        error: { code: -32603, message: 'Internal error', data: `Transaction not found: ${nimHash}` } })
      throw new Error(`Unexpected method ${method}`)
    })
    expect((await (await verifyOrder(order.id, request({ transactionHash: nimHash }), env)).json()).pending).toBe(true)
    expect(row(order.id).status).toBe('submitted')
    expect(counts()).toEqual({ orders: 1, receipts: 0, access: 0 })
  })
  it('rechecks wallet authority after waiting for chain evidence', async () => {
    const order = await prepare()
    const evidence = nimEvidence(order)
    evidence.getBlockByNumber = () => { db.sqlite.exec('DELETE FROM wallet_sessions'); return { network: 'MainAlbatross', number: 40, hash: 'c'.repeat(64) } }
    rpc(evidence)
    await expect(verifyOrder(order.id, request({ transactionHash: nimHash }), env)).rejects.toMatchObject({ status: 401 })
    expect(counts().receipts).toBe(0)
    expect(counts().access).toBe(0)
  })
  it('binds a real synthetic EVM signature to this order and Nimiq beneficiary before USDT verification', async () => {
    const order = await prepare('USDT')
    await expect(verifyOrder(order.id, request({ transactionHash: evmHash }), env)).rejects.toMatchObject({ status: 403 })
    const signature = await evm.signTypedData(bindingData(row(order.id), env.PAIRING_ORIGIN))
    await bindOrderSender(order.id, request({ signature }), env)
    rpc(usdtEvidence(order))
    expect((await (await verifyOrder(order.id, request({ transactionHash: evmHash }), env)).json()).unlocked).toBe(true)
    expect(counts().access).toBe(1)
  })
  it.each([{ address: evmSeller }, { removed: true }, { data: encodeAbiParameters([{ type: 'uint256' }], [1n]) }])('rejects counterfeit or mismatched USDT Transfer %j', async changes => {
    const order = await prepare('USDT')
    await bindOrderSender(order.id, request({ signature: await evm.signTypedData(bindingData(row(order.id), env.PAIRING_ORIGIN)) }), env)
    rpc(usdtEvidence(order, changes))
    await expect(verifyOrder(order.id, request({ transactionHash: evmHash }), env)).rejects.toMatchObject({ status: 422 })
    expect(counts().access).toBe(0)
  })
  it('rolls settlement and access back together on a failed database write', async () => {
    const order = await prepare(); rpc(nimEvidence(order))
    db.sqlite.exec(`CREATE TRIGGER fail_access BEFORE INSERT ON entitlements BEGIN SELECT RAISE(ABORT,'test failure'); END`)
    await expect(verifyOrder(order.id, request({ transactionHash: nimHash }), env)).rejects.toThrow('test failure')
    expect(counts().receipts).toBe(0)
    expect(counts().access).toBe(0)
    expect(row(order.id).status).toBe('submitted')
  })
})
