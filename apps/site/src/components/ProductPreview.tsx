import { Check, Mic, Monitor, WalletCards } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { Reveal } from './Reveal'

export function ProductPreview() {
  return (
    <Reveal as="section" id="product" className="product-showcase shell" aria-label="Truly product preview">
      <div className="product-stage" aria-label="A Truly Path moving from phone to the Mac companion">
        <div className="product-phone">
          <div className="product-phone__bar"><div><BrandMark /><b>Truly</b></div><span>NQ47…2AG1</span></div>
          <div className="product-phone__body">
            <small>Your current Path</small>
            <h3>NIM payments users can trust</h3>
            <p>Set a clear price</p>
            <div className="product-phone__progress"><i /></div>
            <div className="product-phone__meta"><span>1 of 3</span><span>In progress</span></div>
            <button type="button">Continue on my Mac <span aria-hidden="true">→</span></button>
          </div>
        </div>

        <div className="product-handoff" aria-hidden="true"><span>Task ready</span><i>→</i></div>

        <div className="product-desktop">
          <div className="product-desktop__bar"><i /><i /><i /><span>Nimiq Provider</span></div>
          <div className="product-desktop__page">
            <div className="product-page-copy"><small>NIMIQ MINI APPS</small><h3>Show a clear NIM price</h3><p>Amounts are represented in integer Luna and shown to people in NIM.</p><div className="product-price"><span>Checkout amount</span><strong>0.01 NIM</strong></div></div>
          </div>
          <aside className="product-companion">
            <div className="product-companion__head"><div><BrandMark /><b>Truly</b></div><span>Step 1 of 3</span></div>
            <div className="product-companion__input"><Mic size={15} /><span>Ask about what you see</span></div>
            <div className="product-companion__answer"><small>You asked</small><p>Why is this 1,000 Luna?</p><div>One NIM contains 100,000 Luna, so 0.01 NIM is 1,000 Luna. Keep the integer value in the payment request and format it as NIM for the person paying.</div></div>
            <button type="button"><Check size={15} /> Check my work</button>
          </aside>
          <div className="product-complete"><Check size={15} /><span><b>Step complete</b>Progress saved to your Task</span></div>
        </div>
      </div>

      <div className="product-proof">
        <span><WalletCards size={16} /> Wallet-owned access</span>
        <span><Monitor size={16} /> Native Mac companion</span>
        <span><Check size={16} /> Visible work checked</span>
      </div>
    </Reveal>
  )
}
