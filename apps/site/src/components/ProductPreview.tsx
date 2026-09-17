import { useState } from 'react'
import { modeContent, type LearningMode } from '../content/siteContent'
import { BrandMark } from './BrandMark'
import { Reveal } from './Reveal'

export function ProductPreview() {
  const [mode, setMode] = useState<LearningMode>('explain')
  const activeMode = modeContent[mode]

  return (
    <Reveal
      as="section"
      id="product"
      className="product-showcase shell"
      aria-label="Interactive Truly product preview"
    >
      <div className="showcase-canvas">
        <div className="product-window">
          <div className="window-bar">
            <div className="window-controls" aria-hidden="true"><i /><i /><i /></div>
            <span className="window-title">React Effects · Visual Studio Code</span>
            <span className="share-state"><i aria-hidden="true" /> Screen shared</span>
          </div>

          <div className="workspace">
            <div className="editor">
              <div className="editor-header"><span>ProfileCard.tsx</span><span>×</span></div>
              <div className="code" aria-label="Example React code">
                <div><b>1</b><code><em>export function</em> ProfileCard() {'{'}</code></div>
                <div className={activeMode.activeLine === 2 ? 'code-line--active' : ''}>
                  <b>2</b><code>  <em>useEffect</em>(() =&gt; {'{'}</code>
                </div>
                <div><b>3</b><code>    fetchUsers()</code></div>
                <div className={activeMode.activeLine === 4 ? 'code-line--active' : ''}>
                  <b>4</b><code>  {'}'}, [])</code>
                </div>
                <div><b>5</b><code>&nbsp;</code></div>
                <div><b>6</b><code>  <em>return</em> &lt;UserList /&gt;</code></div>
                <div><b>7</b><code>{'}'}</code></div>
              </div>
              <div className={`screen-pointer screen-pointer--${mode}`} aria-hidden="true">
                <span className="cursor-shape" />
                <span className="companion-dot"><i /></span>
              </div>
            </div>

            <aside className="assistant-panel" aria-label={`${activeMode.label} mode response`}>
              <div className="assistant-heading">
                <div className="assistant-identity"><BrandMark /><span>Truly</span></div>
                <span className="assistant-context">{activeMode.context}</span>
              </div>

              <div className="mode-switch" aria-label="Choose learning mode">
                {(Object.keys(modeContent) as LearningMode[]).map((modeName) => (
                  <button
                    key={modeName}
                    className={mode === modeName ? 'mode-button mode-button--active' : 'mode-button'}
                    type="button"
                    aria-pressed={mode === modeName}
                    onClick={() => setMode(modeName)}
                  >
                    {modeContent[modeName].label}
                  </button>
                ))}
              </div>

              <div className="learner-question"><span>You</span><p>Why does this only run once?</p></div>

              <div key={mode} className="assistant-answer mode-content-swap" aria-live="polite">
                <p>{activeMode.response}</p>
                <button type="button">{activeMode.action} <span aria-hidden="true">→</span></button>
              </div>

              <div className="assistant-footer">
                <span><i aria-hidden="true" /> Looking at line {activeMode.activeLine}</span>
                <span>1 of 3</span>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <p className="preview-caption">Interactive preview of the native macOS learning loop</p>
    </Reveal>
  )
}
