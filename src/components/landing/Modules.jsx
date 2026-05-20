import { motion } from 'framer-motion'

const modules = [
  {
    number: 1,
    duration: '45 min',
    title: 'Talent Acquisition 2026: IA, tendencias y nuevo rol del reclutador',
    product: 'Mapa de oportunidades de IA en Talent Acquisition',
    color: '#E6195B',
  },
  {
    number: 2,
    duration: '60 min',
    title: 'De la vacante tradicional al perfil inteligente',
    product: 'Job scorecard + vacante optimizada',
    color: '#8B5CF6',
  },
  {
    number: 3,
    duration: '90 min',
    title: 'Screening, entrevistas y evaluaci\u00f3n asistida por IA',
    product: 'Matriz de screening + gu\u00eda de entrevista estructurada',
    color: '#06B6D4',
  },
  {
    number: 4,
    duration: '45 min',
    title: 'Pipeline, m\u00e9tricas y proyecto integrador',
    product: 'Mini pipeline de reclutamiento con IA',
    color: '#10B981',
  },
]

export default function Modules() {
  return (
    <section id="modulos" className="relative py-24 sm:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-4">
            Estructura del{' '}
            <span className="gradient-text">Programa</span>
          </h2>
          <p className="text-gray-400 text-lg">4 m&oacute;dulos dise&ntilde;ados para una transformaci&oacute;n completa</p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-purple-500 via-accent to-green-500 opacity-30" />

          <div className="space-y-8">
            {modules.map((mod, i) => (
              <motion.div
                key={mod.number}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="relative pl-16 sm:pl-20"
              >
                {/* Timeline dot */}
                <div
                  className="absolute left-4 sm:left-6 top-6 w-4 h-4 rounded-full border-2"
                  style={{ borderColor: mod.color, backgroundColor: `${mod.color}33`, boxShadow: `0 0 20px ${mod.color}40` }}
                />

                {/* Card */}
                <div
                  className="glass rounded-2xl p-6 sm:p-8 hover:scale-[1.01] transition-all duration-300"
                  style={{ borderTop: `2px solid ${mod.color}` }}
                >
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${mod.color}20`, color: mod.color }}
                    >
                      M&oacute;dulo {mod.number}
                    </span>
                    <span className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
                      {mod.duration}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-lg sm:text-xl text-white mb-3">
                    {mod.title}
                  </h3>

                  <div className="flex items-start gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={mod.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span className="text-sm text-gray-400">
                      <span className="text-gray-300 font-medium">Entregable:</span> {mod.product}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
