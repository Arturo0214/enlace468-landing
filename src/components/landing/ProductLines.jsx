import { motion } from 'framer-motion'
import { Building2, Package, Zap, GraduationCap, Star } from 'lucide-react'

const products = [
  {
    title: 'Enlace 468 Enterprise',
    subtitle: 'Solución corporativa completa',
    description: 'Implementa una operación de atracción de talento con IA, metodología y acompañamiento.',
    icon: Building2,
    color: 'blue',
    gradient: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    features: ['Vacantes inteligentes', 'Screening IA', 'Pipeline Kanban', 'Reportes ejecutivos'],
  },
  {
    title: 'Talent Desk',
    subtitle: 'Servicio por vacante',
    description: 'No compras plataforma. Recibes candidatos mapeados, filtrados y rankeados para tu vacante.',
    icon: Package,
    color: 'purple',
    gradient: 'from-purple-500 to-purple-700',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    features: ['10-25 candidatos mapeados', 'Match score', 'Reporte ejecutivo'],
  },
  {
    title: 'Recruiter Pro',
    subtitle: 'Herramienta para reclutadores',
    description: 'Convierte al reclutador en un operador más productivo, preciso y documentado.',
    icon: Zap,
    color: 'teal',
    gradient: 'from-teal-500 to-teal-700',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    text: 'text-teal-400',
    features: ['Prompts IA', 'Outreach templates', 'Boolean search', 'Reportes'],
  },
  {
    title: 'TalentFlix / Academy',
    subtitle: 'Membresía de aprendizaje',
    description: 'Prompts, plantillas, playbooks, clases y comunidad para reclutar con IA.',
    icon: GraduationCap,
    color: 'amber',
    gradient: 'from-amber-500 to-amber-700',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    features: ['Playbooks', 'Sesiones en vivo', 'Casos prácticos', 'Comunidad'],
  },
  {
    title: 'Tu Marca Vende',
    subtitle: 'Producto para candidatos',
    description: 'Mejora tu CV, LinkedIn, pitch y posicionamiento profesional sin prometer empleo.',
    icon: Star,
    color: 'rose',
    gradient: 'from-rose-500 to-rose-700',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    features: ['Diagnóstico IA', 'Perfil optimizado', 'Simulador entrevista', 'Visibilidad'],
  },
]

export default function ProductLines() {
  return (
    <section id="productos" className="relative py-24 sm:py-32 overflow-hidden">
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
            Nuestras{' '}
            <span className="gradient-text">Líneas de Producto</span>
          </h2>
          <p className="text-gray-400 max-w-3xl mx-auto text-lg">
            5 soluciones diseñadas para cada actor del ecosistema de talento
          </p>
        </motion.div>

        {/* Product cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((product, i) => {
            const Icon = product.icon
            return (
              <motion.div
                key={product.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`card-premium glass rounded-2xl p-8 flex flex-col ${
                  i >= 3 ? 'lg:col-span-1' : ''
                }`}
              >
                <div className="card-shimmer" />

                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${product.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>

                {/* Title & subtitle */}
                <h3 className="font-display font-bold text-xl text-white mb-1">
                  {product.title}
                </h3>
                <p className={`text-sm font-medium ${product.text} mb-3`}>
                  {product.subtitle}
                </p>

                {/* Description */}
                <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-grow">
                  {product.description}
                </p>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {product.features.map((feature) => (
                    <span
                      key={feature}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${product.bg} ${product.text} border ${product.border}`}
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <a
                  href="#precios"
                  className={`inline-flex items-center gap-1 text-sm font-semibold ${product.text} hover:underline underline-offset-4 transition-colors`}
                >
                  Conocer más
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
