import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, ArrowRight, Star, Zap, Crown } from 'lucide-react'

const tiers = [
  {
    id: 'basic',
    name: 'Candidate Basic',
    price: 'Gratis',
    priceNote: null,
    description: 'Crear base de talento y perfil basico en el ecosistema.',
    icon: Star,
    gradient: 'from-gray-500/20 to-gray-400/10',
    iconColor: 'text-gray-300',
    border: 'border-white/10',
    ctaStyle: 'bg-white/10 hover:bg-white/20 text-white',
    features: [
      'Perfil visible para reclutadores',
      'Alertas basicas de vacantes',
      'Acceso al ecosistema Enlace 468',
    ],
  },
  {
    id: 'plus',
    name: 'Candidate Plus',
    price: '$199',
    priceNote: '/mes',
    description: 'Recursos, actualizaciones, recomendaciones y contenido de visibilidad.',
    icon: Zap,
    gradient: 'from-primary/20 to-accent/10',
    iconColor: 'text-primary-light',
    border: 'border-primary-light/20',
    ctaStyle: 'bg-gradient-to-r from-primary to-accent text-white hover:opacity-90',
    popular: true,
    features: [
      'Todo Basic incluido',
      'Contenido premium semanal',
      'Recomendaciones de vacantes',
      'Tips de visibilidad semanales',
      'Recursos descargables',
    ],
  },
  {
    id: 'pro',
    name: 'Candidate Pro',
    price: '$349',
    priceNote: '/mes',
    description: 'Alertas, optimizacion periodica y recursos premium para busqueda activa.',
    icon: Crown,
    gradient: 'from-gold/20 to-amber-500/10',
    iconColor: 'text-gold',
    border: 'border-gold/20',
    ctaStyle: 'bg-gradient-to-r from-gold to-amber-500 text-black font-bold hover:opacity-90',
    features: [
      'Todo Plus incluido',
      'Alertas prioritarias',
      'Optimizacion periodica de perfil',
      'Acceso a recursos premium',
      'Visibilidad destacada en marketplace',
    ],
  },
]

export default function CandidatePortal() {
  return (
    <div className="min-h-screen" style={{ background: '#0B1121' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo-enlace468.jpeg" alt="Enlace 468" className="h-8 w-auto object-contain" />
        </Link>
        <Link
          to="/login"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Iniciar sesion
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary-light text-sm font-medium mb-6">
            <Star size={14} />
            Tu Marca Vende
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Tu perfil profesional en Enlace 468
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Crea tu perfil, destaca ante reclutadores y accede a oportunidades exclusivas
            en el ecosistema de talento mas avanzado de Mexico.
          </p>
        </motion.div>

        {/* Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {tiers.map((tier, i) => {
            const Icon = tier.icon
            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                className={`relative rounded-2xl p-6 flex flex-col transition-all ${tier.border}`}
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                  backdropFilter: 'blur(12px)',
                  border: tier.popular ? '1.5px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent text-white text-xs font-bold">
                    Mas popular
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center ${tier.iconColor} mb-4`}>
                  <Icon size={24} />
                </div>

                <h2 className="text-xl font-display font-bold text-white mb-1">{tier.name}</h2>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  {tier.priceNote && <span className="text-sm text-gray-500">{tier.priceNote}</span>}
                </div>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">{tier.description}</p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {tier.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle size={15} className="text-accent mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to={tier.id === 'basic' ? '/login' : `/checkout?plan=candidate_${tier.id}`}
                  className={`flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all ${tier.ctaStyle}`}
                >
                  {tier.id === 'basic' ? 'Crear cuenta gratis' : 'Comenzar ahora'}
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Login link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <p className="text-gray-500">
            Ya eres miembro?{' '}
            <Link to="/login" className="text-primary-light hover:underline font-medium">
              Inicia sesion aqui
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
