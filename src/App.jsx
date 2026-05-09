import ParticleBackground from './components/ParticleBackground'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Services from './components/Services'
import AITalentAdvisor from './components/AITalentAdvisor'
import Modules from './components/Modules'
import Deliverables from './components/Deliverables'
import Competencies from './components/Competencies'
import WhyThisCourse from './components/WhyThisCourse'
import Contact from './components/Contact'
import Footer from './components/Footer'

function App() {
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
        <WhyThisCourse />
        <Contact />
      </main>
      <Footer />
    </>
  )
}

export default App
