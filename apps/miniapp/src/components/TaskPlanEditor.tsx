import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import type { LearningTask } from '../types'
import { createIdempotencyKey } from '../core/idempotency'

type Plan = Pick<LearningTask, 'title' | 'outcome' | 'steps'>
interface Props { task: LearningTask; busy: boolean; onCancel: () => void; onSave: (plan: Plan) => Promise<boolean> }

export function TaskPlanEditor({ task, busy, onCancel, onSave }: Props) {
  const id = useId()
  const [title, setTitle] = useState(task.title)
  const [outcome, setOutcome] = useState(task.outcome)
  const [steps, setSteps] = useState(() => task.steps.map(step => ({ ...step, criteria: step.rubric.join('\n') })))
  const [error, setError] = useState('')
  function change(index: number, field: 'title' | 'summary' | 'challenge' | 'criteria', value: string) {
    setSteps(items => items.map((step, position) => position === index ? { ...step, [field]: value } : step))
  }
  async function submit() {
    const plan: Plan = { title: title.trim(), outcome: outcome.trim(), steps: steps.map(({ criteria, ...step }) => ({
      ...step, title: step.title.trim(), summary: step.summary.trim(), challenge: step.challenge?.trim() || null,
      rubric: criteria.split('\n').map(line => line.trim()).filter(Boolean),
    })) }
    if (!plan.title || !plan.outcome || plan.steps.some(step => !step.title || !step.summary || !step.challenge || step.rubric.length < 1 || step.rubric.length > 8 || step.rubric.some(item => item.length > 240))) {
      setError('Give each step a name, an instruction, something to practise and 1–8 short completion checks.')
      return
    }
    setError('')
    await onSave(plan)
  }
  return <form className="plan-editor" onSubmit={event => { event.preventDefault(); void submit() }}>
    <p>Keep what fits your goal. Adjust anything that doesn’t.</p>
    <label htmlFor={`${id}-title`}>Task name</label>
    <input id={`${id}-title`} maxLength={90} required value={title} disabled={busy} onChange={event => setTitle(event.target.value)} />
    <label htmlFor={`${id}-outcome`}>What you’ll achieve</label>
    <textarea id={`${id}-outcome`} maxLength={240} required rows={2} value={outcome} disabled={busy} onChange={event => setOutcome(event.target.value)} />
    {steps.map((step, index) => <fieldset key={step.id} disabled={busy}>
      <legend>Step {index + 1}</legend>
      <label htmlFor={`${id}-${index}-name`}>Name</label>
      <input id={`${id}-${index}-name`} maxLength={90} required value={step.title} onChange={event => change(index, 'title', event.target.value)} />
      <label htmlFor={`${id}-${index}-instruction`}>What to do</label>
      <textarea id={`${id}-${index}-instruction`} maxLength={240} required rows={2} value={step.summary} onChange={event => change(index, 'summary', event.target.value)} />
      <details><summary>Practice and completion checks</summary>
        <label htmlFor={`${id}-${index}-practice`}>What you’ll practise</label>
        <textarea id={`${id}-${index}-practice`} maxLength={500} rows={2} value={step.challenge ?? ''} onChange={event => change(index, 'challenge', event.target.value)} />
        <label htmlFor={`${id}-${index}-checks`}>How Truly should check your work</label>
        <textarea id={`${id}-${index}-checks`} rows={3} maxLength={2000} value={step.criteria} onChange={event => change(index, 'criteria', event.target.value)} />
        <small>One short, visible result per line. AI checks are not certification.</small>
      </details>
      {steps.length > 1 && <button className="text-button" type="button" onClick={() => setSteps(items => items.filter((_, position) => position !== index))}>Remove step</button>}
    </fieldset>)}
    {steps.length < 8 && <button className="add-resource-button" disabled={busy} type="button" onClick={() => setSteps(items => [...items, { id: createIdempotencyKey(), title: '', summary: '', challenge: '', rubric: [], criteria: '' }])}><Plus size={15} /> Add step</button>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="plan-editor__actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save plan'}</button><button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>
}
