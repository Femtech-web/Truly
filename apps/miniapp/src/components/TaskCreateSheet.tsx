import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, Link2, Plus, X } from 'lucide-react'
import type { LearningTask } from '../types'

interface DraftResource { key: number; title: string; url: string }

interface Props {
  busy: boolean
  requestMessage?: string
  open: boolean
  onClose: () => void
  onCreate: (input: {
    goal: string
    workspaceUrl?: string
    resources?: Array<{ title: string; url: string }>
  }) => Promise<LearningTask | null>
  onCreated: (task: LearningTask) => void
}

function validLink(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(value.trim())
    if (url.username || url.password) return false
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  } catch { return false }
}

export function TaskCreateSheet({ busy, requestMessage, open, onClose, onCreate, onCreated }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const [goal, setGoal] = useState('')
  const [workspaceUrl, setWorkspaceUrl] = useState('')
  const [showLinks, setShowLinks] = useState(false)
  const [resources, setResources] = useState<DraftResource[]>([])
  const [nextKey, setNextKey] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector('textarea')?.focus()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', trapFocus)
    return () => { window.removeEventListener('keydown', trapFocus); previousFocus?.focus() }
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [busy, onClose, open])

  if (!open) return null

  async function submit() {
    setError('')
    if (goal.trim().length < 4) { setError('Describe what you want to learn or complete.'); return }
    if (!validLink(workspaceUrl)) { setError('Use a secure web link, or a local link from your Mac.'); return }
    const completeResources = resources.filter((item) => item.title.trim() || item.url.trim())
    if (completeResources.some((item) => !item.title.trim() || !validLink(item.url) || !item.url.trim())) {
      setError('Each resource needs a name and a valid link.'); return
    }
    const task = await onCreate({
      goal: goal.trim(),
      workspaceUrl: workspaceUrl.trim() || undefined,
      resources: completeResources.map(({ title, url }) => ({ title: title.trim(), url: url.trim() })),
    })
    if (!task) return
    setGoal('')
    setWorkspaceUrl('')
    setResources([])
    setShowLinks(false)
    onCreated(task)
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <section ref={dialogRef} className="task-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="task-sheet__header">
          <div><h2 id={titleId}>Create a Task</h2><p>Turn one goal into a private plan for your Mac.</p></div>
          <button className="icon-button" type="button" aria-label="Close" disabled={busy} onClick={onClose}><X size={17} /></button>
        </header>

        <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <label className="field-label" htmlFor="task-goal">What do you want to learn or complete?</label>
          <textarea id="task-goal" rows={3} maxLength={240} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="For example, understand Zama privacy" />

          <button className="sheet-disclosure" type="button" onClick={() => setShowLinks((value) => !value)}>
            <Link2 size={16} /><span><strong>Add a starting link or resources</strong><small>Optional. Truly never opens them without asking.</small></span><span>{showLinks ? 'Hide' : 'Add'}</span>
          </button>

          {showLinks && <div className="task-links-form">
            <label className="field-label" htmlFor="workspace-url">Starting link</label>
            <input id="workspace-url" inputMode="url" type="url" value={workspaceUrl} onChange={(event) => setWorkspaceUrl(event.target.value)} placeholder="https://docs.example.com" />
            <small>This is the first destination Truly can prepare on your Mac.</small>

            {resources.map((resource, index) => <div className="resource-fields" key={resource.key}>
              <div className="resource-fields__heading"><strong>Resource {index + 1}</strong><button type="button" onClick={() => setResources((items) => items.filter((item) => item.key !== resource.key))}>Remove</button></div>
              <input aria-label={`Resource ${index + 1} name`} value={resource.title} maxLength={90} onChange={(event) => setResources((items) => items.map((item) => item.key === resource.key ? { ...item, title: event.target.value } : item))} placeholder="Resource name" />
              <input aria-label={`Resource ${index + 1} link`} inputMode="url" type="url" value={resource.url} onChange={(event) => setResources((items) => items.map((item) => item.key === resource.key ? { ...item, url: event.target.value } : item))} placeholder="https://…" />
            </div>)}

            {resources.length < 8 && <button className="add-resource-button" type="button" onClick={() => { setResources((items) => [...items, { key: nextKey, title: '', url: '' }]); setNextKey((value) => value + 1) }}><Plus size={15} /> Add resource</button>}
          </div>}

          {(error || requestMessage) && <p className="form-error" role="alert">{error || requestMessage}</p>}
          <button className="primary-button" type="submit" disabled={busy || goal.trim().length < 4}>{busy ? 'Preparing your Task…' : 'Create Task'} <ArrowRight size={16} /></button>
          <p className="task-sheet__privacy">Private to your wallet. You review the plan before sending it to a Mac.</p>
        </form>
      </section>
    </div>
  )
}
