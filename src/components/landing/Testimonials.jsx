import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'

const testimonials = [
  {
    quote: 'La plataforma cambió cómo operamos. Antes tardábamos 45 días por vacante, ahora cerramos en 15.',
    name: 'Director de RH',
    role: 'Empresa FMCG',
    initials: 'DH',
    color: 'from-blue-500 to-blue-700',
  },
  {
    quote: 'Talent Desk nos entregó 12 candidatos en 5 días. 3 llegaron a entrevista final.',
    name: 'CEO',
    role: 'Startup fintech',
    initials: 'CE',
    color: 'from-purple-500 to-purple-700',
  },
  {
    quote: 'Los prompts y templates de Recruiter Pro duplicaron mi productividad como headhunter.',
    name: 'Reclutador independiente',
    role: 'Headhunter',
    initials: 'RI',
    color: 'from-teal-500 to-teal-700',
  },
]

export default function Testimonials() {
  return (
    <section id="testimonios" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-4">
            Lo que dicen{' '}
            <span className="gradient-text">nuestros clientes</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Resultados reales de quienes ya usan la plataforma
          </p>
        </motion.div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="card-premium glass rounded-2xl p-8 flex flex-col"
            >
              <div className="card-shimmer" />

              {/* Quote icon */}
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <Quote className="w-5 h-5 text-primary-light" />
              </div>

              {/* Quote text */}
              <p className="text-gray-300 text-base leading-relaxed mb-8 flex-grow italic">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-sm font-bold`}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
