import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, Video, Calendar, Clock, User,
  Bell, BellRing, Play, CheckCircle
} from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import UpgradePrompt from '../ui/UpgradePrompt'

const UPCOMING_SESSIONS = [
  {
    id: 1,
    title: 'Sourcing con IA: De 0 a 100 candidatos en una semana',
    description: 'Aprende a usar ChatGPT y Claude para generar busquedas booleanas, analizar perfiles y crear pipelines de candidatos de forma masiva sin perder calidad.',
    speaker: 'Arturo Suarez',
    speakerRole: 'CEO, Enlace 468',
    date: '2026-06-05',
    time: '18:00',
    duration: '90 min',
    topics: ['Boolean search con IA', 'Analisis automatizado de perfiles', 'Outreach personalizado a escala'],
  },
  {
    id: 2,
    title: 'Automatiza tu proceso de screening con prompts avanzados',
    description: 'Sesion practica donde construiremos prompts de screening que evaluan CVs contra job descriptions, identifican red flags y generan scorecards automaticamente.',
    speaker: 'Mariana Torres',
    speakerRole: 'Head of Talent Acquisition',
    date: '2026-06-12',
    time: '18:00',
    duration: '75 min',
    topics: ['Prompts de screening', 'Evaluacion objetiva de CVs', 'Scorecards con IA'],
  },
  {
    id: 3,
    title: 'Construye tu marca personal como reclutador en LinkedIn',
    description: 'Estrategias probadas para posicionarte como referente en tu industria, atraer candidatos organicamente y generar negocio a traves de contenido profesional.',
    speaker: 'Carlos Mendez',
    speakerRole: 'LinkedIn Top Voice, Recruiting',
    date: '2026-06-19',
    time: '17:00',
    duration: '60 min',
    topics: ['Estrategia de contenido', 'Optimizacion de perfil', 'Networking estrategico'],
  },
  {
    id: 4,
    title: 'Reportes ejecutivos que impresionan a tus clientes',
    description: 'Como presentar metricas de reclutamiento, dashboards de pipeline y reportes de cierre que demuestren el valor de tu trabajo como reclutador o headhunter.',
    speaker: 'Laura Gutierrez',
    speakerRole: 'Directora de Operaciones, Staffing MX',
    date: '2026-06-26',
    time: '18:00',
    duration: '60 min',
    topics: ['Metricas clave de reclutamiento', 'Dashboards de pipeline', 'Presentacion a stakeholders'],
  },
]

const PAST_SESSIONS = [
  {
    id: 101,
    title: 'Introduccion al reclutamiento con IA generativa',
    speaker: 'Arturo Suarez',
    date: '2026-05-08',
    duration: '85 min',
    attendees: 124,
  },
  {
    id: 102,
    title: 'Boolean Search avanzado para el mercado mexicano',
    speaker: 'Roberto Hernandez',
    date: '2026-04-24',
    duration: '70 min',
    attendees: 98,
  },
  {
    id: 103,
    title: 'Entrevistas por competencias: guia practica',
    speaker: 'Mariana Torres',
    date: '2026-04-10',
    duration: '60 min',
    attendees: 112,
  },
]

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function getDaysUntil(dateStr) {
  const now = new Date()
  const target = new Date(dateStr + 'T00:00:00')
  const diff = Math.ceil((target - now) / 86400000)
  if (diff <= 0) return 'Hoy'
  if (diff === 1) return 'Manana'
  return `En ${diff} dias`
}

export default function LiveSessionsPage() {
  const { canDo } = usePlan()
  const [reminders, setReminders] = useState({})

  if (!canDo('access_academy')) {
    return <UpgradePrompt action="access_academy" />
  }

  const toggleReminder = (id) => {
    setReminders(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link to="/dashboard/academy" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ChevronLeft size={16} /> Academy
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/10 flex items-center justify-center">
            <Video size={20} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Sesiones en Vivo</h1>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-400">Pro</span>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Sesiones en vivo con expertos en reclutamiento e IA. Aprende estrategias practicas, haz preguntas en tiempo real y accede a las grabaciones.
        </p>
      </motion.div>

      {/* Upcoming Sessions */}
      <h2 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
        <Calendar size={18} className="text-primary-light" />
        Proximas sesiones
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
        {UPCOMING_SESSIONS.map((session, i) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass rounded-xl p-5 flex flex-col"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                {getDaysUntil(session.date)}
              </span>
              <button
                onClick={() => toggleReminder(session.id)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  reminders[session.id]
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {reminders[session.id] ? <><BellRing size={14} /> Recordatorio activo</> : <><Bell size={14} /> Agendar recordatorio</>}
              </button>
            </div>

            <h3 className="text-base font-display font-bold text-white mb-2">{session.title}</h3>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed flex-1">{session.description}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {session.topics.map((topic, ti) => (
                <span key={ti} className="text-[10px] font-medium text-primary-light bg-primary/10 px-2 py-0.5 rounded-full">
                  {topic}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-400 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="flex items-center gap-1"><User size={12} /> {session.speaker}</span>
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(session.date)}</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {session.time} hrs ({session.duration})</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Past Sessions */}
      <h2 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
        <CheckCircle size={18} className="text-emerald-400" />
        Sesiones pasadas
      </h2>
      <div className="space-y-3">
        {PAST_SESSIONS.map((session, i) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-500">
                <Play size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{session.title}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  <span>{session.speaker}</span>
                  <span>{formatDate(session.date)}</span>
                  <span>{session.duration}</span>
                  <span>{session.attendees} asistentes</span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary-light rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
              <Play size={14} />
              Ver grabacion
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
