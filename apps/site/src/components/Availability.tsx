import { Reveal } from './Reveal'

export function Availability() {
  return (
    <Reveal as="section" id="availability" className="availability-section shell">
      <div className="availability-card">
        <div><h2>The first Truly learning loop is here.</h2><p>Ask about your screen, understand one useful step, try it yourself, and let Truly point you back to the work.</p></div>
        <a className="button button--light" href="#product">See the app <span aria-hidden="true">↑</span></a>
      </div>
    </Reveal>
  )
}
