import { useState } from 'react'
import { motion } from 'framer-motion'
import { Package, Users, FileText, Star, CheckCircle, ArrowRight, Crown } from 'lucide-react'
import TalentDeskRequest from './TalentDeskRequest'

const tiers = [
  {
    id: 'light',
    name: 'Light',
    price: 4900,
    gradient: 'from-accent/20 to-primary/10',
    iconColor: 'text-accent-light',
    borderHover: 'hover:border-accent-light/30',
    badge: 'bg-accent/10 text-accent-light',
    features: [
      '10 candidatos mapeados',
      'Busqueda inicial por perfil',
      'Ficha resumida por candidato',
      'Recomendacion basica de fit',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9900,
    gradient: 'from-primary/20 to-gold/10',
    iconColor: 'text-primary-light',
    borderHover: 'hover:border-primary-light/30',
    badge: 'bg-primary/10 text-primary-light',
    popular: true,
    features: [
      '15 candidatos mapeados',
      'Ranking por nivel de match',
      'Comentarios cualitativos',
      'Mensajes de contacto sugeridos',
      'Reporte ejecutivo descargable',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 24900,
    gradient: 'from-gold/20 to-amber-500/10',
    iconColor: 'text-gold',
    borderHover: 'hover:border-gold/30',
    badge: 'bg-gold/10 text-gold',
    features: [
      'Short list curada a la medida',
      'Contacto inicial con candidatos',
      'Validacion basica de interes',
      'Agenda sugerida de entrevistas',
      'Reporte ejecutivo final',
    ],
  },
]

function formatPrice(n) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 })
}

export default function TalentDeskDashboard() {
  const [selectedTier, setSelectedTier] = useState(null)

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-primary/10 flex items-center justify-center">
            <Package size={20} className="text-purple-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Talent Desk by Enlace 468</h1>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Candidatos mapeados, filtrados y rankeados para tu vacante
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`relative glass rounded-xl p-6 transition-all group ${tier.borderHover} ${
              tier.popular ? 'ring-1 ring-primary-light/30' : ''
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-primary-light/20 text-primary-light border border-primary-light/20">
                  <Star size={12} fill="currentColor" />
                  Mas popular
                </span>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center ${tier.iconColor}`}>
                {tier.id === 'light' && <Users size={24} />}
                {tier.id === 'pro' && <FileText size={24} />}
                {tier.id === 'premium' && <Crown size={24} />}
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${tier.badge}`}>
                {tier.name}
              </span>
            </div>

            <h2 className="text-lg font-display font-bold text-white mb-1">{tier.name}</h2>
            <div className="mb-5">
              <span className="text-3xl font-display font-bold text-white">{formatPrice(tier.price)}</span>
              <span className="text-sm text-gray-500 ml-1">MXN / vacante</span>
            </div>

            <ul className="space-y-2.5 mb-6">
              {tier.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2 text-sm text-gray-300">
                  <CheckCircle size={16} className={`${tier.iconColor} flex-shrink-0 mt-0.5`} />
                  {feat}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setSelectedTier(tier)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tier.popular
                  ? 'bg-gradient-to-r from-primary to-primary-light text-white hover:opacity-90'
                  : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              Solicitar Talent Desk
              <ArrowRight size={16} />
            </button>
          </motion.div>
        ))}
      </div>

      {selectedTier && (
        <TalentDeskRequest
          tier={selectedTier}
          onClose={() => setSelectedTier(null)}
        />
      )}
    </div>
  )
}
