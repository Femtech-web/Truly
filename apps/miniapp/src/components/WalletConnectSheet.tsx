import { useEffect, useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

interface Props {
  open: boolean; account: string | null; onClose: () => void;
  onDiscover: () => Promise<string[]>; onSelect: (account: string) => Promise<void>;
}

export function WalletConnectSheet({ open, account, onClose, onDiscover, onSelect }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), generation = useRef(0), lock = useRef(false)
  const titleId = useId()
  const [accounts, setAccounts] = useState<string[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useEffect(() => {
    generation.current++; lock.current = false
    if (open) { setAccounts([]); setMessage(''); setBusy(false); dialog.current?.showModal() }
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
    <header className="task-sheet__header"><h2 id={titleId}>{account ? 'Switch account' : 'Connect wallet'}</h2><button className="icon-button" aria-label="Close wallet chooser" disabled={busy} onClick={onClose}><X size={18} /></button></header>
    <p className="wallet-sheet-intro">Choose an account from Nimiq Pay.</p>
    <button className="primary-button" disabled={busy} onClick={() => { void run(async () => { const revision = generation.current; const result = await onDiscover(); if (revision === generation.current) setAccounts(result) }) }}>{busy ? 'Waiting for Nimiq Pay…' : accounts.length ? 'Refresh accounts' : 'Connect through Nimiq Pay'}</button>
    {accounts.length > 0 && <div className="wallet-account-list" aria-label="Available accounts">{accounts.map(address => <button className="secondary-button" key={address} disabled={busy} onClick={() => { void run(async () => { await onSelect(address); onClose() }) }}><span>{address.match(/.{1,4}/g)?.join(' ')}</span>{address === account && <Check size={18} aria-label="Current account" />}</button>)}</div>}
    {message && <p className="form-error" role="alert">{message}</p>}
    <p className="wallet-sheet-note">Add or recover accounts in Nimiq Pay. Truly never asks for recovery words.</p>
  </dialog>
}
