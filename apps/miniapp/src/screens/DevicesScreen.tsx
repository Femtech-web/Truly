import { ArrowRight, Check, Laptop, ShieldCheck, Smartphone } from 'lucide-react'
import type { usePairing } from '../hooks/usePairing'
import type { useDevices } from '../hooks/useDevices'
import { useEffect, useState } from 'react'

interface DevicesScreenProps {
  pairing: ReturnType<typeof usePairing>
  devices: ReturnType<typeof useDevices>
  account: string | null
  walletKind: 'nimiq' | 'demo' | null
  onConnect(): void
}

export function DevicesScreen({ pairing, devices, account, walletKind, onConnect }: DevicesScreenProps) {
  const refresh = devices.refresh
  useEffect(() => { void refresh() }, [refresh])
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const isBusy = pairing.status === 'looking-up' || pairing.status === 'signing' || devices.busy

  return (
    <main className="screen page-enter">
      <section className="screen-intro screen-intro--compact">
        <h1>Your devices</h1>
        <p>Connect Truly on your Mac with a one-time code. Your funds never move.</p>
      </section>

      <section className="pairing-visual" aria-label="Phone and Mac ready to pair">
        <div className="pairing-device pairing-device--phone"><Smartphone size={26} /><span>This phone</span></div>
        <div className="pairing-line"><span /><span /><span /></div>
        <div className="pairing-device pairing-device--mac"><Laptop size={30} /><span>Your Mac</span></div>
      </section>

      <section className="pairing-card">
        {pairing.status === 'paired' ? (
          <div className="pairing-success" role="status">
            <span><Check size={18} /></span>
            <div><h2>Mac paired.</h2><p>{pairing.message}</p></div>
            <button className="secondary-button" type="button" disabled={isBusy} onClick={pairing.reset}>Pair another Mac</button>
          </div>
        ) : pairing.preview ? (
          <div className="pairing-confirmation">
            <h2>Pair {pairing.preview.deviceName}?</h2>
            <dl>
              <div><dt>Device</dt><dd>{pairing.preview.deviceName}</dd></div>
              <div><dt>System</dt><dd>{pairing.preview.platform}</dd></div>
              <div><dt>Code valid until</dt><dd>{new Date(pairing.preview.expiresAt).toLocaleTimeString()}</dd></div>
              <div><dt>Wallet</dt><dd>{account ? `${account.slice(0, 8)}…${account.slice(-5)}` : 'Not connected'}</dd></div>
            </dl>
            <p>Nimiq Pay will ask you to approve this Mac. This cannot move your funds.</p>
            {pairing.message && <p className="pairing-error" role="alert">{pairing.message}</p>}
            {!account ? (
              <button className="primary-button" type="button" disabled={isBusy || walletKind !== 'nimiq'} onClick={onConnect}>Connect Nimiq wallet <ArrowRight size={17} /></button>
            ) : (
              <button className="primary-button" type="button" disabled={isBusy} onClick={pairing.approve}>
                {pairing.status === 'signing' ? 'Waiting for approval…' : 'Approve and pair Mac'} <ArrowRight size={17} />
              </button>
            )}
            <button className="pairing-back" type="button" disabled={isBusy} onClick={pairing.reset}>Use a different code</button>
          </div>
        ) : (
          <>
            <h2>Pair your Mac</h2>
            <p>On your Mac, open Truly in the menu bar, then Settings → Connection → Pair this Mac. Enter the code below.</p>
            <label className="pairing-code-field">
              <span className="sr-only">Six-character pairing code</span>
              <input
                value={pairing.code}
                onChange={(event) => pairing.setCode(event.target.value)}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={6}
                placeholder="TRULY2"
              />
            </label>
            <p>This one-time code expires after five minutes.</p>
            {!pairing.isCoreConfigured && <p className="pairing-error" role="alert">Truly cannot connect right now. Check the app setup and try again.</p>}
            {pairing.message && <p className="pairing-error" role="alert">{pairing.message}</p>}
            <button className="primary-button" type="button" disabled={isBusy || pairing.code.length !== 6 || !pairing.isCoreConfigured} onClick={pairing.lookup}>
              {pairing.status === 'looking-up' ? 'Checking code…' : 'Verify code'} <ArrowRight size={17} />
            </button>
          </>
        )}
      </section>

      <section className="pairing-card device-management">
        <h2>Connected Macs</h2>
        <p>Approve once to view your Macs, remove access, or start learning. The approval lasts 15 minutes and cannot move funds.</p>
        {walletKind !== 'nimiq' && <p>Open Truly inside Nimiq Pay to pair or manage your Macs.</p>}
        {!account ? <button className="secondary-button" type="button" disabled={isBusy || walletKind !== 'nimiq'} onClick={onConnect}>Connect Nimiq wallet</button> :
          <button className="secondary-button" type="button" disabled={isBusy || walletKind !== 'nimiq'} onClick={devices.manage}>
            {devices.busy ? 'Working…' : devices.ready ? 'Refresh devices' : 'Approve Truly access'}
          </button>}
        {devices.message && <p role="status">{devices.message}</p>}
        {devices.ready && devices.devices.length === 0 && <p>No Macs paired to this wallet yet.</p>}
        {devices.devices.map((device) => (
          <div className="owned-device" key={device.id}>
            <div><h3>{device.name}</h3><p>{device.platform} · {device.status === 'revoked' ? 'Access revoked' : 'Paired'}</p></div>
            {device.status === 'active' && (revokingId === device.id ?
              <div className="revoke-confirmation">
                <p>Remove this Mac? You’ll need to pair it again before using Truly.</p>
                <button className="secondary-button" disabled={isBusy} type="button" onClick={() => { void devices.revoke(device.id); setRevokingId(null) }}>Remove access</button>
                <button className="pairing-back" disabled={isBusy} type="button" onClick={() => setRevokingId(null)}>Keep connected</button>
              </div> : <button className="secondary-button" disabled={isBusy} type="button" onClick={() => setRevokingId(device.id)}>Remove access</button>)}
          </div>
        ))}
      </section>

      <div className="inline-note inline-note--neutral">
        <ShieldCheck size={18} />
        <p>Your wallet approves every connection. Truly never asks for recovery words or private keys.</p>
      </div>
    </main>
  )
}
