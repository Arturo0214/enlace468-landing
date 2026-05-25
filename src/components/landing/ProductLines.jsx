import { motion } from 'framer-motion'
import { Building2, Package, Zap, GraduationCap, Star, ArrowRight } from 'lucide-react'

const products = [
  { title: 'Enterprise', sub: 'Solución corporativa', icon: Building2, gradient: 'from-blue-500 to-blue-700', text: 'text-blue-500', bg: 'bg-blue-500/8', features: ['Screening IA', 'Pipeline', 'Reportes'] },
  { title: 'Talent Desk', sub: 'Servicio por vacante', icon: Package, gradient: 'from-purple-500 to-purple-700', text: 'text-purple-500', bg: 'bg-purple-500/8', features: ['Candidatos mapeados', 'Match score', 'Reporte'] },
  { title: 'Recruiter Pro', sub: 'Herramientas IA', icon: Zap, gradient: 'from-teal-500 to-teal-700', text: 'text-teal-500', bg: 'bg-teal-500/8', features: ['Prompts', 'Outreach', 'Boolean search'] },
  { title: 'Academy', sub: 'Aprendizaje continuo', icon: GraduationCap, gradient: 'from-amber-500 to-amber-700', text: 'text-amber-500', bg: 'bg-amber-500/8', features: ['Playbooks', 'Sesiones en vivo', 'Comunidad'] },
  { title: 'Tu Marca Vende', sub: 'Para candidatos', icon: Star, gradient: 'from-rose-500 to-rose-700', text: 'text-rose-500', bg: 'bg-rose-500/8', features: ['CV optimizado', 'Pitch IA', 'Simulador'] },
]

export default function ProductLines() {
  return (
    <section id="productos" className="relative py-16 sm:py-20 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">
            Nuestras <span className="gradient-text">soluciones</span>
          </h2>
          <p className="text-gray-400 text-base">5 líneas de producto para cada actor del ecosistema de talento</p>
        </motion.div>

        {/* 5 cards in a single row on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
          {products.map((p, i) => (
            <motion.a key={p.title} href="#precios"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="card-premium glass rounded-xl p-4 flex flex-col group cursor-pointer">
              <div className="card-shimmer" />
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                <p.icon size={20} className="text-white" />
              </div>
              <h3 className="font-display font-bold text-sm text-white leading-tight">{p.title}</h3>
              <p className={`text-[11px] font-medium ${p.text} mb-2`}>{p.sub}</p>
              <div className="flex flex-wrap gap-1 mb-3 flex-1">
                {p.features.map(f => (
                  <span key={f} className={`text-[9px] px-1.5 py-0.5 rounded ${p.bg} ${p.text} font-medium`}>{f}</span>
                ))}
              </div>
              <span className={`flex items-center gap-1 text-[11px] font-semibold ${p.text} group-hover:gap-2 transition-all`}>
                Ver más <ArrowRight size={10} />
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  )
}
