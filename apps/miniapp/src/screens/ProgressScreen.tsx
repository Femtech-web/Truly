import type { useDevices } from '../hooks/useDevices'
import { groupProgress } from '../core/progress'

export function ProgressScreen({ devices, connected, onConnect }: {
  devices: ReturnType<typeof useDevices>; connected: boolean; onConnect: () => void
}) {
  const sessions = groupProgress(devices.learningSessions)
  return <main className="screen page-enter">
    <section className="screen-intro screen-intro--compact"><h1>Your progress</h1><p>Your saved steps, ready whenever you return.</p></section>
    {!connected ? <section className="quiet-card"><h2>Keep progress with your wallet</h2><p>Connect to see your private Tasks.</p><button className="secondary-button" type="button" onClick={onConnect}>Connect wallet</button></section>
      : !devices.ready ? <section className="quiet-card"><h2>Bring in your progress</h2><p>Approve access to your Tasks. This does not move funds.</p><button className="secondary-button" type="button" disabled={devices.busy} onClick={() => { void devices.prepareLearning() }}>{devices.busy ? 'Waiting for approval…' : 'Load my progress'}</button></section>
        : sessions.length === 0 ? <section className="quiet-card"><h2>No practice saved yet</h2><p>Start a Task, then use Check my work on your Mac when you’re ready.</p></section>
          : <section className="progress-list" aria-label="Saved progress">{sessions.map(session => {
            const completed = session.progress?.completedCount ?? 0
            const total = session.source.stepCount
            return <article className="quiet-card progress-entry" key={session.source.taskId ?? session.id}>
              <div><h2>{session.source.title}</h2><span>{session.status === 'completed' ? 'Complete' : 'In progress'}</span></div>
              <p>{completed} of {total} steps complete</p>
              <progress max={total} value={completed} aria-label={`${session.source.title}: ${completed} of ${total} steps complete`} />
              <small>{session.status === 'completed' ? 'All practice steps saved.' : `Next: ${session.currentStep.title}`}</small>
              <small>AI-checked · Not a certification</small>
            </article>
          })}</section>}
    {devices.ready && <button className="text-button" type="button" disabled={devices.busy} onClick={() => { void devices.refresh() }}>Refresh progress</button>}
    {(devices.learningMessage || devices.message) && <p className="learning-status" role="status">{devices.learningMessage || devices.message}</p>}
  </main>
}
