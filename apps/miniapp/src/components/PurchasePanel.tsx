import { useEffect, useRef, useState } from 'react'
import { Check, CircleDollarSign, LockKeyhole, RefreshCw } from 'lucide-react'
import type { useDevices } from '../hooks/useDevices'
import { coreRequest } from '../core/client'
import { createIdempotencyKey } from '../core/idempotency'
import type { Skill } from '../types'
import { approvePurchaseBinding, choosePolygonAccount, payUsdt, usePolygon } from '../wallet/ethereumWallet'
import { getPaymentError } from '../wallet/errors'

type Order = { id: string; pathId: string; version: number; asset: 'NIM' | 'USDT'; network: 'nimiq-testnet' | 'nimiq-mainnet' | 'polygon';
  tokenAddress: string | null; sender: string; recipient: string; amountAtomic: string; decimals: number; senderVerified: boolean;
  transactionHash: string | null; status: 'quoted' | 'submitted' | 'validated' | 'rejected'; expiresAt: string; binding: Record<string, unknown> | null }
interface Props { skill: Skill; account: string; devices: ReturnType<typeof useDevices>; payNim(input: { recipient: string; value: number; reference: string }): Promise<string>; onUnlocked(): void }
const amount = (atomic: string, decimals: number) => {
  const padded = atomic.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals) || '0', fraction = padded.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`
const networkName = (network: Order['network']) => network === 'nimiq-mainnet' ? 'Nimiq Mainnet' : network === 'nimiq-testnet' ? 'Nimiq Testnet' : 'Polygon'
const NIM_SUBMITTED = 'nimiq-submitted'
const recoveryKey = (orderId: string) => `truly:pending-payment:${orderId}`
const readPendingReference = (orderId: string) => {
  try {
    const reference = localStorage.getItem(recoveryKey(orderId))
    return reference === NIM_SUBMITTED || Boolean(reference && /^0x[0-9a-f]{64}$/i.test(reference)) ? reference : null
  } catch { return null }
}
const rememberPendingReference = (orderId: string, reference: string) => {
  try { localStorage.setItem(recoveryKey(orderId), reference) } catch { /* The in-memory recovery state still prevents an immediate duplicate payment. */ }
}
const forgetPendingHash = (orderId: string) => {
  try { localStorage.removeItem(recoveryKey(orderId)) } catch { /* Storage may be unavailable in a private web view. */ }
}

export function PurchasePanel({ skill, account, devices, payNim, onUnlocked }: Props) {
  const available = skill.prices.filter(price => price.checkoutEnabled)
  const [asset, setAsset] = useState<'NIM' | 'USDT'>(available[0]?.asset ?? 'NIM')
  const [access, setAccess] = useState(false)
  const [evmAccount, setEvmAccount] = useState<string | null>(null)
  const [polygonReady, setPolygonReady] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [acceptedMainnet, setAcceptedMainnet] = useState(false)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const requestKey = useRef(createIdempotencyKey())
  useEffect(() => { setOrder(null); setMessage(''); setPolygonReady(false); setAcceptedMainnet(false); requestKey.current = createIdempotencyKey() }, [asset, skill.id])
  useEffect(() => {
    if (!devices.ready) return
    try { void loadExisting(false) } catch { /* An older grant may not include purchase access. */ }
  }, [devices.ready, account, skill.id])

  async function loadExisting(showFailure: boolean) {
    try {
      const result = await coreRequest<{ orders: Order[]; entitlements: Array<{ pathId: string }> }>('/v1/purchases', { headers: devices.purchaseHeaders() })
      if (result.entitlements.some(item => item.pathId === skill.id)) { onUnlocked(); return }
      const existing = result.orders.find(item => item.pathId === skill.id &&
        (item.status === 'submitted' || (item.status === 'quoted' &&
          (Boolean(readPendingReference(item.id)) || Date.parse(item.expiresAt) > Date.now()))))
      if (existing) {
        const pendingReference = existing.transactionHash ?? readPendingReference(existing.id)
        const recovered = pendingReference && !existing.transactionHash
          ? { ...existing, transactionHash: pendingReference === NIM_SUBMITTED ? null : pendingReference, status: 'submitted' as const }
          : existing
        setAsset(recovered.asset); setOrder(recovered); setEvmAccount(recovered.asset === 'USDT' ? recovered.sender : null)
      }
    } catch (error) {
      if (showFailure) setMessage(error instanceof Error ? error.message : 'Could not check your purchase access.')
    }
  }

  async function authorize() {
    setBusy(true); setMessage('')
    try {
      const approved = await devices.preparePurchase()
      setAccess(approved)
      if (approved) await loadExisting(true)
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not approve purchase access.') }
    finally { setBusy(false) }
  }
  async function chooseUsdt() {
    setBusy(true); setMessage('')
    try { setEvmAccount(await choosePolygonAccount()) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not select a USDT wallet.') }
    finally { setBusy(false) }
  }
  async function review() {
    setBusy(true); setMessage('')
    try {
      const result = await coreRequest<{ order: Order }>('/v1/purchases', { method: 'POST', headers: { ...devices.purchaseHeaders(),
        'content-type': 'application/json', 'idempotency-key': requestKey.current },
        body: JSON.stringify({ pathId: skill.id, version: skill.version, asset, sender: asset === 'USDT' ? evmAccount : account }) })
      setOrder(result.order)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not prepare this purchase.') }
    finally { setBusy(false) }
  }
  async function bindUsdt() {
    if (!order?.binding || !evmAccount) return
    setBusy(true); setMessage('')
    try {
      const signature = await approvePurchaseBinding(evmAccount as `0x${string}`, order.binding)
      const result = await coreRequest<{ order: Order }>(`/v1/purchases/${order.id}/bind`, { method: 'POST', headers: { ...devices.purchaseHeaders(), 'content-type': 'application/json' }, body: JSON.stringify({ signature }) })
      setOrder(result.order)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not approve this USDT purchase.') }
    finally { setBusy(false) }
  }
  async function submitPayment() {
    if (!order) return
    if (order.status === 'quoted' && Date.parse(order.expiresAt) <= Date.now()) {
      setOrder(null); setAcceptedMainnet(false); requestKey.current = createIdempotencyKey()
      setMessage('This payment review expired. Review the purchase again before paying.')
      return
    }
    setBusy(true); setMessage('')
    try {
      if (order.asset === 'NIM') {
        await payNim({ recipient: order.recipient, value: Number(order.amountAtomic), reference: order.id })
        rememberPendingReference(order.id, NIM_SUBMITTED)
        setOrder(current => current ? { ...current, status: 'submitted' } : current)
        await check()
      } else {
        const hash = await payUsdt({ account: order.sender as `0x${string}`, token: order.tokenAddress as `0x${string}`,
          recipient: order.recipient as `0x${string}`, amount: BigInt(order.amountAtomic) })
        rememberPendingReference(order.id, hash)
        setOrder(current => current ? { ...current, transactionHash: hash, status: 'submitted' } : current)
        await check(hash)
      }
    } catch (error) { setMessage(getPaymentError(error, account)) }
    finally { setBusy(false) }
  }
  async function check(hash = order?.transactionHash ?? undefined) {
    if (!order || (order.asset === 'USDT' && !hash)) return
    setBusy(true); setMessage('Checking the confirmed transaction…')
    try {
      const result = await coreRequest<{ order: Order; unlocked: boolean; pending?: boolean }>(`/v1/purchases/${order.id}/verify`, {
        method: 'POST', headers: { ...devices.purchaseHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify(order.asset === 'NIM' ? {} : { transactionHash: hash }) })
      setOrder(result.order)
      if (result.order.status === 'validated' || result.order.status === 'rejected') forgetPendingHash(order.id)
      if (result.unlocked) { setMessage('Path unlocked.'); onUnlocked() }
      else setMessage('Payment submitted. Check again after it is confirmed.')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Could not check the payment yet.'
      setMessage(`${detail} Do not pay again; use Check payment.`)
    }
    finally { setBusy(false) }
  }

  if (!available.length) return <section className="purchase-panel purchase-panel--disabled">
    <div><span>Paid Path</span><strong>{skill.prices.map(price => `${amount(price.amountAtomic, price.decimals)} ${price.asset}`).join(' or ')}</strong></div>
    <p>Checkout is not enabled for this Path yet. If you already purchased it, check your existing access.</p>
    {access ? <button className="secondary-button" type="button" disabled><LockKeyhole size={16} /> Checkout unavailable</button>
      : <button className="secondary-button" type="button" disabled={busy} onClick={() => void authorize()}><LockKeyhole size={16} /> Check existing access</button>}
    {message && <p className="purchase-message" role="status">{message}</p>}
  </section>

  return <section className="purchase-panel" aria-labelledby="purchase-title">
    <div className="purchase-panel__heading"><span><CircleDollarSign size={18} /></span><div><h2 id="purchase-title">Unlock this Path</h2><p>One payment. Keep access with this Nimiq wallet.</p></div></div>
    <div className="purchase-assets" aria-label="Payment currency">{available.map(price => <button key={price.asset} className={asset === price.asset ? 'is-active' : ''} type="button" disabled={Boolean(order)} onClick={() => setAsset(price.asset)}><strong>{amount(price.amountAtomic, price.decimals)} {price.asset}</strong><small>{price.asset === 'NIM' ? 'Nimiq Mainnet' : 'Polygon'}</small></button>)}</div>
    {!access ? <button className="primary-button" type="button" disabled={busy} onClick={() => void authorize()}>{busy ? 'Waiting for approval…' : 'Approve purchase access'}</button>
      : asset === 'USDT' && !evmAccount ? <button className="primary-button" type="button" disabled={busy} onClick={() => void chooseUsdt()}>Choose USDT wallet</button>
        : !order ? <button className="primary-button" type="button" disabled={busy} onClick={() => void review()}>{busy ? 'Preparing…' : 'Review purchase'}</button>
          : <div className="purchase-review">
            <dl><div><dt>Path</dt><dd>{skill.title} · version {order.version}</dd></div><div><dt>Seller</dt><dd>{skill.creator.displayName}</dd></div><div><dt>You pay</dt><dd>{amount(order.amountAtomic, order.decimals)} {order.asset}</dd></div><div><dt>Network</dt><dd>{networkName(order.network)}</dd></div><div><dt>Recipient</dt><dd title={order.recipient}>{short(order.recipient)}</dd></div></dl>
            {order.asset === 'NIM' && order.network === 'nimiq-mainnet' && order.status === 'quoted' && !order.transactionHash && <label className="network-check"><input type="checkbox" checked={acceptedMainnet} onChange={event => setAcceptedMainnet(event.target.checked)} /><span>This uses real NIM on Mainnet. I reviewed the seller, recipient and amount.</span></label>}
            {order.asset === 'USDT' && !order.senderVerified && <button className="primary-button" type="button" disabled={busy} onClick={() => void bindUsdt()}>Approve this USDT wallet</button>}
            {order.asset === 'USDT' && order.senderVerified && !order.transactionHash && !polygonReady && <button className="secondary-button" type="button" disabled={busy} onClick={() => void usePolygon().then(() => { setPolygonReady(true); setMessage('Polygon selected. Review once more, then pay.') }).catch(error => setMessage(error instanceof Error ? error.message : 'Could not switch network.'))}>Switch to Polygon</button>}
            {order.status === 'quoted' && !order.transactionHash && (order.asset === 'NIM' ? order.network === 'nimiq-mainnet' && acceptedMainnet : order.senderVerified && polygonReady) && <button className="primary-button" type="button" disabled={busy} onClick={() => void submitPayment()}>{busy ? 'Waiting for Nimiq Pay…' : `Pay ${amount(order.amountAtomic, order.decimals)} ${order.asset}`}</button>}
            {order.status === 'submitted' && (order.asset === 'NIM' || Boolean(order.transactionHash)) && <button className="secondary-button" type="button" disabled={busy} onClick={() => void check()}><RefreshCw size={15} /> Check payment</button>}
            {order.status === 'validated' && <p className="purchase-success"><Check size={15} /> Path unlocked</p>}
          </div>}
    {message && <p className="purchase-message" role="status">{message}</p>}
    <small className="purchase-safety">Nimiq Pay shows every transaction for your approval. Truly never handles your wallet keys.</small>
  </section>
}
