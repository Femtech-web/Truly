import { Reveal } from './Reveal'

export function LearningStory() {
  return (
    <>
      <Reveal as="section" id="approach" className="session-section shell">
        <div className="session-copy">
          <h2>A tutor that stays with the work.</h2>
          <p>Most assistants hand over an answer and leave. Truly keeps the lesson attached to the task, gives you one useful next step, and waits while you try it.</p>
          <p>When you are ready, it checks the change in context—so progress means you actually did the work.</p>
        </div>
        <div className="session-board" aria-label="Example Truly learning session">
          <div className="session-board__head">
            <div><span className="session-title">React Effects</span><span className="session-status">In progress</span></div>
            <span>Guide mode</span>
          </div>
          <div className="session-progress" aria-label="Two of three steps complete"><i /><i /><i /></div>
          <div className="session-row session-row--complete">
            <span className="session-marker" aria-hidden="true">✓</span>
            <div><b>Understand the current behaviour</b><p>The empty dependency list runs the effect once.</p></div><span>Done</span>
          </div>
          <div className="session-row session-row--active">
            <span className="session-marker" aria-hidden="true" />
            <div><b>Make the effect respond to users</b><p>Add the value that should trigger the effect.</p></div><span>Working</span>
          </div>
          <div className="session-row">
            <span className="session-marker" aria-hidden="true" />
            <div><b>Check the result</b><p>Truly will look again when you are ready.</p></div><span>Next</span>
          </div>
          <button className="session-action" type="button">I made the change <span aria-hidden="true">→</span></button>
        </div>
      </Reveal>

      <Reveal as="section" className="principles-section shell" aria-labelledby="principles-title">
        <div className="principles-heading">
          <h2 id="principles-title">Present when you need it. Quiet when you don’t.</h2>
          <p>Truly is a native companion, not another destination competing for your attention.</p>
        </div>
        <div className="principles-grid">
          <article><strong>Native</strong><h3>Made for macOS</h3><p>A focused SwiftUI companion that belongs beside the software you already use.</p></article>
          <article><strong>On demand</strong><h3>No background watching</h3><p>Truly sees the screen you share for the question you asked—and nothing more.</p></article>
          <article><strong>Learner-led</strong><h3>You still do the work</h3><p>Guidance arrives one step at a time, with space to think, try, and understand.</p></article>
        </div>
      </Reveal>
    </>
  )
}
