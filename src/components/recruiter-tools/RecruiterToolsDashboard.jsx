import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Wand2, MessageSquare, Search, ClipboardList, ArrowRight } from 'lucide-react'

const tools = [
  {
    id: 'prompts',
    name: 'Generador de Prompts IA',
    description: 'Genera prompts optimizados para cada etapa del reclutamiento',
    icon: Wand2,
    gradient: 'from-primary/20 to-accent/10',
    iconColor: 'text-primary-light',
    borderHover: 'hover:border-primary-light/30',
    tier: 'Basic',
    to: '/dashboard/recruiter-tools/prompts',
  },
  {
    id: 'outreach',
    name: 'Plantillas de Outreach',
    description: 'Templates de mensajes personalizados para LinkedIn, email y WhatsApp',
    icon: MessageSquare,
    gradient: 'from-accent/20 to-gold/10',
    iconColor: 'text-accent-light',
    borderHover: 'hover:border-accent-light/30',
    tier: 'Basic',
    to: '/dashboard/recruiter-tools/outreach',
  },
  {
    id: 'search-guides',
    name: 'Guias de Busqueda',
    description: 'Estrategias y boolean strings para sourcing avanzado',
    icon: Search,
    gradient: 'from-gold/20 to-primary/10',
    iconColor: 'text-gold',
    borderHover: 'hover:border-gold/30',
    tier: 'Pro',
    to: '/dashboard/recruiter-tools/search-guides',
  },
  {
    id: 'tracking',
    name: 'Formatos de Seguimiento',
    description: 'Checklists y formatos para tracking de candidatos',
    icon: ClipboardList,
    gradient: 'from-emerald-500/20 to-primary/10',
    iconColor: 'text-emerald-400',
    borderHover: 'hover:border-emerald-400/30',
    tier: 'Pro',
    to: '/dashboard/recruiter-tools/tracking',
  },
]

export default function RecruiterToolsDashboard() {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <Zap size={20} className="text-primary-light" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Recruiter Pro Tools</h1>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Herramientas para potenciar tu productividad como reclutador
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((tool, i) => {
          const Icon = tool.icon
          return (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Link
                to={tool.to}
                className={`block glass rounded-xl p-6 transition-all group ${tool.borderHover}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center ${tool.iconColor} group-hover:scale-110 transition-transform`}>
                    <Icon size={24} />
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    tool.tier === 'Basic'
                      ? 'bg-accent/10 text-accent-light'
                      : 'bg-gold/10 text-gold'
                  }`}>
                    {tool.tier}
                  </span>
                </div>

                <h2 className="text-lg font-display font-bold text-white mb-2">{tool.name}</h2>
                <p className="text-sm text-gray-400 mb-5 leading-relaxed">{tool.description}</p>

                <div className="flex items-center gap-2 text-sm font-semibold text-primary-light group-hover:gap-3 transition-all">
                  Explorar herramienta
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
