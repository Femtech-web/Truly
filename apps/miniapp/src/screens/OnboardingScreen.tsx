import type { WalletState } from '../wallet/types'
import { BrandMark } from '../components/BrandMark'

interface OnboardingScreenProps {
  wallet: WalletState
  onConnect: () => void
  onBrowse: () => void
}

export function OnboardingScreen({ wallet, onConnect, onBrowse }: OnboardingScreenProps) {
  const providerReady = wallet.status !== 'initializing' && wallet.status !== 'unavailable'
  const isBusy = wallet.status === 'initializing' || wallet.status === 'connecting'

  return (
    <main className="onboarding page-enter">
      <div className="onboarding__brand"><BrandMark size={34} /><span>Truly</span></div>

      <section className="onboarding__intro">
        <div className="companion-orb" aria-hidden="true"><span /></div>
        <h1>Learn anything.<br /><em>By doing it.</em></h1>
        <p>Choose a Path here, then practise on your Mac with a companion that understands what you choose to share.</p>
      </section>

      <section className="connect-card" aria-labelledby="wallet-connect-title">
        <h2 id="wallet-connect-title">Connect your wallet</h2>
        <p>Connect to pair your Mac. You approve access in Nimiq Pay.</p>

        <button className="primary-button" type="button" onClick={onConnect} disabled={!providerReady || isBusy}>
          {wallet.status === 'initializing' ? 'Finding Nimiq Pay…' : wallet.status === 'connecting' ? 'Waiting for approval…' : 'Connect Nimiq wallet'}
        </button>

        {wallet.message && <p className="status-message" role="status">{wallet.message}</p>}

      </section>

      <button className="browse-button" type="button" onClick={onBrowse}>Browse without connecting</button>
    </main>
  )
}
