import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Search, Wand2, ArrowRight, CheckCircle, Mic, Eye } from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import UpgradePrompt from '../ui/UpgradePrompt'

const products = [
  {
    id: 'diagnostico',
    name: 'Diagnostico OpenToWork',
    price: '$399 MXN',
    description: 'Analiza tu CV y perfil de LinkedIn para descubrir areas de mejora y obtener una puntuacion profesional.',
    icon: Search,
    gradient: 'from-primary/20 to-accent/10',
    iconColor: 'text-primary-light',
    borderHover: 'hover:border-primary-light/30',
    features: [
      'Analisis de CV en PDF',
      'Validacion de perfil LinkedIn',
      'Puntuacion por seccion (0-100)',
      'Recomendaciones priorizadas',
      'Resultados instantaneos',
    ],
    cta: 'Iniciar diagnostico',
    to: '/dashboard/marca-vende/diagnostico',
  },
  {
    id: 'perfil-pro',
    name: 'Perfil Profesional IA',
    price: '$1,499 MXN',
    description: 'Genera tu headline, resumen profesional, pitch de elevador y palabras clave optimizadas para destacar.',
    icon: Wand2,
    gradient: 'from-accent/20 to-gold/10',
    iconColor: 'text-accent-light',
    borderHover: 'hover:border-accent-light/30',
    features: [
      'Headline optimizado',
      'Seccion "Acerca de mi"',
      'Palabras clave de industria',
      'Pitch de 30 segundos',
      'Resumen para CV',
    ],
    cta: 'Crear perfil optimizado',
    to: '/dashboard/marca-vende/perfil-pro',
  },
]

export default function MarcaVendeDashboard() {
  const { canDo } = usePlan()

  if (!canDo('use_marca_vende')) {
    return <UpgradePrompt action="use_marca_vende" />
  }

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <Sparkles size={20} className="text-primary-light" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Tu Marca Vende</h1>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Herramientas inteligentes para mejorar tu CV, perfil de LinkedIn y pitch profesional. Destaca ante reclutadores y consigue mejores oportunidades.
        </p>
      </motion.div>

      {/* Pro Tools Section */}
      <div className="mb-8">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-lg font-display font-semibold text-white">Herramientas Pro</h2>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">Pro</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            {
              id: 'entrevista',
              name: 'Simulador de Entrevista',
              description: 'Practica con preguntas reales, recibe retroalimentacion sobre tus respuestas y mejora tu desempeno.',
              icon: Mic,
              gradient: 'from-accent/20 to-primary/10',
              iconColor: 'text-accent-light',
              borderHover: 'hover:border-accent-light/30',
              cta: 'Iniciar simulacion',
              to: '/dashboard/marca-vende/entrevista',
            },
            {
              id: 'visibilidad',
              name: 'Estrategia de Visibilidad',
              description: 'Genera un plan completo de visibilidad en LinkedIn: calendario, plantillas, hashtags y networking.',
              icon: Eye,
              gradient: 'from-gold/20 to-primary/10',
              iconColor: 'text-gold',
              borderHover: 'hover:border-gold/30',
              cta: 'Generar estrategia',
              to: '/dashboard/marca-vende/visibilidad',
            },
          ].map((tool, i) => {
            const Icon = tool.icon
            return (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link
                  to={tool.to}
                  className={`block glass rounded-xl p-6 transition-all group ${tool.borderHover}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center ${tool.iconColor} group-hover:scale-110 transition-transform`}>
                      <Icon size={24} />
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-400">Pro</span>
                  </div>
                  <h2 className="text-lg font-display font-bold text-white mb-2">{tool.name}</h2>
                  <p className="text-sm text-gray-400 mb-5 leading-relaxed">{tool.description}</p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary-light group-hover:gap-3 transition-all">
                    {tool.cta}
                    <ArrowRight size={16} />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Product Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {products.map((product, i) => {
          const Icon = product.icon
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                to={product.to}
                className={`block glass rounded-xl p-6 transition-all group ${product.borderHover}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${product.gradient} flex items-center justify-center ${product.iconColor} group-hover:scale-110 transition-transform`}>
                    <Icon size={24} />
                  </div>
                  <span className="text-sm font-bold text-white bg-white/10 px-3 py-1 rounded-full">
                    {product.price}
                  </span>
                </div>

                {/* Name & Description */}
                <h2 className="text-lg font-display font-bold text-white mb-2">{product.name}</h2>
                <p className="text-sm text-gray-400 mb-5 leading-relaxed">{product.description}</p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {product.features.map((f, fi) => (
                    <li key={fi} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle size={14} className="text-accent flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="flex items-center gap-2 text-sm font-semibold text-primary-light group-hover:gap-3 transition-all">
                  {product.cta}
                  <ArrowRight size={16} />
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
