import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Trash2, Check, LockKeyhole } from 'lucide-react'
import { CoreRequestError, coreRequest } from '../core/client'
import { resumeBrowserSession } from '../core/browser-session'
import { createIdempotencyKey } from '../core/idempotency'
import { moveItem, newCreatorDocument, newCreatorStep, type CreatorDocument, type CreatorDraft, type CreatorProfile, type CreatorStep, type StudioLibrary } from '../core/creator-studio'
import { creatorSubmissionIssues } from '../core/creator-submission'
import { canDeleteCreatorDraft } from '../core/creator-draft-policy'
import { CreatorProfileEditor, type CreatorProfileNotice } from '../components/CreatorProfileEditor'

interface Props { account: string; signMessage: (message: string) => Promise<{ publicKey: string; signature: string }>; onBack: () => void; onPublishedChange: () => void; onOpenReviews: () => void }
const lines = (value: string) => value.split('\n')
const statusLabel = { draft: 'Draft', review: 'In review', rejected: 'Changes requested', published: 'Published' }

export function CreatorStudioScreen({ account, signMessage, onBack, onPublishedChange, onOpenReviews }: Props) {
  const [library, setLibrary] = useState<StudioLibrary | null>(null)
  const [selected, setSelected] = useState<CreatorDraft | null>(null)
  const [document, setDocument] = useState<CreatorDocument | null>(null)
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [preview, setPreview] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [submissionNotice, setSubmissionNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [profileNotice, setProfileNotice] = useState<CreatorProfileNotice | null>(null)
  const generation = useRef(0), operation = useRef(false)
  const editorRef = useRef<HTMLElement | null>(null)
  const grant = useRef<{ token?: string; expiresAt: string } | null>(null)
  const pendingCreate = useRef<{ id: string; document?: CreatorDocument; skillId?: string } | null>(null)

  const headers = () => {
    if (!grant.current || Date.parse(grant.current.expiresAt) <= Date.now()) {
      setReady(false); throw new Error('Your creator sign-in expired. Approve again; unsaved edits stay here.')
    }
    return { 'content-type': 'application/json', 'x-truly-account': account, ...(grant.current.token ? { authorization: `Bearer ${grant.current.token}` } : {}) }
  }
  const run = async (work: (current: () => boolean) => Promise<void>, onError?: (message: string) => void) => {
    if (operation.current) return
    operation.current = true; setBusy(true); setMessage('')
    const revision = generation.current, current = () => generation.current === revision
    try { await work(current) } catch (error) {
      if (current()) {
        if (error instanceof CoreRequestError && error.status === 401) { grant.current = null; setReady(false) }
        const text = error instanceof Error ? error.message : 'Could not finish that. Your edits are still here.'
        if (onError) onError(text); else setMessage(text)
      }
    } finally { if (current()) { operation.current = false; setBusy(false) } }
  }
  const load = async (current: () => boolean) => {
    const response = await coreRequest<StudioLibrary>('/v1/studio/drafts', { headers: headers() })
    if (current()) { setLibrary(response); setProfile(response.creator); setReady(true) }
  }
  useEffect(() => {
    const revision = ++generation.current
    setLibrary(null); setSelected(null); setDocument(null); setProfile(null); setReady(false); setDirty(false); setMessage(''); setSubmissionNotice(null); setProfileNotice(null); setBusy(false)
    operation.current = false; grant.current = null; pendingCreate.current = null
    const current = () => revision === generation.current
    void resumeBrowserSession().then(async session => {
      if (!current() || !session || session.account.replace(/\s/g, '') !== account.replace(/\s/g, '') || !session.scopes.includes('studio:read')) return
      grant.current = { expiresAt: session.expiresAt }
      await load(current)
    }).catch(error => { if (current()) setMessage(error instanceof Error ? error.message : 'Could not resume Creator Studio.') })
    return () => { generation.current++ }
    // Creator approval only follows the button below; resumption is read-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])
  useEffect(() => {
    if (!selected) return
    const frame = requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [selected?.id])
  const approve = () => run(async current => {
    const challenge = await coreRequest<{ challengeId: string; message: string }>('/v1/auth/challenges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: account, purpose: 'studio' }) })
    if (!current()) return
    const signed = await signMessage(challenge.message)
    if (!current()) return
    const session = await coreRequest<{ token: string; expiresAt: string }>(`/v1/auth/challenges/${challenge.challengeId}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(signed) })
    if (!current()) return
    grant.current = session; await load(current)
  })
  const select = (draft: CreatorDraft) => {
    if (dirty && !window.confirm('Leave unsaved edits?')) return
    setSelected(draft); setDocument(structuredClone(draft.document)); setDirty(false); setPreview(false); setMessage(''); setSubmissionNotice(null)
  }
  const create = (skillId?: string) => run(async current => {
    if (dirty && !window.confirm('Leave unsaved edits?')) return
    if (!pendingCreate.current) pendingCreate.current = skillId ? { id: createIdempotencyKey(), skillId } : { id: createIdempotencyKey(), document: newCreatorDocument() }
    const result = await coreRequest<CreatorDraft>('/v1/studio/drafts', { method: 'POST', headers: headers(), body: JSON.stringify(pendingCreate.current) })
    if (!current()) return
    pendingCreate.current = null; setSelected(result); setDocument(result.document); setDirty(false); setPreview(false); setSubmissionNotice(null)
    await load(current)
  })
  const change = (patch: Partial<CreatorDocument>) => { if (document) { setDocument({ ...document, ...patch }); setDirty(true) } }
  const stepChange = (index: number, patch: Partial<CreatorStep>) => change({ steps: document!.steps.map((step, i) => i === index ? { ...step, ...patch } : step) })
  const save = async (current: () => boolean): Promise<CreatorDraft | null> => {
    if (!selected || !document) return null
    const result = await coreRequest<CreatorDraft>(`/v1/studio/drafts/${selected.id}`, { method: 'POST', headers: headers(), body: JSON.stringify({ revision: selected.revision, document }) })
    if (!current()) return null
    setSelected(result); setDocument(result.document); setDirty(false); return result
  }
  const submit = () => run(async current => {
    if (!selected || !document) return
    const issues = creatorSubmissionIssues(document)
    if (issues.length) throw new Error(`Complete before submitting: ${issues.join(', ')}.`)
    if (!window.confirm('Submit this saved version for review? It stays private until approved and cannot be edited during review.')) return
    const saved = dirty ? await save(current) : selected
    if (!saved || !current()) return
    const result = await coreRequest<CreatorDraft>(`/v1/studio/drafts/${saved.id}/submit`, { method: 'POST', headers: headers(), body: JSON.stringify({ revision: saved.revision }) })
    if (current()) { setSelected(result); setDocument(result.document); setSubmissionNotice({ kind: 'success', text: 'Submitted for review. This Path is private until approved.' }); await load(current) }
  }, text => setSubmissionNotice({ kind: 'error', text }))
  const removeDraft = () => run(async current => {
    if (!selected) return
    const title = document?.title.trim() || 'Untitled Path'
    if (!window.confirm(`Delete “${title}”? This private draft cannot be recovered.`)) return
    await coreRequest(`/v1/studio/drafts/${selected.id}`, { method: 'DELETE', headers: headers() })
    if (!current()) return
    setSelected(null); setDocument(null); setDirty(false); setPreview(false)
    await load(current)
    if (current()) setMessage('Draft deleted.')
  })
  const leave = () => { if (!dirty || window.confirm('Leave unsaved edits?')) onBack() }
  const saveProfile = () => {
    if (!profile) return
    setProfileNotice(null)
    void run(async current => {
      const result = await coreRequest<{ creator: CreatorProfile }>('/v1/studio/profile', { method: 'POST', headers: headers(), body: JSON.stringify(profile) })
      if (current()) { setProfile(result.creator); setProfileNotice({ kind: 'success', text: 'Profile saved.' }); onPublishedChange() }
    }, text => setProfileNotice({ kind: 'error', text }))
  }
  const locked = selected?.status !== 'draft'
  return <main className="screen studio-screen page-enter">
    <button className="back-button" type="button" onClick={leave}><ArrowLeft size={17} /> Back</button>
    <section className="screen-intro screen-intro--compact"><span className="studio-kicker">Create · preview · publish</span><h1>Creator Studio</h1><p>Turn what you know into a Path someone can follow. Make it free, or set a NIM price. Anyone can draft; publishing needs review.</p></section>
    <section className="quiet-card studio-publishing-guide" aria-labelledby="publishing-guide-title">
      <h2 id="publishing-guide-title">How publishing works</h2>
      <ol>
        <li><span>1</span><div><strong>Build the Path</strong><p>Add the learner outcome, ordered steps, useful resources, a practice challenge and visible completion criteria. Choose free or paid access.</p></div></li>
        <li><span>2</span><div><strong>Check it yourself</strong><p>Save the draft, preview the learner view and follow every step once. Use the arrow controls only when you need to change the order.</p></div></li>
        <li><span>3</span><div><strong>Submit a snapshot</strong><p>Submission locks that saved revision and keeps it private while it is reviewed. Later edits cannot change the submitted version.</p></div></li>
        <li><span>4</span><div><strong>Review and publish</strong><p>An authorized reviewer checks the instructions, links, criteria, access and recipient. Approval publishes that exact version; requested changes return it to you.</p></div></li>
      </ol>
    </section>
    {!ready && <section className="quiet-card studio-sign-in"><LockKeyhole size={24} /><h2>Start with your wallet</h2><p>Approve a 15-minute creator sign-in in Nimiq Pay. This creates your public creator profile and lets you save private drafts. No payment is requested. Your signed address receives NIM payments; publishing needs separate review.</p><p className="studio-address">{account}</p><button className="primary-button" disabled={busy} onClick={() => { void approve() }}>{busy ? 'Opening Creator Studio…' : 'Approve Creator Studio'}</button></section>}
    {message && <p className="inline-note inline-note--neutral" role="status">{message}</p>}
    {ready && library && <>
      {library.canReview && <section className="quiet-card studio-sign-in"><h2>Path reviews</h2><p>This wallet is an authorized admin. Review submitted snapshots before they appear publicly.</p><button className="secondary-button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Leave unsaved edits to open reviews?')) onOpenReviews() }}>Open review queue</button></section>}
      {profile && <CreatorProfileEditor profile={profile} busy={busy} notice={profileNotice}
        onChange={next => { setProfile(next); setProfileNotice(null) }} onSave={saveProfile} />}
      <section className="studio-library"><div className="studio-heading"><h2>Your Paths</h2><button className="text-button" disabled={busy} onClick={() => { void create() }}><Plus size={17} /> New Path</button></div><p>Drafts are private. Publishing an update creates a new version; existing learners keep their original plan.</p>
        <div className="studio-path-list">{library.drafts.map(draft => <button className="quiet-card" key={draft.id} disabled={busy} onClick={() => select(draft)}><strong>{draft.document.title || 'Untitled Path'}</strong><span>{statusLabel[draft.status]} · version {draft.baseVersion + 1}</span></button>)}</div>
        {library.paths.map(path => <div className="studio-published" key={path.id}><span><Check size={15} /> {path.title} · v{path.version}</span><button className="text-button" disabled={busy} onClick={() => { void create(path.id) }}>Draft an update</button></div>)}
        <button className="text-button" disabled={busy} onClick={() => { void run(async current => { await load(current); if (current()) { onPublishedChange(); setMessage('Studio refreshed. Select a Path to load its latest saved status. Your current edits were kept.') } }) }}>Refresh Studio</button>
      </section>
    </>}
    {document && selected && <section ref={editorRef} className="quiet-card studio-editor">
      <div className="studio-heading"><h2>{preview ? 'Learner preview' : 'Path editor'}</h2><button className="text-button" disabled={busy} onClick={() => setPreview(!preview)}>{preview ? 'Back to editor' : 'Preview'}</button></div>
      <p className="studio-save-state">{statusLabel[selected.status]} · {dirty ? 'Unsaved edits' : `Saved revision ${selected.revision}`}</p>
      {!preview && <p className="studio-editor-intro">Complete the Path details first, then open each step to add what the learner should do and what Truly should be able to see when checking their work.</p>}
      {selected.reviewNote && <p className="inline-note inline-note--neutral">Review: {selected.reviewNote}</p>}
      {preview ? <div className="studio-preview"><span>{document.category} · {document.priceNim === null ? 'Free' : `${document.priceNim} NIM`}</span><h2>{document.title || 'Untitled Path'}</h2><p>{document.summary}</p><p>{document.description}</p><p>{document.estimatedMinutes} minutes · {document.language} · {document.supportedEnvironments.join(', ')}</p><h3>What you’ll be able to do</h3><ul>{document.outcomes.filter(Boolean).map((outcome, i) => <li key={i}>{outcome}</li>)}</ul>{document.steps.map((step, i) => <section key={step.id}><h3>{i + 1}. {step.title || 'Untitled step'}</h3><p>{step.summary}</p>{step.workspaceLink && <p>Starting point: {step.workspaceLink.title} · {step.workspaceLink.url}</p>}<ul>{step.resources.map((resource, n) => <li key={n}>{resource.title} · {resource.url}</li>)}</ul><p>Challenge: {step.challenge}</p><ul>{step.rubric.filter(Boolean).map((criterion, n) => <li key={n}>{criterion}</li>)}</ul>{step.hints.length > 0 && <details><summary>Hints</summary>{step.hints.map((hint, n) => <p key={n}>{hint}</p>)}</details>}</section>)}<p>Preview only. No Task, payment or completion is created.</p></div>
        : <fieldset className="studio-fields plan-editor" disabled={busy || locked || !ready}>
          <legend className="sr-only">Path content</legend>
          <label>Title<input maxLength={120} value={document.title} onChange={e => change({ title: e.target.value })} /></label>
          <label>Path link<small>This becomes the Path’s public web address after publishing. Use short lowercase words separated by hyphens.</small><input maxLength={80} value={document.slug} onChange={e => change({ slug: e.target.value })} /></label>
          <label>Short summary<textarea rows={2} maxLength={300} value={document.summary} onChange={e => change({ summary: e.target.value })} /></label>
          <label>Description<small>Required for submission. Explain what the learner will build or practise.</small><textarea rows={3} maxLength={4000} value={document.description} onChange={e => change({ description: e.target.value })} /></label>
          <div className="studio-pair"><label>Subject<input maxLength={80} value={document.category} onChange={e => change({ category: e.target.value })} /></label><label>Language<input maxLength={40} value={document.language} onChange={e => change({ language: e.target.value })} /></label></div>
          <label>Estimated minutes<input type="number" min={1} max={10080} value={document.estimatedMinutes} onChange={e => change({ estimatedMinutes: Number(e.target.value) })} /></label>
          {(['outcomes', 'prerequisites', 'supportedEnvironments'] as const).map(key => <label key={key}>{key === 'outcomes' ? 'Outcomes' : key === 'prerequisites' ? 'What learners need before starting' : 'Tools / environments'}<small>{key === 'prerequisites' ? 'Optional. One per line, up to eight.' : 'Required for submission. One per line, up to eight.'}</small><textarea rows={3} value={document[key].join('\n')} onChange={e => change({ [key]: lines(e.target.value) })} /></label>)}
          <fieldset className="studio-pricing"><legend>Access</legend><label><input type="radio" name="path-price" checked={document.priceNim === null} onChange={() => change({ priceNim: null })} /> Free</label><label><input type="radio" name="path-price" checked={document.priceNim !== null} onChange={() => change({ priceNim: '0.01' })} /> Paid with NIM</label>{document.priceNim !== null && <label>NIM price<input inputMode="decimal" value={document.priceNim} onChange={e => change({ priceNim: e.target.value })} /><small>Up to five decimal places. Payments go directly to your verified Nimiq address. Checkout remains disabled unless Core approves this recipient and network. USDT is not enabled in this beta.</small></label>}</fieldset>
          <fieldset className="studio-tags"><legend>Tags · choose up to twelve</legend>{library?.tags.map(tag => <label key={tag.slug}><input type="checkbox" checked={document.tags.includes(tag.slug)} onChange={e => change({ tags: e.target.checked ? [...document.tags, tag.slug] : document.tags.filter(t => t !== tag.slug) })} /> {tag.label}<small>{tag.family}</small></label>)}</fieldset>
          <div className="studio-heading"><h3>Steps · {document.steps.length}/24</h3><button className="text-button" type="button" disabled={document.steps.length >= 24} onClick={() => change({ steps: [...document.steps, newCreatorStep()] })}><Plus size={17} /> Add step</button></div>
          <p className="studio-section-help">Steps run from top to bottom. Open one to edit it; use the up and down arrows to change the learner’s order.</p>
          {document.steps.map((step, i) => <details className="studio-step" key={step.id} open={document.steps.length === 1 ? true : undefined}><summary>{i + 1}. {step.title || 'Untitled step'}</summary><div className="studio-reorder"><button type="button" className="secondary-button" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => change({ steps: moveItem(document.steps, i, i - 1) })}><ArrowUp size={16} /></button><button type="button" className="secondary-button" disabled={i === document.steps.length - 1} aria-label={`Move step ${i + 1} down`} onClick={() => change({ steps: moveItem(document.steps, i, i + 1) })}><ArrowDown size={16} /></button><button type="button" className="text-button" aria-label={`Remove step ${i + 1}`} onClick={() => { if (window.confirm('Remove this step?')) change({ steps: document.steps.filter((_, n) => n !== i) }) }}><Trash2 size={16} /> Remove</button></div>
            <label>Step title<input maxLength={120} value={step.title} onChange={e => stepChange(i, { title: e.target.value })} /></label><label>Instructions<textarea rows={4} maxLength={2000} value={step.summary} onChange={e => stepChange(i, { summary: e.target.value })} /></label>
            <label>Starting link (optional)<input type="url" value={step.workspaceLink?.url ?? ''} onChange={e => stepChange(i, { workspaceLink: e.target.value ? { title: step.workspaceLink?.title || 'Starting point', url: e.target.value } : null })} /></label>{step.workspaceLink && <label>Starting link name<input maxLength={90} value={step.workspaceLink.title} onChange={e => stepChange(i, { workspaceLink: { ...step.workspaceLink!, title: e.target.value } })} /></label>}
            <h4>Resources · {step.resources.length}/8</h4><small>Optional references for this step. They appear in this order; use the arrows to rearrange them.</small>{step.resources.map((resource, n) => <div className="studio-resource" key={n}><label>Resource name<input maxLength={90} value={resource.title} onChange={e => stepChange(i, { resources: step.resources.map((r, x) => x === n ? { ...r, title: e.target.value } : r) })} /></label><label>Secure link<input type="url" value={resource.url} onChange={e => stepChange(i, { resources: step.resources.map((r, x) => x === n ? { ...r, url: e.target.value } : r) })} /></label><div className="studio-reorder"><button className="secondary-button" disabled={n === 0} aria-label={`Move resource ${n + 1} up`} onClick={() => stepChange(i, { resources: moveItem(step.resources, n, n - 1) })}><ArrowUp size={16} /></button><button className="secondary-button" disabled={n === step.resources.length - 1} aria-label={`Move resource ${n + 1} down`} onClick={() => stepChange(i, { resources: moveItem(step.resources, n, n + 1) })}><ArrowDown size={16} /></button><button className="text-button" onClick={() => stepChange(i, { resources: step.resources.filter((_, x) => x !== n) })}>Remove resource</button></div></div>)}<button className="text-button" disabled={step.resources.length >= 8} onClick={() => stepChange(i, { resources: [...step.resources, { title: '', url: '' }] })}><Plus size={16} /> Add resource</button>
            <label>Practice challenge<small>Required for submission. Give the learner one concrete action to complete.</small><textarea rows={3} maxLength={500} value={step.challenge ?? ''} onChange={e => stepChange(i, { challenge: e.target.value })} /></label><label>Visible completion criteria<small>Required for submission. One per line, up to eight. Say what a fresh screen should show—not what the learner should claim.</small><textarea rows={3} value={step.rubric.join('\n')} onChange={e => stepChange(i, { rubric: lines(e.target.value) })} /></label><label>Hints (optional)<textarea rows={2} value={step.hints.join('\n')} onChange={e => stepChange(i, { hints: lines(e.target.value) })} /></label>
          </details>)}
        </fieldset>}
      {submissionNotice && <p className={`studio-submission-notice studio-submission-notice--${submissionNotice.kind}`} role={submissionNotice.kind === 'error' ? 'alert' : 'status'}>{submissionNotice.text}</p>}
      {selected.status === 'draft' && <><p className="studio-action-help">Save keeps the Path private. Preview shows the learner view. Submit sends the latest saved revision for review and temporarily locks editing.</p><div className="studio-editor-actions"><button type="button" className="secondary-button" disabled={busy || !ready || !dirty} onClick={() => { void run(async current => { if (await save(current)) { await load(current); if (current()) { setMessage('Draft saved.'); setSubmissionNotice(null) } } }) }}>Save draft</button><button type="button" className="primary-button" disabled={busy || !ready} onClick={() => { void submit() }}>Submit for review</button>{canDeleteCreatorDraft(selected.status) && <button type="button" className="studio-delete-button" disabled={busy || !ready} onClick={() => { void removeDraft() }}><Trash2 size={16} /> Delete draft</button>}</div></>}
      {selected.status === 'review' && <p>In review. This snapshot is locked and stays private until approved.</p>}
      {selected.status === 'rejected' && <div className="studio-editor-actions"><button type="button" className="secondary-button" disabled={busy || !ready} onClick={() => { void run(async current => { const result = await coreRequest<CreatorDraft>(`/v1/studio/drafts/${selected.id}/revise`, { method: 'POST', headers: headers(), body: JSON.stringify({ revision: selected.revision }) }); if (current()) { select(result); await load(current) } }) }}>Revise this Path</button>{canDeleteCreatorDraft(selected.status) && <button type="button" className="studio-delete-button" disabled={busy || !ready} onClick={() => { void removeDraft() }}><Trash2 size={16} /> Delete draft</button>}</div>}
    </section>}
  </main>
}
