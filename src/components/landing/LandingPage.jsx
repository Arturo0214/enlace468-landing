import ParticleBackground from './ParticleBackground'
import Navbar from './Navbar'
import Hero from './Hero'
import ProductLines from './ProductLines'
import HowItWorks from './HowItWorks'
import Pricing from './Pricing'
import Testimonials from './Testimonials'
import Contact from './Contact'
import Footer from './Footer'

export default function LandingPage() {
  return (
    <>
      <ParticleBackground />
      <Navbar />
      <main>
        <Hero />
        <ProductLines />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
