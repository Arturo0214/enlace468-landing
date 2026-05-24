import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen, FileText, Video, Download, Users, Lock,
  GraduationCap, Sparkles, ArrowRight, Star
} from 'lucide-react'
import { useAuth } from '../../lib/auth'

const PLAN_LEVELS = {
  free: { label: 'Gratis', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  founder: { label: 'Founder', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  plus: { label: 'Plus', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  pro: { label: 'Pro', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
}

const TYPE_ICONS = {
  article: BookOpen,
  guide: FileText,
  video: Video,
  template: Download,
  community: Users,
}

const RESOURCES = [
  // Free resources
  {
    id: 'intro-reclutamiento-ia',
    title: 'Introduccion al Reclutamiento con IA',
    description: 'Guia fundamental sobre como la inteligencia artificial esta transformando el proceso de atraccion de talento.',
    type: 'article',
    category: 'Academy Free',
    plan: 'free',
  },
  {
    id: 'newsletter-talent-acquisition',
    title: 'Newsletter: Tendencias en Talent Acquisition',
    description: 'Mantente actualizado con las ultimas tendencias en adquisicion de talento, herramientas y mejores practicas.',
    type: 'article',
    category: 'Academy Free',
    plan: 'free',
  },
  {
    id: 'clase-futuro-reclutador',
    title: 'Clase abierta: El futuro del reclutador',
    description: 'Sesion en video sobre el rol emergente del reclutador como consultor estrategico de talento.',
    type: 'video',
    category: 'Academy Free',
    plan: 'free',
  },
  // Founder resources
  {
    id: 'prompts-sourcing-linkedin',
    title: 'Prompts para sourcing en LinkedIn',
    description: '5 prompts listos para usar con ChatGPT y Claude que potencian tu busqueda de candidatos en LinkedIn.',
    type: 'template',
    category: 'Founder',
    plan: 'founder',
  },
  {
    id: 'scorecard-entrevista',
    title: 'Plantilla: Scorecard de entrevista',
    description: 'Evalua candidatos de forma estructurada con competencias, escala 1-5 y recomendacion final.',
    type: 'template',
    category: 'Founder',
    plan: 'founder',
  },
  {
    id: 'boolean-search-avanzado',
    title: 'Mini guia: Boolean Search avanzado',
    description: 'Domina la busqueda booleana en LinkedIn con operadores, sintaxis y 10 ejemplos reales para el mercado mexicano.',
    type: 'guide',
    category: 'Founder',
    plan: 'founder',
  },
  {
    id: 'reporte-ejecutivo-vacante',
    title: 'Plantilla: Reporte ejecutivo de vacante',
    description: 'Genera reportes profesionales del estatus de cada vacante para presentar a hiring managers y directivos.',
    type: 'template',
    category: 'Founder',
    plan: 'founder',
  },
  {
    id: 'screening-asistido-ia',
    title: 'Guia: Screening asistido por IA',
    description: 'Aprende a usar herramientas de IA para filtrar CVs, identificar red flags y priorizar candidatos automaticamente.',
    type: 'guide',
    category: 'Founder',
    plan: 'founder',
  },
]

const stats = [
  { value: '12+', label: 'recursos', icon: BookOpen },
  { value: '5', label: 'guias', icon: FileText },
  { value: '', label: 'Comunidad activa', icon: Users },
]

export default function AcademyDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [filter, setFilter] = useState('all')

  // For now, treat all users as free-tier unless we add subscription checking
  const userPlan = 'free'

  const canAccess = (resourcePlan) => {
    const hierarchy = ['free', 'founder', 'plus', 'pro']
    return hierarchy.indexOf(userPlan) >= hierarchy.indexOf(resourcePlan)
  }

  const filtered = filter === 'all'
    ? RESOURCES
    : RESOURCES.filter(r => r.plan === filter)

  const freeResources = filtered.filter(r => r.plan === 'free')
  const founderResources = filtered.filter(r => r.plan === 'founder')

  return (
    <div>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative glass rounded-2xl p-8 mb-8 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-accent/10 to-transparent rounded-full -ml-16 -mb-16" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={20} className="text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              Aprendizaje continuo
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
            TalentFlix / <span className="gradient-text">Enlace 468 Academy</span>
          </h1>
          <p className="text-gray-400 max-w-xl text-base">
            Recursos, guias y plantillas disenados para que reclutadores dominen las herramientas
            de IA y lleven su operacion al siguiente nivel.
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(({ value, label, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-xl p-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary">
                <Icon size={20} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{value || <Star size={18} className="text-amber-400" />}</div>
                <div className="text-sm text-gray-400">{label}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'free', label: 'Gratis' },
          { key: 'founder', label: 'Founder' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === key
                ? 'bg-primary text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Free Resources */}
      {freeResources.length > 0 && (
        <ResourceSection
          title="Recursos gratuitos"
          subtitle="Academy Free"
          resources={freeResources}
          canAccess={canAccess}
          onOpen={(id) => navigate(`/dashboard/academy/${id}`)}
        />
      )}

      {/* Founder Resources */}
      {founderResources.length > 0 && (
        <ResourceSection
          title="Recursos Founder"
          subtitle="$299/mes"
          resources={founderResources}
          canAccess={canAccess}
          onOpen={(id) => navigate(`/dashboard/academy/${id}`)}
        />
      )}
    </div>
  )
}

function ResourceSection({ title, subtitle, resources, canAccess, onOpen }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-lg font-display font-semibold text-white">{title}</h2>
        <span className="text-xs text-gray-500">{subtitle}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.map((resource, i) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            index={i}
            hasAccess={canAccess(resource.plan)}
            onOpen={() => onOpen(resource.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ResourceCard({ resource, index, hasAccess, onOpen }) {
  const Icon = TYPE_ICONS[resource.type] || BookOpen
  const planStyle = PLAN_LEVELS[resource.plan]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass rounded-xl p-5 flex flex-col cursor-pointer group"
      onClick={hasAccess ? onOpen : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-primary-light group-hover:from-primary/30 group-hover:to-accent/20 transition-all">
          <Icon size={20} />
        </div>
        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${planStyle.color}`}>
          {planStyle.label}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-primary-light transition-colors">
        {resource.title}
      </h3>
      <p className="text-xs text-gray-400 mb-4 flex-1 leading-relaxed">
        {resource.description}
      </p>

      <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
          {resource.category}
        </span>
        {hasAccess ? (
          <span className="text-xs text-primary-light font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            {resource.type === 'template' ? 'Descargar' : 'Ver recurso'}
            <ArrowRight size={12} />
          </span>
        ) : (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Lock size={12} />
            Requiere plan {planStyle.label}
          </span>
        )}
      </div>
    </motion.div>
  )
}
