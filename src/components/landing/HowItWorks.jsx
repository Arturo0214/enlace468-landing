import { motion } from 'framer-motion'
import { FileText, Search, ClipboardCheck, BarChart3 } from 'lucide-react'

const steps = [
  { n: '01', title: 'Define tu vacante', desc: 'JD → perfil inteligente con IA', icon: FileText },
  { n: '02', title: 'Sourcing', desc: 'LinkedIn, OCC, CSV o banco propio', icon: Search },
  { n: '03', title: 'Screening', desc: 'Scorecards + match score + evidencia', icon: ClipboardCheck },
  { n: '04', title: 'Decide', desc: 'Reporte ejecutivo con shortlist y próximos pasos', icon: BarChart3 },
]

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="relative py-14 sm:py-18 overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">Cómo <span className="gradient-text">funciona</span></h2>
          <p className="text-gray-400 text-base">De la vacante al cierre en 4 pasos</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          {steps.map((step, i) => (
            <motion.div key={step.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="relative flex flex-col items-center text-center">
              {i < steps.length - 1 && <div className="hidden md:block absolute top-7 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/30 to-accent/20" />}
              <div className="relative mb-3">
                <div className="w-14 h-14 rounded-xl glass-strong flex items-center justify-center">
                  <step.icon size={24} className="text-primary-light" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-[10px] font-bold text-white shadow-lg">{step.n}</span>
              </div>
              <h3 className="font-display font-bold text-sm text-white mb-1">{step.title}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
