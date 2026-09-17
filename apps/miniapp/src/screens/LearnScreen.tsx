import { useId, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { useDevices } from '../hooks/useDevices'
import type { LearnView, LearningTask, Skill } from '../types'
import { SkillCard } from '../components/SkillCard'
import { TaskCard } from '../components/TaskCard'
import { TaskCreateSheet } from '../components/TaskCreateSheet'

interface Props {
  view: LearnView
  onViewChange: (view: LearnView) => void
  skills: Skill[]
  devices: ReturnType<typeof useDevices>
  isConnected: boolean
  onConnect: () => void
  onOpenPath: (skill: Skill) => void
  onOpenTask: (task: LearningTask) => void
}

export function LearnScreen({ view, onViewChange, skills, devices, isConnected, onConnect, onOpenPath, onOpenTask }: Props) {
  const [creating, setCreating] = useState(false)
  const tabId = useId()
  const tabListRef = useRef<HTMLDivElement>(null)
  const openTaskSheet = () => { devices.clearLearningMessage(); setCreating(true) }

  return (
    <main className="screen learn-screen page-enter">
      <section className="screen-intro screen-intro--compact">
        <h1>Learn</h1>
        <p>Start something personal or follow a Path shaped by a creator.</p>
      </section>

      <div ref={tabListRef} className="learn-switcher" role="tablist" aria-label="Learn" onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const nextView = event.key === 'Home' ? 'tasks' : event.key === 'End' ? 'paths' : view === 'tasks' ? 'paths' : 'tasks'
        onViewChange(nextView)
        tabListRef.current?.querySelectorAll<HTMLButtonElement>('button')[nextView === 'tasks' ? 0 : 1]?.focus()
      }}>
        <button id={`${tabId}-tasks`} aria-controls={`${tabId}-panel`} tabIndex={view === 'tasks' ? 0 : -1} type="button" role="tab" aria-selected={view === 'tasks'} className={view === 'tasks' ? 'is-active' : ''} onClick={() => onViewChange('tasks')}>My Tasks</button>
        <button id={`${tabId}-paths`} aria-controls={`${tabId}-panel`} tabIndex={view === 'paths' ? 0 : -1} type="button" role="tab" aria-selected={view === 'paths'} className={view === 'paths' ? 'is-active' : ''} onClick={() => onViewChange('paths')}>Explore Paths</button>
      </div>

      {view === 'tasks' ? <section id={`${tabId}-panel`} aria-labelledby={`${tabId}-tasks`} className="learn-pane" role="tabpanel">
        <div className="learn-pane__heading"><div><h2>My Tasks</h2><p>Private work connected to your wallet.</p></div><button className="new-task-button" type="button" onClick={() => isConnected ? openTaskSheet() : onConnect()}><Plus size={16} /> New Task</button></div>

        {!isConnected ? <div className="empty-state"><h3>Connect to keep your Tasks</h3><p>Your wallet keeps private Tasks available across Truly.</p><button className="secondary-button" type="button" onClick={onConnect}>Connect wallet</button></div>
          : !devices.ready ? <div className="empty-state"><h3>Bring in your Tasks</h3><p>Approve read-only access to load your Tasks and paired Macs.</p><button className="secondary-button" type="button" disabled={devices.busy} onClick={() => { void devices.prepareLearning() }}>{devices.busy ? 'Waiting for approval…' : 'Load my Tasks'}</button></div>
          : devices.tasks.length > 0 ? <div className="task-list">{devices.tasks.map((task) => <TaskCard key={task.id} task={task} active={devices.activeLearning?.source.taskId === task.id} onOpen={() => onOpenTask(task)} />)}</div>
          : <div className="empty-state"><h3>Your first Task starts here</h3><p>Choose one useful goal. Truly will make a short plan you can review.</p><button className="secondary-button" type="button" onClick={openTaskSheet}>Create a Task</button></div>}

        {devices.learningMessage && <p className="learning-status" role="status">{devices.learningMessage}</p>}
      </section> : <section id={`${tabId}-panel`} aria-labelledby={`${tabId}-paths`} className="learn-pane" role="tabpanel">
        <div className="learn-pane__heading"><div><h2>Explore Paths</h2><p>Structured learning from reviewed creators.</p></div></div>
        <div className="skill-list">{skills.map((skill) => <SkillCard key={skill.id} skill={skill} onOpen={() => onOpenPath(skill)} />)}</div>
      </section>}

      <TaskCreateSheet open={creating} busy={devices.busy} requestMessage={devices.learningMessage} onClose={() => setCreating(false)} onCreate={devices.createTask} onCreated={(task) => { setCreating(false); onOpenTask(task) }} />
    </main>
  )
}
