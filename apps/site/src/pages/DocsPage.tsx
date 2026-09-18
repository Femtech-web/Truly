import { useEffect } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

const setup = [
  ['Connect your wallet', 'Create or import an account in Nimiq Pay, then choose the account Truly may use. Recovery words always stay in Nimiq Pay.'],
  ['Pair your Mac', 'Enter the short code shown by Truly on your Mac and approve that exact pairing request.'],
  ['Choose your route', 'Start a private Task from your own goal, or follow a creator-made Path.'],
  ['Continue beside the work', 'Send the Task to your Mac. Truly keeps the real browser, editor or app in view while you learn.'],
]

export function DocsPage() {
  useEffect(() => {
    document.title = 'Truly guide — learn beside the work'
    return () => { document.title = 'Truly — Learn anything by doing it' }
  }, [])

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <Header page="docs" />
    <main id="main" className="docs-page">
      <header className="docs-hero shell">
        <span className="docs-kicker">Truly guide</span>
        <h1>Learn beside the work.</h1>
        <p>Use your phone to choose what you want to learn, then continue on your Mac with a companion that can see the screen you deliberately share.</p>
        <div className="docs-notice">
          <strong>Testnet preview</strong>
          <span>The current build uses test NIM with no real-world value.</span>
        </div>
      </header>

      <div className="docs-layout shell">
        <aside className="docs-toc" aria-label="On this page">
          <span>In this guide</span>
          <a href="#start">Get started</a>
          <a href="#mac">Learn on Mac</a>
          <a href="#routes">Tasks and Paths</a>
          <a href="#payments">Payments</a>
          <a href="#creators">Creator Studio</a>
          <a href="#privacy">Privacy</a>
          <a href="#help">Help</a>
        </aside>

        <div className="docs-content">
          <section id="start" className="docs-section">
            <h2>Get started</h2>
            <p className="docs-lead">The first setup connects your wallet, phone and Mac. After that, a Task can move between them without losing its place.</p>
            <div className="docs-rows">
              {setup.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}
            </div>
          </section>

          <section id="mac" className="docs-section">
            <h2>Learn on your Mac</h2>
            <p className="docs-lead">Truly stays beside the tool you are learning. Move it near any visible part of the screen, then ask about that moment.</p>
            <dl className="docs-definition-list">
              <div><dt>Speak or type</dt><dd>Ask naturally. Truly can write its answer or speak it back.</dd></div>
              <div><dt>Point with context</dt><dd>Place the companion near the thing you mean. Ask what it is, why it matters or what to try next.</dd></div>
              <div><dt>Check your work</dt><dd>When a step has a practice goal, Truly takes a fresh look and saves progress only when the visible criteria are met.</dd></div>
            </dl>
            <p className="docs-callout"><strong>Teaching and assessment stay separate.</strong> Asking for help never completes a step. You deliberately choose Check my work when you are ready.</p>
          </section>

          <section id="routes" className="docs-section">
            <h2>Choose how you learn</h2>
            <div className="docs-compare">
              <article><span>Private Task</span><h3>Start with your own goal</h3><p>Describe what you want to understand or finish. Review the suggested steps, edit them, then keep your progress connected to your wallet.</p><small>Private · editable · no purchase</small></article>
              <article><span>Creator Path</span><h3>Follow someone’s route</h3><p>Use an ordered plan with explanations, links, challenges and clear completion criteria. Starting it creates your own copy and progress.</p><small>Free or paid · reviewed · versioned</small></article>
            </div>
          </section>

          <section id="payments" className="docs-section">
            <h2>Unlock a paid Path</h2>
            <p className="docs-lead">The price, creator and recipient appear before Nimiq Pay asks for approval. Truly grants access only after Core verifies the settled payment.</p>
            <div className="docs-sequence" aria-label="Payment flow"><span>Choose the Path</span><i aria-hidden="true">→</i><span>Review the payment</span><i aria-hidden="true">→</i><span>Approve in Nimiq Pay</span><i aria-hidden="true">→</i><span>Keep access</span></div>
            <p className="docs-callout"><strong>Your wallet stays your wallet.</strong> Nimiq Pay holds the keys and complete transaction history. Truly records only the verified payments and access created through Truly.</p>
          </section>

          <section id="creators" className="docs-section">
            <h2>Publish a Path</h2>
            <p className="docs-lead">Anyone can deliberately approve Creator Studio, create a public profile and prepare a private draft.</p>
            <div className="docs-rows docs-rows--compact">
              <article><h3>Build the route</h3><p>Add outcomes, requirements, steps, resources, practice goals and completion criteria. Reorder them before publishing.</p></article>
              <article><h3>Choose access</h3><p>Make the Path free, or set a NIM price paid to the creator’s verified wallet.</p></article>
              <article><h3>Preview and submit</h3><p>Check the learner view, then submit an exact version for review. An authorized reviewer can publish it or return notes.</p></article>
            </div>
            <p className="docs-callout"><strong>Existing learners keep their version.</strong> Drafts stay private and can be deleted. A submitted version is locked during review, and a later update becomes a new version.</p>
          </section>

          <section id="privacy" className="docs-section">
            <h2>What Truly can see</h2>
            <dl className="docs-definition-list">
              <div><dt>Your screen</dt><dd>Only a fresh capture when you ask for help or choose Check my work. Truly does not create a hidden screenshot history.</dd></div>
              <div><dt>Your wallet</dt><dd>The public account Nimiq Pay shares and approvals you confirm. Truly never asks for keys or recovery words.</dd></div>
              <div><dt>Your progress</dt><dd>Saved steps are AI-checked, not a certification. A visible result must meet the Path’s stated criteria.</dd></div>
            </dl>
          </section>

          <section id="help" className="docs-section docs-help">
            <h2>Common questions</h2>
            <details><summary>My Mac did not show the Task</summary><p>Confirm that the same Mac is paired and active. If the companion is hidden, Truly keeps it hidden and shows a compact Task-ready notice in the top-right.</p></details>
            <details><summary>Why is my Nimiq Pay balance different?</summary><p>Nimiq Pay is the source of truth for the complete portfolio, including wallet-managed funds. Truly shows its own validated Path payments and access—not a partial balance.</p></details>
            <details><summary>Can I paste a wallet address into Truly?</summary><p>No. A pasted address does not prove ownership. Create or import accounts in Nimiq Pay, then choose an account the wallet securely shares with Truly.</p></details>
            <details><summary>Why can’t I change a submitted Path?</summary><p>The submitted version stays locked so the reviewer sees exactly what could be published. If it is rejected, you can revise or delete the private draft.</p></details>
            <details><summary>How is the macOS app distributed?</summary><p>Truly is a native macOS companion. Public releases are distributed directly as a .dmg rather than through the Mac App Store.</p></details>
          </section>
        </div>
      </div>
    </main>
    <Footer />
  </>
}
