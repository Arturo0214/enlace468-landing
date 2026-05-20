import { motion } from 'framer-motion'

const reasons = [
  {
    title: 'No es solo prompts',
    description: 'Redise\u00f1a el ciclo completo de atracci\u00f3n de talento integrando benchmarks globales, experiencia de candidato, entrevistas estructuradas, scorecards y m\u00e9tricas de negocio.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    color: '#E6195B',
  },
  {
    title: 'Respaldo global',
    description: 'Basado en investigaci\u00f3n de Gartner, Deloitte, LinkedIn, SHRM, WEF, ManpowerGroup, Google re:Work, IBM, Korn Ferry y PwC.',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: '#8B5CF6',
  },
  {
    title: 'Aplicaci\u00f3n inmediata',
    description: 'Cada m\u00f3dulo produce un entregable real que puedes aplicar en tu proceso de reclutamiento desde el d\u00eda siguiente.',
    icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
    color: '#06B6D4',
  },
]

export default function WhyThisCourse() {
  return (
    <section id="por-que" className="relative py-24 sm:py-32">
      {/* Background glow */}
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[150px] -translate-y-1/2" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-4">
            &iquest;Por qu&eacute; <span className="gradient-text">este curso</span>?
          </h2>
          <p className="text-gray-400 text-lg">Lo que nos diferencia de cualquier otro programa de IA para RH.</p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reasons.map((reason, i) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="glass rounded-2xl p-8 hover:scale-[1.02] transition-all duration-300 group"
              style={{ borderTop: `3px solid ${reason.color}` }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                style={{ backgroundColor: `${reason.color}15` }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={reason.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={reason.icon} />
                </svg>
              </div>

              <h3 className="font-display font-bold text-xl text-white mb-3 group-hover:text-primary-light transition-colors">
                {reason.title}
              </h3>
              <p className="text-gray-400 leading-relaxed">
                {reason.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
