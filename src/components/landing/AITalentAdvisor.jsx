import { motion } from 'framer-motion'

const details = [
  { label: 'Duraci\u00f3n', value: '4 horas', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Modalidad', value: 'Presencial o virtual en vivo', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { label: 'Nivel', value: 'Intermedio, adaptable a especialistas senior', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { label: 'Enfoque', value: 'Te\u00f3rico-pr\u00e1ctico con aplicaci\u00f3n sobre vacantes reales o casos simulados', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
]

export default function AITalentAdvisor() {
  return (
    <section id="ai-talent-advisor" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary/15 via-accent/10 to-transparent blur-[120px] rounded-full" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 mb-6">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E6195B" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-sm font-medium text-gray-300">Nuevo Programa</span>
          </div>

          <h2 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl text-white mb-4">
            <span className="gradient-text">AI Talent</span>{' '}Advisor
          </h2>

          <p className="text-xl sm:text-2xl text-gray-300 font-display font-medium mb-4">
            Atracci&oacute;n de Talento con Inteligencia Artificial,
            <br className="hidden sm:block" />
            Evidencia y Criterio Humano
          </p>

          <p className="text-gray-400 max-w-3xl mx-auto text-lg leading-relaxed">
            Curso especializado de 4 horas para transformar el ciclo de atracci&oacute;n y
            selecci&oacute;n con IA. Modalidad presencial o virtual en vivo.
          </p>
        </motion.div>

        {/* Course details card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="glass-strong rounded-3xl p-8 sm:p-10 max-w-4xl mx-auto border border-primary/20"
        >
          <h3 className="font-display font-bold text-xl text-white mb-8 text-center">
            Detalles del Curso
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {details.map((detail, i) => (
              <div key={detail.label} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E6195B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={detail.icon} />
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">{detail.label}</div>
                  <div className="text-white font-medium">{detail.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Audience */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Audiencia</div>
                <div className="text-white font-medium">
                  Reclutadores, especialistas de Talent Acquisition, HRBP, coordinadores de RH,
                  l&iacute;deres de selecci&oacute;n, consultores de reclutamiento y headhunters
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
