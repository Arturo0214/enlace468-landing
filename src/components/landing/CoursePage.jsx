import ParticleBackground from './ParticleBackground'
import Navbar from './Navbar'
import AITalentAdvisor from './AITalentAdvisor'
import Modules from './Modules'
import Deliverables from './Deliverables'
import Competencies from './Competencies'
import WhyThisCourse from './WhyThisCourse'
import Contact from './Contact'
import Footer from './Footer'

export default function CoursePage() {
  return (
    <>
      <ParticleBackground />
      <Navbar />
      <main>
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
