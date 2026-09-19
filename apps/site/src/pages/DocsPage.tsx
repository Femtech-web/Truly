import { useEffect, type ReactNode } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

type GuideStep = {
  place: 'Phone' | 'Mac'
  title: string
  detail: ReactNode
}

function Procedure({ label, steps }: { label: string; steps: GuideStep[] }) {
  return <ol className="docs-procedure" aria-label={label}>
    {steps.map((step, index) => <li key={`${step.place}-${step.title}`}>
      <span className="docs-step-number" aria-hidden="true">{index + 1}</span>
      <div>
        <span className={`docs-place docs-place--${step.place.toLowerCase()}`}>{step.place}</span>
        <h3>{step.title}</h3>
        <p>{step.detail}</p>
      </div>
    </li>)}
  </ol>
}

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
        <span className="docs-kicker">Truly product guide</span>
        <h1>From first connection to finished work.</h1>
        <p>Follow the exact taps on your phone and clicks on your Mac. Truly keeps the learning plan on your phone and brings the help beside the work on your Mac.</p>
        <div className="docs-notice">
          <strong>Nimiq Mainnet</strong>
          <span>Paid Paths use real NIM. Review the amount and creator recipient before approval.</span>
        </div>
      </header>

      <div className="docs-layout shell">
        <aside className="docs-toc" aria-label="On this page">
          <span>In this guide</span>
          <a href="#setup">Set up Truly</a>
          <a href="#choose">Choose your work</a>
          <a href="#handoff">Send it to your Mac</a>
          <a href="#companion">Use the companion</a>
          <a href="#progress">Check your work</a>
          <a href="#payments">Unlock a Path</a>
          <a href="#creators">Create a Path</a>
          <a href="#privacy">Privacy</a>
          <a href="#help">Fix a problem</a>
        </aside>

        <div className="docs-content">
          <section id="setup" className="docs-section">
            <h2>Set up Truly once</h2>
            <p className="docs-lead">Connect through Nimiq Pay first, then pair the Mac where you will do the work. Pairing is a wallet approval, not a payment.</p>

            <div className="docs-subsection">
              <span className="docs-eyebrow">Connect your wallet</span>
              <Procedure label="Connect Truly through Nimiq Pay" steps={[
                { place: 'Phone', title: 'Open Truly in Nimiq Pay', detail: <>Open <strong>Nimiq Pay</strong>, go to <strong>Mini Apps</strong>, then open <strong>Truly</strong>.</> },
                { place: 'Phone', title: 'Open the connection sheet', detail: <>Tap <strong>Connect</strong> in the top-right, then tap <strong>Connect through Nimiq Pay</strong>.</> },
                { place: 'Phone', title: 'Approve the account', detail: <>Approve the primary signing account shown by Nimiq Pay. Truly receives its public address; it never asks for recovery words or private keys.</> },
              ]} />
            </div>

            <div className="docs-subsection">
              <span className="docs-eyebrow">Pair your Mac</span>
              <Procedure label="Pair the Truly Mac app with the Mini App" steps={[
                { place: 'Mac', title: 'Open the Truly menu', detail: <>Launch Truly, then click the <strong>Truly ring-and-dot icon</strong> in the macOS menu bar.</> },
                { place: 'Mac', title: 'Create a pairing code', detail: <>Click <strong>Settings…</strong>, open <strong>Connection</strong>, then click <strong>Pair this Mac</strong>. Leave the six-character code visible; it expires after five minutes.</> },
                { place: 'Phone', title: 'Enter the same code', detail: <>In Truly, tap <strong>Devices</strong> in the bottom navigation. Type the six-character code exactly as shown on the Mac, then tap <strong>Verify code</strong>.</> },
                { place: 'Phone', title: 'Confirm the Mac', detail: <>Check the Mac name and system in the preview, then tap <strong>Approve and pair Mac</strong>.</> },
                { place: 'Phone', title: 'Approve in Nimiq Pay', detail: <>Approve the pairing signature. It cannot move funds. Return to Truly and confirm the Mac appears under <strong>Connected Macs</strong>.</> },
              ]} />
            </div>
          </section>

          <section id="choose" className="docs-section">
            <h2>Choose your work</h2>
            <p className="docs-lead">Start from your own goal or use a reviewed route made by a creator.</p>
            <div className="docs-compare">
              <article><span>Private Task</span><h3>Start with your own goal</h3><p>Truly suggests a private plan that you can inspect and edit before it reaches your Mac.</p><small>Private · editable · no purchase</small></article>
              <article><span>Creator Path</span><h3>Follow someone’s route</h3><p>Use ordered instructions, resources, practice challenges and visible completion criteria.</p><small>Free or paid · reviewed · versioned</small></article>
            </div>

            <div className="docs-subsection">
              <span className="docs-eyebrow">Start a private Task</span>
              <Procedure label="Create a private Task" steps={[
                { place: 'Phone', title: 'Open My Tasks', detail: <>Tap <strong>Learn</strong>, select <strong>My Tasks</strong>, then tap <strong>New Task</strong>.</> },
                { place: 'Phone', title: 'Describe one clear goal', detail: <>Write what you want to learn or complete. Add any useful context, then ask Truly to create the plan.</> },
                { place: 'Phone', title: 'Review the plan', detail: <>Open the Task, read every step, and use <strong>Edit plan</strong> if anything should change.</> },
                { place: 'Phone', title: 'Start on your Mac', detail: <>Tap <strong>Start on my Mac</strong>, then choose the paired Mac that should receive the Task.</> },
              ]} />
            </div>

            <div className="docs-subsection">
              <span className="docs-eyebrow">Start a creator Path</span>
              <Procedure label="Start a creator Path" steps={[
                { place: 'Phone', title: 'Explore the Paths', detail: <>Tap <strong>Learn</strong>, select <strong>Explore Paths</strong>, then open a Path.</> },
                { place: 'Phone', title: 'Read before starting', detail: <>Review the outcome, requirements, steps, creator and access. Complete the NIM checkout first if the Path is paid.</> },
                { place: 'Phone', title: 'Choose your Mac', detail: <>Tap <strong>Start or continue on my Mac</strong>, then select a paired Mac.</> },
              ]} />
            </div>
          </section>

          <section id="handoff" className="docs-section">
            <h2>Send it to your Mac</h2>
            <Procedure label="Hand a Task or Path to the Mac" steps={[
              { place: 'Phone', title: 'Choose the destination', detail: <>Select the paired Mac from <strong>Choose a paired Mac</strong>. Only that Mac receives this learning session.</> },
              { place: 'Phone', title: 'Confirm the handoff', detail: <>Wait for <strong>Loaded in Truly on [Mac name]</strong>. Do not tap again after that confirmation.</> },
              { place: 'Mac', title: 'Open the Task', detail: <>If the companion is visible, it updates to the new step. If it is hidden, use the compact Task-ready notice or click the Truly menu icon and choose <strong>Open Task</strong>.</> },
              { place: 'Mac', title: 'Open the starting point', detail: <>If the step includes a link, Truly shows it under <strong>Starting point</strong>. Click it only when you want that page or app to open.</> },
            ]} />
          </section>

          <section id="companion" className="docs-section">
            <h2>Use the companion beside the work</h2>
            <p className="docs-lead">Truly does not take over your Mac. You position it, choose the input mode and decide when to share the screen.</p>

            <div className="docs-subsection">
              <span className="docs-eyebrow">Ask with text</span>
              <Procedure label="Ask Truly with text" steps={[
                { place: 'Mac', title: 'Show the companion', detail: <>Click the Truly menu icon, set <strong>Input</strong> to <strong>Text</strong>, then choose <strong>Show companion</strong> if it is hidden.</> },
                { place: 'Mac', title: 'Place it near the subject', detail: <>Drag the companion near the code, page, design or control you mean. This helps Truly understand what your question refers to.</> },
                { place: 'Mac', title: 'Open the question box', detail: <>Click the companion itself, or open the Truly menu and click <strong>Ask Truly</strong>.</> },
                { place: 'Mac', title: 'Type and send', detail: <>Type the question in <strong>Ask about what you shared…</strong>, then press Return or click <strong>Ask</strong>. Truly captures one fresh screen and writes its answer in the companion.</> },
                { place: 'Mac', title: 'Stop sharing', detail: <>Close the answer or leave the companion idle. Text mode does not listen to the microphone and Truly does not keep watching the screen.</> },
              ]} />
            </div>

            <div className="docs-subsection">
              <span className="docs-eyebrow">Ask with voice</span>
              <Procedure label="Ask Truly with voice" steps={[
                { place: 'Mac', title: 'Choose Voice input', detail: <>Click the Truly menu icon and set <strong>Input</strong> to <strong>Voice</strong>. Allow Microphone and Speech Recognition if macOS asks.</> },
                { place: 'Mac', title: 'Choose how Truly replies', detail: <>Set <strong>Reply</strong> to <strong>Text</strong> for an on-screen answer or <strong>Spoken</strong> to hear the answer aloud.</> },
                { place: 'Mac', title: 'Start wake listening', detail: <>Click <strong>Resume</strong>. Truly now listens locally for the wake phrase; it has not sent a recording to the cloud.</> },
                { place: 'Mac', title: 'Ask the question', detail: <>Say <strong>“Hey Truly” once</strong>, then ask the full question—do not repeat the wake phrase. You can say both as one natural sentence. The small indicator changes when the wake phrase is recognized; Truly finishes processing the words it already heard before starting another local question segment if needed.</> },
                { place: 'Mac', title: 'Review and send', detail: <>Stop speaking after the question. Truly captures one fresh screen and opens the recognized words in the question box. Correct anything it misheard, then click <strong>Ask</strong>. Nothing is sent merely because the recognizer was confident.</> },
                { place: 'Mac', title: 'Pause listening', detail: <>Click <strong>Pause</strong> whenever you do not want wake listening. Hiding the companion also stops listening.</> },
                { place: 'Mac', title: 'Record without the wake phrase', detail: <>For one deliberate recording, click <strong>Record a question</strong>, speak, then finish. This sends only that requested question and does not enable ongoing wake listening.</> },
              ]} />
            </div>
            <p className="docs-callout"><strong>Questions do not complete steps.</strong> Asking for help teaches. <strong>Check my work</strong> is the separate action that assesses a practice result.</p>
          </section>

          <section id="progress" className="docs-section">
            <h2>Check your work and save progress</h2>
            <Procedure label="Complete an AI-checked practice step" steps={[
              { place: 'Mac', title: 'Finish the practice in your own tool', detail: <>Keep your result visible in the browser, editor or app where you made it. Show the result—not only the instructions or a tutorial.</> },
              { place: 'Mac', title: 'Open the current step', detail: <>Click the Truly menu icon, then click <strong>Open Task</strong>. Read the <strong>Practice goal</strong> and every visible completion criterion.</> },
              { place: 'Mac', title: 'Request the assessment', detail: <>Arrange the screen so the evidence is readable, then click <strong>Check my work</strong>. Truly shares one fresh screen for this check.</> },
              { place: 'Mac', title: 'Read the result', detail: <>If a criterion is missing, correct the work and check again. If it passes, the next step becomes current.</> },
              { place: 'Phone', title: 'Confirm the saved progress', detail: <>Open <strong>Progress</strong> or return to the Task. Refresh if needed and confirm the completed-step count has increased.</> },
            ]} />
            <p className="docs-callout"><strong>AI-checked is not certification.</strong> It is product feedback based on the visible criteria and can be wrong.</p>
          </section>

          <section id="payments" className="docs-section">
            <h2>Unlock a paid Path</h2>
            <p className="docs-lead">Paid Paths use real NIM on Nimiq Mainnet. The creator’s verified signing address is the payment recipient.</p>
            <Procedure label="Purchase a paid Path with NIM" steps={[
              { place: 'Phone', title: 'Open the paid Path', detail: <>In <strong>Learn → Explore Paths</strong>, open the Path and scroll to <strong>Unlock this Path</strong>.</> },
              { place: 'Phone', title: 'Approve purchase access', detail: <>Tap <strong>Approve purchase access</strong> and approve the short sign-in. This step does not send NIM.</> },
              { place: 'Phone', title: 'Review the purchase', detail: <>Tap <strong>Review purchase</strong>. Check the Path version, seller, exact NIM amount, Mainnet network and recipient.</> },
              { place: 'Phone', title: 'Approve the real payment', detail: <>Tick the Mainnet confirmation, tap <strong>Pay [amount] NIM</strong>, then approve the same amount and recipient in Nimiq Pay.</> },
              { place: 'Phone', title: 'Wait for the unlock', detail: <>Return to Truly and tap <strong>Check payment</strong> if the transfer is still pending. Do not pay twice. Continue when Truly shows <strong>Path unlocked</strong>.</> },
            ]} />
            <p className="docs-callout"><strong>Nimiq Pay remains the wallet record.</strong> It holds the keys, complete balance and full transaction history. Truly records only the payments and access it independently validates.</p>
          </section>

          <section id="creators" className="docs-section">
            <h2>Create and publish a Path</h2>
            <p className="docs-lead">Anyone can deliberately approve Creator Studio and prepare a private draft. Publishing still requires review.</p>
            <Procedure label="Create and submit a creator Path" steps={[
              { place: 'Phone', title: 'Open Creator Studio', detail: <>Tap <strong>Learn → Explore Paths → Create Path</strong>. Tap <strong>Approve Creator Studio</strong>, then approve the sign-in in Nimiq Pay. It is not a payment.</> },
              { place: 'Phone', title: 'Complete your public profile', detail: <>Add a creator name and bio, then tap <strong>Save profile</strong>. Paid Path proceeds go to the verified wallet shown on the profile.</> },
              { place: 'Phone', title: 'Create the draft', detail: <>Tap <strong>New Path</strong>. Add the title, public Path link, summary, description, subject, language, duration, outcomes and tools or environments.</> },
              { place: 'Phone', title: 'Add the learning steps', detail: <>Tap <strong>Add step</strong>. For every step, add instructions, a concrete practice challenge and visible completion criteria. Add resources if useful and use the arrow buttons to reorder steps or resources.</> },
              { place: 'Phone', title: 'Choose access', detail: <>Select <strong>Free</strong> or <strong>Paid with NIM</strong>. For a paid Path, enter the NIM price and verify the receiving address shown by Truly.</> },
              { place: 'Phone', title: 'Save and test the learner view', detail: <>Tap <strong>Save draft</strong>, then <strong>Preview</strong>. Follow every instruction yourself and return with <strong>Back to editor</strong> if something is unclear.</> },
              { place: 'Phone', title: 'Submit the saved version', detail: <>Tap <strong>Submit for review</strong>. Fix any missing fields shown beside the button. A successful submission locks that exact revision and marks it <strong>In review</strong>.</> },
            ]} />
            <p className="docs-callout"><strong>Publishing is version-safe.</strong> Drafts stay private and can be deleted. A submitted revision stays locked during review; later approved updates do not change the plans of existing learners.</p>
          </section>

          <section id="privacy" className="docs-section">
            <h2>What Truly can see</h2>
            <dl className="docs-definition-list">
              <div><dt>Your screen</dt><dd>One fresh capture when you deliberately ask a screen-aware question, finish an enabled voice question or choose <strong>Check my work</strong>. Truly does not watch continuously or keep a hidden screenshot history.</dd></div>
              <div><dt>Your wallet</dt><dd>The public signing account Nimiq Pay shares and the approvals you confirm. Truly never asks for private keys or recovery words.</dd></div>
              <div><dt>Your voice</dt><dd>Wake listening runs locally when Voice mode is resumed. A completed question is sent for transcription; spoken-answer playback pauses listening to avoid self-triggering.</dd></div>
              <div><dt>Your progress</dt><dd>Completed steps, the Path version and the Task attached to your wallet. AI-checked progress is feedback, not a certificate.</dd></div>
            </dl>
          </section>

          <section id="help" className="docs-section docs-help">
            <h2>Fix a problem</h2>
            <details><summary>The pairing code was not found</summary><p>Create a fresh code from <strong>Mac menu icon → Settings… → Connection → Pair this Mac</strong>, then enter it within five minutes. If the Mac says <strong>Local development Core</strong>, that code works only with a local Mini App using the same Core; the public Mini App needs the production Mac build.</p></details>
            <details><summary>The Mac does not appear on my phone</summary><p>Open <strong>Devices</strong> and tap <strong>Approve Truly access</strong> or <strong>Refresh devices</strong>. If it still does not appear, remove the old connection and pair the Mac again with a fresh code.</p></details>
            <details><summary>My Mac did not show the Task</summary><p>Return to the Task or Path on the phone, tap <strong>Start or continue on my Mac</strong>, choose the Mac and wait for <strong>Loaded in Truly on [Mac name]</strong>. On the Mac, click the menu icon and choose <strong>Open Task</strong> or <strong>Show companion</strong>.</p></details>
            <details><summary>My wallet approval uses the wrong account</summary><p>Truly uses Nimiq Pay’s primary signing account. Open <strong>Wallet &amp; access → Reconnect wallet → Disconnect and reconnect</strong>. If Nimiq Pay still signs with the old account, change its primary signer inside Nimiq Pay before reconnecting.</p></details>
            <details><summary>A payment is pending</summary><p>Return to the Path and tap <strong>Check payment</strong>. Do not create a second payment. Nimiq Pay remains the source of truth for the transaction and complete wallet balance.</p></details>
            <details><summary>My progress did not change</summary><p>Asking Truly a question does not complete a step. On the Mac, choose <strong>Open Task → Check my work</strong>, pass every visible criterion, then open <strong>Progress</strong> on the phone and refresh.</p></details>
            <details><summary>Why can’t I change a submitted Path?</summary><p>The reviewer must see the exact revision that could become public. Wait for approval or requested changes. A rejected draft can be revised or deleted from its editor.</p></details>
            <details>
              <summary>How is the macOS app installed?</summary>
              <p>Download the .dmg from Truly’s website, open it and drag Truly into Applications. This free direct-download build is not Apple-notarized, so macOS may show <strong>“Truly” Not Opened</strong> on the first launch.</p>
              <ol>
                <li>Click <strong>Done</strong>—do not choose <strong>Move to Bin</strong>.</li>
                <li>Confirm that Truly is in <strong>Applications</strong>.</li>
                <li>Open <strong>System Settings → Privacy &amp; Security</strong> and scroll to <strong>Security</strong>.</li>
                <li>Find the notice that Truly was blocked because it is not from an identified developer, then click <strong>Open Anyway</strong>.</li>
                <li>Confirm with Touch ID or your Mac password, then click <strong>Open</strong> in the final prompt.</li>
              </ol>
              <p>You can also Control-click Truly in Applications, choose <strong>Open</strong>, then confirm <strong>Open</strong>. Approval is required only for the first launch. Never disable Gatekeeper globally.</p>
            </details>
          </section>
        </div>
      </div>
    </main>
    <Footer />
  </>
}
