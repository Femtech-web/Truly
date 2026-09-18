import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Circle, ExternalLink, Laptop, Link2 } from 'lucide-react'
import type { useDevices } from '../hooks/useDevices'
import type { LearningTask } from '../types'
import { TaskPlanEditor } from '../components/TaskPlanEditor'
import { handoffActionCopy } from '../core/handoff-presentation'

function domain(url: string): string {
  try { return new URL(url).hostname } catch { return 'external site' }
}

interface Props {
  task: LearningTask
  devices: ReturnType<typeof useDevices>
  onBack: () => void
  onShowDevices: () => void
}

export function TaskDetailScreen({ task, devices, onBack, onShowDevices }: Props) {
  task = devices.tasks.find(item => item.id === task.id) ?? task
  const [choosingMac, setChoosingMac] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deliveredDeviceName, setDeliveredDeviceName] = useState<string | null>(null)
  const saved = devices.learningSessions.find(session => session.source.taskId === task.id)
  const active = devices.activeLearning?.source.taskId === task.id
    ? devices.activeLearning : null

  useEffect(() => { setChoosingMac(false); setDeliveredDeviceName(null) }, [task.id])

  async function beginMacChoice() {
    const available = await devices.prepareLearning()
    if (available.some((device) => device.status === 'active')) setChoosingMac(true)
  }

  async function activate(deviceId: string) {
    const session = await devices.activateTask(task, deviceId)
    if (session) {
      setChoosingMac(false)
      setDeliveredDeviceName(session.device.name)
    }
  }

  return (
    <main className="screen detail-screen page-enter">
      <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={18} /> Back to My Tasks</button>

      <section className="task-detail-hero">
        <span>{task.source.kind === 'path' ? `From a Path${task.source.creatorName ? ` by ${task.source.creatorName}` : ''}` : 'Private Task'}</span>
        <h1>{task.title}</h1>
        <p>{task.outcome}</p>
        <small>{task.steps.length} {task.steps.length === 1 ? 'step' : 'steps'} · Only visible to your wallet</small>
        {task.status === 'draft' && task.source.kind === 'direct' && <small>AI-suggested plan · Review before starting</small>}
      </section>

      {(task.workspaceLink || task.resources.length > 0) && <section className="task-link-summary">
        <h2>Links for this Task</h2>
        {task.workspaceLink && <div><span><ExternalLink size={16} /></span><span><strong>Starting point</strong><small>{domain(task.workspaceLink.url)}</small></span></div>}
        {task.resources.map((resource) => <div key={resource.url}><span><Link2 size={16} /></span><span><strong>{resource.title}</strong><small>{domain(resource.url)}</small></span></div>)}
        <p>After handoff, your Mac will ask before opening the starting link.</p>
      </section>}

      <section className="lesson-section">
        <div className="section-heading"><h2>Your plan</h2>{task.status === 'draft' && task.source.kind === 'direct' && !editing ? <button className="text-button" type="button" disabled={devices.busy} onClick={() => { devices.clearLearningMessage(); setEditing(true) }}>Edit plan</button> : <span>{task.steps.length} {task.steps.length === 1 ? 'step' : 'steps'}</span>}</div>
        {editing ? <TaskPlanEditor task={task} busy={devices.busy} onCancel={() => setEditing(false)} onSave={async plan => {
          const updated = await devices.updateTaskPlan(task, plan)
          if (updated) setEditing(false)
          return Boolean(updated)
        }} /> : <ol className="lesson-list">{task.steps.map((step, index) => {
          const complete = saved?.progress?.completedStepIds.includes(step.id) ?? false
          const current = active?.currentStep.id === step.id
          return <li className={`lesson ${current ? 'lesson--current' : ''}`} key={step.id}><span className="lesson__marker">{complete ? <Check size={14} /> : <Circle size={8} fill="currentColor" />}</span><span><small>Step {index + 1}{complete ? ' · Complete' : ''}</small><strong>{step.title}</strong><p>{step.summary}</p></span></li>
        })}</ol>}
      </section>

      {!editing && (active && !choosingMac ? <section className="activation-success" role="status"><span><Check size={17} /></span><div><h2>Ready on {active.device.name}</h2><p>Step {active.currentStep.index} of {active.currentStep.total}: {active.currentStep.title}</p><small>{task.workspaceLink ? `Your Mac will offer to open ${domain(task.workspaceLink.url)}. ` : ''}If the companion is hidden, show it from the menu bar when you are ready.</small></div><div className="activation-success__actions">{deliveredDeviceName ? <div className="handoff-delivered"><Check size={16} /> {handoffActionCopy({ busy: false, deliveredDeviceName })}</div> : <button className="primary-button" type="button" disabled={devices.busy} onClick={() => { void activate(active.device.id) }}>{handoffActionCopy({ busy: devices.busy, deliveredDeviceName: null })} <ArrowRight size={16} /></button>}<button className="secondary-button" type="button" onClick={beginMacChoice}>Use another Mac</button></div></section>
        : choosingMac ? <section className="device-picker"><h2>Choose a paired Mac</h2><p>Only that Mac receives this Task. It will ask before opening any link.</p><div className="device-picker__list">{devices.devices.filter((device) => device.status === 'active').map((device) => <button type="button" className="device-choice" disabled={devices.busy} key={device.id} onClick={() => { void activate(device.id) }}><span><Laptop size={18} /></span><span><strong>{device.name}</strong><small>{device.platform} · Paired</small></span><ArrowRight size={17} /></button>)}</div><button className="text-button" type="button" onClick={() => setChoosingMac(false)}>Cancel</button></section>
          : task.status === 'completed' ? <section className="quiet-card"><h2>Task complete</h2><p>Your AI-checked steps are saved in Progress.</p></section>
            : <button className="primary-button sticky-action" type="button" disabled={devices.busy} onClick={() => { void beginMacChoice() }}>{devices.busy ? 'Waiting for approval…' : 'Start on my Mac'} <ArrowRight size={17} /></button>)}

      {devices.learningMessage && <p className="learning-status" role="status">{devices.learningMessage}</p>}
      {devices.ready && devices.devices.every((device) => device.status !== 'active') && <div className="quiet-card"><h2>No active Mac yet</h2><p>Pair a Mac before starting this Task.</p><button className="secondary-button" type="button" onClick={onShowDevices}>Open Devices</button></div>}
    </main>
  )
}
