import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean; account: string | null; onClose: () => void;
  onDiscover: () => Promise<string[]>; onSelect: (account: string) => Promise<void>;
  onReconnect: () => Promise<boolean>;
}

export function WalletConnectSheet({ open, account, onClose, onDiscover, onSelect, onReconnect }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), generation = useRef(0), lock = useRef(false)
  const titleId = useId()
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useEffect(() => {
    generation.current++; lock.current = false
    if (open) { setMessage(''); setBusy(false); dialog.current?.showModal() }
    else dialog.current?.close()
    return () => { generation.current++ }
  }, [open])
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setMessage('')
    const revision = generation.current
    try { await work() } catch (error) { if (revision === generation.current) setMessage(error instanceof Error ? error.message : 'Could not connect. Try again.') }
    finally { if (revision === generation.current) { lock.current = false; setBusy(false) } }
  }
  return <dialog ref={dialog} className="wallet-connect-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !busy) { const rect = dialog.current!.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }}>
    <div className="sheet-grabber" aria-hidden="true" />
    <header className="task-sheet__header"><h2 id={titleId}>{account ? 'Reconnect wallet' : 'Connect wallet'}</h2><button className="icon-button" aria-label="Close wallet chooser" disabled={busy} onClick={onClose}><X size={18} /></button></header>
    {account ? <>
      <p className="wallet-sheet-intro">Nimiq Pay controls the account that signs Mini App requests. Reconnect to refresh that signing account.</p>
      <button className="primary-button" disabled={busy} onClick={() => { void run(async () => {
        if (!await onReconnect()) throw new Error('Could not disconnect securely. Check your connection and try again.')
      }) }}>{busy ? 'Disconnecting…' : 'Disconnect and reconnect'}</button>
      <p className="wallet-sheet-note">Your purchases, Tasks, progress and paired Macs remain saved under this wallet.</p>
    </> : <>
      <p className="wallet-sheet-intro">Nimiq Pay will connect the primary account it uses to sign Mini App requests.</p>
      <button className="primary-button" disabled={busy} onClick={() => { void run(async () => {
        const revision = generation.current
        const accounts = await onDiscover()
        if (revision !== generation.current) return
        const primary = accounts[0]
        if (!primary) throw new Error('Nimiq Pay did not share a signing account. Try again.')
        await onSelect(primary)
        onClose()
      }) }}>{busy ? 'Waiting for Nimiq Pay…' : 'Connect through Nimiq Pay'}</button>
      <p className="wallet-sheet-note">Add or recover wallets in Nimiq Pay. Truly never asks for recovery words.</p>
    </>}
    {message && <p className="form-error" role="alert">{message}</p>}
  </dialog>
}
