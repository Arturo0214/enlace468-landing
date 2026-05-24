import ParticleBackground from './ParticleBackground'
import Navbar from './Navbar'
import Hero from './Hero'
import Services from './Services'
import AITalentAdvisor from './AITalentAdvisor'
import Modules from './Modules'
import Deliverables from './Deliverables'
import Competencies from './Competencies'
import Pricing from './Pricing'
import WhyThisCourse from './WhyThisCourse'
import Contact from './Contact'
import Footer from './Footer'

export default function LandingPage() {
  return (
    <>
      <ParticleBackground />
      <Navbar />
      <main>
        <Hero />
        <Services />
        <AITalentAdvisor />
        <Modules />
        <Deliverables />
        <Competencies />
        <Pricing />
        <WhyThisCourse />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
