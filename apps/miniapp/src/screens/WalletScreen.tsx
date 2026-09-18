import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BookOpen, Check, Clock3, ExternalLink, Laptop, LogOut, WalletCards } from 'lucide-react'
import type { WalletActivityOrder } from '../types'
import { walletPortfolioBoundary } from '../core/wallet-presentation'

interface WalletScreenProps {
  account: string
  message?: string | null
  accessReady: boolean
  loadWalletActivity: () => Promise<WalletActivityOrder[]>
  onBack: () => void
  onShowDevices: () => void
  onDisconnect: () => Promise<void>
  onOpenStudio: () => void
  onSwitchAccount: () => void
}

const formatAmount = (atomic: string, decimals: number) => {
  const padded = atomic.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals) || '0'
  const fraction = padded.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

export function WalletScreen({ account, message, accessReady, loadWalletActivity, onBack, onShowDevices, onDisconnect, onOpenStudio, onSwitchAccount }: WalletScreenProps) {
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState<WalletActivityOrder[]>([])
  const [activityState, setActivityState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  const refreshActivity = useCallback(async () => {
    if (!accessReady) return
    setActivityState('loading')
    try {
      setActivity(await loadWalletActivity())
      setActivityState('ready')
    } catch {
      setActivityState('failed')
    }
  }, [accessReady, loadWalletActivity])

  useEffect(() => { void refreshActivity() }, [refreshActivity])

  return (
    <main className="screen wallet-screen page-enter">
      <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={17} /> Back</button>
      <section className="screen-intro screen-intro--compact">
        <h1>Wallet &amp; access</h1>
        <p>Your Nimiq wallet connects your learning across Truly. Nimiq Pay keeps your keys and funds safe.</p>
      </section>

      <section className="wallet-identity" aria-label="Connected wallet">
        <span>Connected through Nimiq Pay</span>
        <strong>{account}</strong>
      </section>

      <section className="wallet-portfolio-boundary" aria-labelledby="wallet-portfolio-title">
        <span><WalletCards size={18} /></span>
        <div><h2 id="wallet-portfolio-title">{walletPortfolioBoundary.title}</h2><p>{walletPortfolioBoundary.body}</p></div>
      </section>

      <section className="wallet-activity" aria-labelledby="wallet-activity-title">
        <div className="wallet-activity__heading">
          <div><h2 id="wallet-activity-title">Truly activity</h2><p>Path payments and access checks made through Truly.</p></div>
          {accessReady && <button className="text-button" type="button" disabled={activityState === 'loading'} onClick={() => { void refreshActivity() }}>Refresh</button>}
        </div>
        {activityState === 'loading' && !activity.length ? <p className="wallet-activity__empty">Loading activity…</p>
          : activityState === 'failed' && !activity.length ? <p className="wallet-activity__empty">Activity could not be loaded. Try Refresh.</p>
            : !activity.length ? <p className="wallet-activity__empty">No Truly payments yet.</p>
              : <ul>{activity.slice(0, 6).map(item => <li key={item.id}>
                <span className={`wallet-activity__icon wallet-activity__icon--${item.status}`}>
                  {item.status === 'validated' ? <Check size={15} /> : <Clock3 size={15} />}
                </span>
                <div><strong>{item.pathTitle ?? 'Path purchase'}</strong><small>{item.status === 'validated' ? 'Path unlocked' : 'Payment sent · checking confirmation'}</small></div>
                <div className="wallet-activity__amount"><strong>{formatAmount(item.amountAtomic, item.decimals)} {item.asset}</strong><small>{new Intl.DateTimeFormat(navigator.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(item.createdAt))}</small></div>
              </li>)}</ul>}
        <p className="wallet-activity__boundary"><ArrowUpRight size={13} /> Full wallet history remains in Nimiq Pay.</p>
      </section>

      <section className="account-actions" aria-label="Truly wallet actions">
        <button type="button" onClick={onSwitchAccount}><span className="account-actions__icon"><WalletCards size={18} /></span><span><strong>Switch account</strong><small>Choose another account shared by Nimiq Pay.</small></span><ExternalLink size={16} /></button>
        <button type="button" onClick={onOpenStudio}>
          <span className="account-actions__icon"><BookOpen size={18} /></span>
          <span><strong>Creator Studio</strong><small>Create free or paid Paths.</small></span>
          <ExternalLink size={16} />
        </button>
        <button type="button" onClick={onShowDevices}>
          <span className="account-actions__icon"><Laptop size={18} /></span>
          <span><strong>Connected Macs</strong><small>Review or remove a Mac.</small></span>
          <ExternalLink size={16} />
        </button>
        <div className="account-actions__row">
          <span className="account-actions__icon"><BookOpen size={18} /></span>
          <span><strong>Your Paths</strong><small>Paths you unlock will appear here.</small></span>
        </div>
      </section>

      <section className="quiet-card wallet-boundary">
        <h2>Manage funds in Nimiq Pay</h2>
        <p>Your full portfolio, staking, top ups, withdrawals, recovery words, networks, and transfers stay in Nimiq Pay—not inside Truly.</p>
      </section>

      <button className="disconnect-button" type="button" disabled={busy} onClick={() => { setBusy(true); void onDisconnect().finally(() => setBusy(false)) }}>
        <LogOut size={17} /> {busy ? 'Disconnecting…' : 'Disconnect from Truly'}
      </button>
      {message && <p role="status">{message}</p>}
      <p className="disconnect-note">This disconnects your wallet from Truly on this phone. It will not remove a paired Mac or change anything in Nimiq Pay.</p>
    </main>
  )
}
