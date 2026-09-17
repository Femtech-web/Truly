import { ArrowUpRight, Link2 } from 'lucide-react'
import type { LearningTask } from '../types'

export function TaskCard({ task, active, onOpen }: { task: LearningTask; active: boolean; onOpen: () => void }) {
  const linkCount = task.resources.length + (task.workspaceLink ? 1 : 0)
  return (
    <button className="task-card" type="button" onClick={onOpen}>
      <span className="task-card__meta"><span>{active ? 'Active' : task.source.kind === 'path' ? 'From a Path' : 'Private Task'}</span>{linkCount > 0 && <span><Link2 size={12} /> {linkCount}</span>}</span>
      <span className="task-card__body"><span><strong>{task.title}</strong><small>{task.outcome}</small></span><ArrowUpRight size={19} /></span>
      <span className="task-card__steps">{task.steps.length} steps</span>
    </button>
  )
}
