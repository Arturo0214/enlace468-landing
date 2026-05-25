import { motion } from 'framer-motion'
import { FileText, Search, ClipboardCheck, BarChart3 } from 'lucide-react'

const steps = [
  {
    number: '01',
    title: 'Define tu vacante',
    description: 'Convierte una descripción de puesto en un perfil inteligente con IA',
    icon: FileText,
  },
  {
    number: '02',
    title: 'Sourcing y banco',
    description: 'Encuentra candidatos en LinkedIn, OCC o importa desde CSV',
    icon: Search,
  },
  {
    number: '03',
    title: 'Screening y evaluación',
    description: 'Evalúa candidatos con scorecards, match scores y criterios objetivos',
    icon: ClipboardCheck,
  },
  {
    number: '04',
    title: 'Decide con evidencia',
    description: 'Genera reportes ejecutivos con shortlist, fortalezas, brechas y próximos pasos',
    icon: BarChart3,
  },
]

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-accent/5 rounded-full blur-[200px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-4">
            Cómo{' '}
            <span className="gradient-text">Funciona</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            De la vacante al cierre en 4 pasos inteligentes
          </p>
        </motion.div>

        {/* Steps - horizontal on desktop, vertical on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 lg:gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative flex flex-col items-center text-center"
              >
                {/* Connector line (desktop only, between cards) */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/30 to-accent/30" />
                )}

                {/* Number circle */}
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-2xl glass-strong flex items-center justify-center border border-white/10">
                    <Icon className="w-8 h-8 text-primary-light" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-xs font-bold text-white shadow-lg">
                    {step.number}
                  </span>
                </div>

                {/* Text */}
                <h3 className="font-display font-bold text-lg text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
