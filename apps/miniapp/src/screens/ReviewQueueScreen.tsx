import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { CoreRequestError, coreRequest } from '../core/client'
import { resumeBrowserSession } from '../core/browser-session'
import type { CreatorDraft, CreatorProfile } from '../core/creator-studio'
import { PathReviewPreview } from '../components/PathReviewPreview'

type ReviewDraft = CreatorDraft & { creator: CreatorProfile | null }
interface Props { account: string; signMessage: (message: string) => Promise<{ publicKey: string; signature: string }>; onBack: () => void; onPublishedChange: () => void }

export function ReviewQueueScreen({ account, signMessage, onBack, onPublishedChange }: Props) {
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]), [selected, setSelected] = useState<ReviewDraft | null>(null)
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [note, setNote] = useState(''), [exercised, setExercised] = useState(false)
  const generation = useRef(0), lock = useRef(false), grant = useRef<{ token?: string; expiresAt: string } | null>(null)
  const headers = () => {
    if (!grant.current || Date.parse(grant.current.expiresAt) <= Date.now()) { setReady(false); throw new Error('Review sign-in expired. Approve again and refresh the snapshot before deciding.') }
    return { 'content-type': 'application/json', 'x-truly-account': account, ...(grant.current.token ? { authorization: `Bearer ${grant.current.token}` } : {}) }
  }
  const load = async (current: () => boolean) => {
    const result = await coreRequest<{ drafts: ReviewDraft[] }>('/v1/studio/review-queue', { headers: headers() })
    if (current()) { setDrafts(result.drafts); setReady(true) }
  }
  const run = async (work: (current: () => boolean) => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setMessage('')
    const revision = generation.current, current = () => generation.current === revision
    try { await work(current) } catch (error) {
      if (current()) {
        if (error instanceof CoreRequestError && [401,403].includes(error.status)) { grant.current = null; setReady(false); setDrafts([]); setSelected(null) }
        setMessage(error instanceof Error ? error.message : 'Could not check reviews. Refresh before deciding again.')
      }
    } finally { if (current()) { lock.current = false; setBusy(false) } }
  }
  useEffect(() => {
    const revision = ++generation.current, current = () => generation.current === revision
    void resumeBrowserSession().then(async session => {
      if (!current() || session?.account.replace(/\s/g,'') !== account.replace(/\s/g,'') || !session.scopes.includes('review:read')) return
      grant.current = { expiresAt: session.expiresAt }
      await load(current)
    }).catch(error => { if (current()) setMessage(error instanceof Error ? error.message : 'Could not resume reviews.') })
    return () => { generation.current++ }
    // No signature is requested on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])
  const approve = () => run(async current => {
    const challenge = await coreRequest<{ challengeId: string; message: string }>('/v1/auth/challenges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: account, purpose: 'review' }) })
    if (!current()) return
    const signed = await signMessage(challenge.message)
    if (!current()) return
    const session = await coreRequest<{ token: string; expiresAt: string }>(`/v1/auth/challenges/${challenge.challengeId}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(signed) })
    if (current()) { grant.current = session; await load(current) }
  })
  const decide = (decision: 'published' | 'rejected') => run(async current => {
    if (!selected || !note.trim() || (decision === 'published' && !exercised)) return
    if (!window.confirm(decision === 'published' ? `Publish “${selected.document.title}” revision ${selected.revision}? It becomes public with the displayed price and recipient.` : 'Reject this saved snapshot and send your notes to its creator?')) return
    const result = await coreRequest<{ status: string }>(`/v1/studio/review-queue/${selected.id}`, { method: 'POST', headers: headers(), body: JSON.stringify({ revision: selected.revision, decision, note: note.trim() }) })
    if (!current()) return
    setSelected(null); setNote(''); setExercised(false); setMessage(result.status === 'published' ? 'Path published.' : 'Changes requested.'); onPublishedChange(); await load(current)
  })
  return <main className="screen studio-screen page-enter">
    <button className="back-button" disabled={busy} onClick={onBack}><ArrowLeft size={17} /> Creator Studio</button>
    <section className="screen-intro screen-intro--compact"><span className="studio-kicker">Admin · manual review</span><h1>Review queue</h1><p>Review the saved version—not a creator’s later edits. Approval publishes exactly this snapshot.</p></section>
    {!ready && <section className="quiet-card studio-sign-in"><h2>Approve reviewer access</h2><p>Only server-authorized admin wallets can read submissions and publish or reject them. This 15-minute sign-in cannot send money.</p><button className="primary-button" disabled={busy} onClick={() => { void approve() }}>{busy ? 'Waiting for approval…' : 'Approve reviewer access'}</button></section>}
    {message && <p className="inline-note inline-note--neutral" role="status">{message}</p>}
    {ready && <section className="studio-library"><div className="studio-heading"><h2>Submitted Paths · {drafts.length}</h2><button className="text-button" disabled={busy} onClick={() => { void run(async current => { await load(current); if (current()) { setSelected(null); setNote(''); setExercised(false); setMessage('Queue refreshed. Select a snapshot before deciding.') } }) }}>Refresh queue</button></div>
      {!drafts.length && <p>No Paths are waiting for review.</p>}
      <div className="studio-path-list">{drafts.map(draft => <button className="quiet-card" key={draft.id} disabled={busy} onClick={() => { setSelected(draft); setNote(''); setExercised(false); setMessage('') }}><strong>{draft.document.title}</strong><span>{draft.creator?.displayName} · revision {draft.revision} · v{draft.baseVersion + 1}</span></button>)}</div>
    </section>}
    {selected && ready && <section className="quiet-card studio-editor">
      <p>Saved revision {selected.revision} · proposed version {selected.baseVersion + 1}</p>
      <p>Creator: {selected.creator?.displayName} · {selected.creator?.slug}</p>
      <p className="studio-address">NIM recipient: {selected.creator?.nimiqAddress}</p>
      {selected.creator?.nimiqAddress === account.replace(/\s/g,'') && <p className="inline-note inline-note--neutral">You are also this Path’s creator. This approval will be recorded as a self-review.</p>}
      <PathReviewPreview document={selected.document} />
      <section className="review-checklist" aria-labelledby="review-checklist-title"><h3 id="review-checklist-title">Before you decide</h3><ol><li>Follow every step in order and exercise its practice challenge.</li><li>Open each starting point and resource; check accuracy, safety and content rights.</li><li>Confirm the completion criteria describe evidence Truly can actually see.</li><li>Confirm the free or paid setting, NIM amount and recipient shown above.</li></ol></section>
      <div className="plan-editor review-decision"><label>Review notes<small>Record what you checked and explain any change the creator needs to make.</small><textarea maxLength={2000} rows={3} placeholder="Checked the instructions, links, visible criteria, access setting and recipient." value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
        <label className="review-attestation"><input type="checkbox" checked={exercised} disabled={busy} onChange={event => setExercised(event.target.checked)} /> I exercised the steps and reviewed accuracy, links, content rights, visible completion criteria, price and recipient.</label>
        <p>Paid checkout still requires approved payment configuration. A checkbox is your review statement, not automatic proof of quality.</p>
        <div className="studio-editor-actions"><button className="primary-button" disabled={busy || !note.trim() || !exercised} onClick={() => { void decide('published') }}>Approve and publish</button><button className="secondary-button" disabled={busy || !note.trim()} onClick={() => { void decide('rejected') }}>Request changes</button></div>
      </div>
    </section>}
  </main>
}
