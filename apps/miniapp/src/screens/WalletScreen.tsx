import { ArrowLeft, BookOpen, ExternalLink, Laptop, LogOut } from 'lucide-react'

interface WalletScreenProps {
  account: string
  onBack: () => void
  onShowDevices: () => void
  onDisconnect: () => void
}

export function WalletScreen({ account, onBack, onShowDevices, onDisconnect }: WalletScreenProps) {
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

      <section className="account-actions" aria-label="Truly wallet actions">
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
        <p>Balances, top up, withdraw, recovery words, networks, and general transfers stay in the wallet app—not inside Truly.</p>
      </section>

      <button className="disconnect-button" type="button" onClick={onDisconnect}>
        <LogOut size={17} /> Disconnect from Truly
      </button>
      <p className="disconnect-note">This disconnects your wallet from Truly on this phone. It will not remove a paired Mac or change anything in Nimiq Pay.</p>
    </main>
  )
}
