import { useEffect, useState } from 'react'
import { BrandMark } from './BrandMark'

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 8)
    updateHeader()
    window.addEventListener('scroll', updateHeader, { passive: true })
    return () => window.removeEventListener('scroll', updateHeader)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className={`site-header${scrolled ? ' site-header--scrolled' : ''}`}>
      <nav className="nav shell" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Truly home" onClick={closeMenu}>
          <BrandMark />
          <span>Truly</span>
        </a>

        <button
          className="menu-button"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="nav-links"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div id="nav-links" className={`nav-links${menuOpen ? ' nav-links--open' : ''}`}>
          <a href="#product" onClick={closeMenu}>Product</a>
          <a href="#nimiq" onClick={closeMenu}>Nimiq</a>
          <a href="#privacy" onClick={closeMenu}>Privacy</a>
          <a href="#faq" onClick={closeMenu}>FAQ</a>
          <a className="nav-cta" href="#availability" onClick={closeMenu}>macOS app</a>
        </div>
      </nav>
    </header>
  )
}
