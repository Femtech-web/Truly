import { Reveal } from './Reveal'

export function Availability() {
  return (
    <Reveal as="section" id="availability" className="availability-section shell">
      <div className="availability-card">
        <div><h2>Truly for macOS.</h2><p>A native companion that stays beside the work, distributed directly as a .dmg.</p></div>
        <a className="button button--light" href="#product">See Truly in action <span aria-hidden="true">↑</span></a>
      </div>
    </Reveal>
  )
}
