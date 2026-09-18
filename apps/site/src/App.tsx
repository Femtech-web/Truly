import { Availability } from './components/Availability'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { LearningStory } from './components/LearningStory'
import { NimiqSection } from './components/NimiqSection'
import { ProductPreview } from './components/ProductPreview'
import { TrustAndFaq } from './components/TrustAndFaq'
import { DocsPage } from './pages/DocsPage'

function App() {
  const page = window.location.pathname.replace(/\/+$/, '')
  if (page === '/docs') return <DocsPage />

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Hero />
        <ProductPreview />
        <LearningStory />
        <NimiqSection />
        <TrustAndFaq />
        <Availability />
      </main>
      <Footer />
    </>
  )
}

export default App
