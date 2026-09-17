export function Hero() {
  return (
    <section id="top" className="hero shell">
      <div className="hero-copy">
        <h1 className="hero-enter hero-enter--title">
          Learn anything.
          <span>By doing it.</span>
        </h1>
        <p className="hero-enter hero-enter--body">
          Truly is a learning companion that understands the screen you choose to share,
          points to what matters, and helps you work through it without taking over.
        </p>
        <div className="hero-actions hero-enter hero-enter--actions">
          <a className="button button--primary" href="#product">
            See Truly in action <span aria-hidden="true">↓</span>
          </a>
          <a className="button button--text" href="#approach">
            How it teaches <span aria-hidden="true">→</span>
          </a>
        </div>
        <p className="hero-note hero-enter hero-enter--note">
          Designed for macOS <span aria-hidden="true">·</span> Connected through Nimiq Pay
        </p>
      </div>
    </section>
  )
}
