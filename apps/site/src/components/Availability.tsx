import { Reveal } from './Reveal'

export function Availability() {
  return (
    <Reveal as="section" id="availability" className="availability-section shell">
      <div className="availability-card">
        <div><h2>Truly for macOS.</h2><p>A native companion that stays beside the work. Universal for Apple Silicon and Intel Macs running macOS 14.2 or newer.</p></div>
        <a className="button button--light" href="https://github.com/Femtech-web/Truly/releases/download/v0.1.0/Truly-0.1.0-macOS-universal.dmg">Download .dmg <span aria-hidden="true">↓</span></a>
      </div>
    </Reveal>
  )
}
