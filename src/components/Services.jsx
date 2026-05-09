import { motion } from 'framer-motion'

const services = [
  {
    title: 'Desarrollo Humano',
    description: 'Programas de liderazgo, coaching ejecutivo y desarrollo de competencias para equipos de alto rendimiento.',
    tags: ['Coaching', 'Liderazgo', 'Competencias'],
    color: 'primary',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: 'Desarrollo Empresarial',
    description: 'Consultor\u00eda estrat\u00e9gica para optimizar procesos, estructuras organizacionales y cultura corporativa.',
    tags: ['Estrategia', 'Procesos', 'Cultura'],
    color: 'accent',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: 'Estrategias Financieras',
    description: 'M\u00e1s de 20 a\u00f1os en inversiones y seguros. Planeaci\u00f3n financiera personalizada para personas y empresas.',
    tags: ['Inversiones', 'Seguros', 'Planeaci\u00f3n'],
    color: 'primary',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: 'Eventos Corporativos',
    description: 'Dise\u00f1o y producci\u00f3n de eventos de alto impacto: conferencias, workshops, team building y convenciones.',
    tags: ['Conferencias', 'Workshops', 'Team Building'],
    color: 'accent',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
]

export default function Services() {
  return (
    <section id="servicios" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-4">
            Nuestras &aacute;reas de{' '}
            <span className="gradient-text">expertise</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Cuatro pilares de consultor&iacute;a que impulsan el crecimiento integral de tu organizaci&oacute;n.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className={`group glass rounded-2xl p-8 hover:scale-[1.02] transition-all duration-300 border-t-2 ${
                service.color === 'primary' ? 'border-t-primary' : 'border-t-accent'
              } hover:shadow-xl ${
                service.color === 'primary' ? 'hover:shadow-primary/10' : 'hover:shadow-accent/10'
              }`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${
                service.color === 'primary'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-accent/10 text-accent'
              }`}>
                {service.icon}
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-3 group-hover:text-primary-light transition-colors">
                {service.title}
              </h3>
              <p className="text-gray-400 mb-5 leading-relaxed">{service.description}</p>
              <div className="flex flex-wrap gap-2">
                {service.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-3 py-1 rounded-full ${
                      service.color === 'primary'
                        ? 'bg-primary/10 text-primary-light'
                        : 'bg-accent/10 text-accent-light'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
