import type { ActiveLearningSession } from '../types.ts'

/** Historical Mac sessions share one Task result; display the latest once. */
export function groupProgress(sessions: ActiveLearningSession[]): ActiveLearningSession[] {
  const grouped = new Map<string, ActiveLearningSession>()
  const priority = { completed: 2, active: 1, paused: 0 }
  for (const session of [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)
    || priority[b.status] - priority[a.status]
    || Number(Boolean(b.source.taskId)) - Number(Boolean(a.source.taskId)))) {
    // Path sessions created before Tasks existed and their Task-backed replacement
    // represent the same learner result. A published Path version is immutable and
    // can create only one learner-owned Task, so its id + version is the stable key.
    const key = session.source.kind === 'path' && session.source.version !== null
      ? `path:${session.source.id}:${session.source.version}`
      : session.source.taskId ?? session.id
    if (!grouped.has(key)) grouped.set(key, session)
  }
  return [...grouped.values()]
}
