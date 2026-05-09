import { motion } from 'framer-motion'

const deliverables = [
  'Mapa de madurez IA en Talent Acquisition',
  'Checklist de IA responsable en reclutamiento',
  'Gu\u00eda de intake estrat\u00e9gico',
  'Job scorecard basado en skills',
  'Job description optimizada con IA',
  'Mensaje de sourcing personalizado',
  'Matriz de screening de candidatos',
  'Gu\u00eda de entrevista estructurada',
  'R\u00fabrica de evaluaci\u00f3n de entrevista',
  'Reporte post-entrevista',
  'Secuencia de comunicaci\u00f3n con candidatos',
  'Dashboard b\u00e1sico de KPIs TA',
  'Mini pipeline de reclutamiento con IA',
  'Plan de implementaci\u00f3n a 30 d\u00edas',
]

export default function Deliverables() {
  return (
    <section id="entregables" className="relative py-24 sm:py-32">
      {/* Background glow */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-4">
            <span className="gradient-text">14</span> Entregables Profesionales
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Cada entregable es una herramienta lista para aplicar en tu proceso de reclutamiento.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deliverables.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="group glass rounded-xl p-5 flex items-start gap-4 hover:bg-white/[0.06] hover:scale-[1.01] transition-all duration-300"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <span className="font-display font-bold text-sm gradient-text">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-3 min-h-[40px]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-60">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-gray-300 group-hover:text-white transition-colors">{item}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
