import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'

const testimonials = [
  { quote: 'Antes tardábamos 45 días por vacante, ahora cerramos en 15.', name: 'Director de RH', role: 'Empresa FMCG', initials: 'DH', color: 'from-blue-500 to-blue-700' },
  { quote: 'Talent Desk nos entregó 12 candidatos en 5 días. 3 llegaron a entrevista final.', name: 'CEO', role: 'Startup fintech', initials: 'CE', color: 'from-purple-500 to-purple-700' },
  { quote: 'Los prompts de Recruiter Pro duplicaron mi productividad como headhunter.', name: 'Reclutador independiente', role: 'Headhunter', initials: 'RI', color: 'from-teal-500 to-teal-700' },
]

export default function Testimonials() {
  return (
    <section id="testimonios" className="relative py-14 sm:py-18 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">Lo que dicen <span className="gradient-text">nuestros clientes</span></h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="card-premium glass rounded-xl p-5 flex flex-col">
              <div className="card-shimmer" />
              <Quote size={16} className="text-primary-light mb-2" />
              <p className="text-gray-300 text-sm leading-relaxed mb-4 flex-1 italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-[10px] font-bold`}>{t.initials}</div>
                <div>
                  <p className="text-white text-xs font-semibold">{t.name}</p>
                  <p className="text-gray-500 text-[10px]">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
