import { Reveal } from './Reveal'

export function Availability() {
  return (
    <Reveal as="section" id="availability" className="availability-section shell">
      <div className="availability-card">
        <div><h2>Truly for macOS.</h2><p>The native app is in real-device testing now. A signed public download follows the competition preview.</p></div>
        <a className="button button--light" href="#product">Explore the preview <span aria-hidden="true">↑</span></a>
      </div>
    </Reveal>
  )
}
