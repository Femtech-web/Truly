import { BrandMark } from './BrandMark'

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-main">
        <div><div className="brand"><BrandMark /><span>Truly</span></div><p>Learn anything. By doing it.</p></div>
        <div className="footer-links"><a href="#product">Product</a><a href="#nimiq">Nimiq</a><a href="#privacy">Privacy</a><a href="#faq">FAQ</a></div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 Truly</span><span>Built for the Nimiq Mini Apps Competition</span></div>
    </footer>
  )
}
