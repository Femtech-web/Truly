import { BrandMark } from './BrandMark'
import { Reveal } from './Reveal'

export function NimiqSection() {
  return (
    <section id="nimiq" className="nimiq-section">
      <Reveal className="shell nimiq-grid">
        <div className="nimiq-copy">
          <h2>Your learning follows you. Your wallet stays in your hands.</h2>
          <p>Nimiq Pay connects Truly to the learner—not to a password. Pair your Mac, unlock creator-made Skills with NIM, and keep your progress available from your phone.</p>
          <div className="nimiq-details">
            <div><b>Pair with a signature</b><span>Approve the exact Mac you want to connect.</span></div>
            <div><b>Unlock Skills with NIM</b><span>Wallet approval remains inside Nimiq Pay.</span></div>
            <div><b>Continue where you stopped</b><span>Your completed work stays synchronized.</span></div>
          </div>
        </div>
        <div className="nimiq-product" aria-label="Truly Mini App product preview">
          <div className="pair-card">
            <div><span>Pairing request</span><b>Femi’s MacBook Pro</b></div><span className="pair-code">TRU–482</span><small>Confirm this code in Nimiq Pay</small>
          </div>
          <div className="phone">
            <div className="phone-screen">
              <div className="phone-status"><span>9:41</span><span className="dynamic-island" aria-hidden="true" /><span>● ◒</span></div>
              <div className="phone-nav"><div className="brand"><BrandMark /><span>Truly</span></div><span className="wallet-avatar">FK</span></div>
              <div className="phone-content">
                <h3>Good afternoon, Femi</h3><p>Continue where you left off.</p>
                <div className="phone-progress-card">
                  <div><span>React Effects</span><b>72%</b></div><div className="phone-progress"><i /></div><small>Learning now on Mac</small>
                </div>
                <div className="phone-section-head"><b>Skills</b><span>View all</span></div>
                <div className="phone-skill"><span className="skill-monogram">De</span><div><b>DeFi from zero</b><small>5 practical lessons</small></div><strong>1 NIM</strong></div>
                <div className="phone-skill"><span className="skill-monogram skill-monogram--light">Js</span><div><b>React Effects</b><small>Continue learning</small></div><strong>Open</strong></div>
              </div>
              <div className="phone-home" aria-hidden="true" />
            </div>
          </div>
          <div className="device-card"><span className="device-led" aria-hidden="true" /><div><b>Mac connected</b><small>Active learning session</small></div><span>Live</span></div>
        </div>
      </Reveal>
    </section>
  )
}
