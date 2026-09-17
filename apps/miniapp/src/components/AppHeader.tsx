import { Check, LoaderCircle, WifiOff } from 'lucide-react'
import type { WalletState } from '../wallet/types'
import { BrandMark } from './BrandMark'

interface AppHeaderProps {
  wallet: WalletState
  onConnect: () => void
  onShowWallet: () => void
}

function shortAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-4)}`
}

export function AppHeader({ wallet, onConnect, onShowWallet }: AppHeaderProps) {
  const isConnected = wallet.status === 'connected' && wallet.account

  return (
    <header className="app-header">
      <div className="brand-lockup" aria-label="Truly">
        <BrandMark size={26} />
        <span>Truly</span>
      </div>

      {isConnected ? (
        <button className="wallet-pill" type="button" onClick={onShowWallet} title="Wallet & access" aria-label={`Open wallet and access settings for ${wallet.account}`}>
          <Check size={13} strokeWidth={2.4} />
          <span>{shortAddress(wallet.account!)}</span>
        </button>
      ) : wallet.status === 'initializing' ? (
        <div className="wallet-pill wallet-pill--quiet">
          <LoaderCircle className="spin" size={13} />
          <span>Connecting</span>
        </div>
      ) : wallet.status === 'unavailable' ? (
        <div className="wallet-pill wallet-pill--quiet">
          <WifiOff size={13} />
          <span>Preview</span>
        </div>
      ) : (
        <button className="text-button" type="button" onClick={onConnect} disabled={wallet.status === 'connecting'}>
          {wallet.status === 'connecting' ? 'Connecting…' : 'Connect'}
        </button>
      )}
    </header>
  )
}
