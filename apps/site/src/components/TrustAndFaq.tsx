import { frequentlyAskedQuestions } from '../content/siteContent'
import { Reveal } from './Reveal'

export function TrustAndFaq() {
  return (
    <>
      <Reveal as="section" id="privacy" className="privacy-section shell">
        <div className="privacy-intro">
          <h2>Private by design. Clear by default.</h2>
          <p>Screen-aware learning only works when trust is visible. Truly is designed around deliberate capture, short-lived processing, and explicit wallet approval.</p>
        </div>
        <div className="privacy-rows">
          <article><h3>You decide when Truly can see</h3><p>Screen and microphone access starts with your action, not in the background.</p></article>
          <article><h3>Your screenshots are not a library</h3><p>Captured screens are processed for the request and are not stored by Truly.</p></article>
          <article><h3>Your wallet remains the authority</h3><p>Pairing and payments require a clear confirmation inside Nimiq Pay.</p></article>
        </div>
      </Reveal>
      <Reveal as="section" id="faq" className="faq-section shell">
        <div className="faq-heading"><h2>Frequently asked questions</h2><p>Clear answers about the product, privacy, Nimiq, and what is available today.</p></div>
        <div className="faq-list">
          {frequentlyAskedQuestions.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <div className="faq-answer"><p>{item.answer}</p></div>
            </details>
          ))}
        </div>
      </Reveal>
    </>
  )
}
