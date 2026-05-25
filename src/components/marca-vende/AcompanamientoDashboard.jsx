import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Circle, Calendar, FileText, ExternalLink, Trophy, BookOpen, Search, Mic, Eye } from 'lucide-react'

const WEEKS = [
  {
    id: 1,
    title: 'Diagnostico y optimizacion inicial',
    color: 'from-primary/20 to-primary/5',
    borderColor: 'border-primary-light/20',
    textColor: 'text-primary-light',
    tasks: [
      'CV optimizado',
      'LinkedIn actualizado',
      'Pitch redactado',
      'Keywords implementadas',
    ],
  },
  {
    id: 2,
    title: 'Estrategia de visibilidad y networking',
    color: 'from-accent/20 to-accent/5',
    borderColor: 'border-accent/20',
    textColor: 'text-accent',
    tasks: [
      '5 posts programados',
      '10 conexiones estrategicas',
      'Perfil en 3 plataformas',
      'Hashtag strategy activa',
    ],
  },
  {
    id: 3,
    title: 'Preparacion de entrevistas y pitch',
    color: 'from-purple-500/20 to-purple-500/5',
    borderColor: 'border-purple-400/20',
    textColor: 'text-purple-400',
    tasks: [
      'Mock interview completada',
      '5 respuestas STAR preparadas',
      'Portafolio listo',
      'Referencias contactadas',
    ],
  },
  {
    id: 4,
    title: 'Refinamiento y lanzamiento activo',
    color: 'from-gold/20 to-gold/5',
    borderColor: 'border-gold/20',
    textColor: 'text-gold',
    tasks: [
      '10 aplicaciones enviadas',
      'Seguimiento de aplicaciones',
      'Ajustes finales',
      'Plan de accion post-programa',
    ],
  },
]

const RESOURCE_LINKS = [
  { label: 'Diagnostico', to: '/dashboard/marca-vende/diagnostico', icon: Search },
  { label: 'Perfil Pro', to: '/dashboard/marca-vende/perfil-pro', icon: FileText },
  { label: 'Simulador', to: '/dashboard/marca-vende/entrevista', icon: Mic },
  { label: 'Visibilidad', to: '/dashboard/marca-vende/visibilidad', icon: Eye },
]

function initCheckedState() {
  const state = {}
  WEEKS.forEach(w => {
    state[w.id] = w.tasks.map(() => false)
  })
  return state
}

function initNotesState() {
  const state = {}
  WEEKS.forEach(w => { state[w.id] = '' })
  return state
}

export default function AcompanamientoDashboard() {
  const [checked, setChecked] = useState(initCheckedState)
  const [notes, setNotes] = useState(initNotesState)
  const [activeWeek, setActiveWeek] = useState(1)

  const toggleTask = (weekId, taskIdx) => {
    setChecked(prev => ({
      ...prev,
      [weekId]: prev[weekId].map((v, i) => i === taskIdx ? !v : v),
    }))
  }

  const totalTasks = WEEKS.reduce((sum, w) => sum + w.tasks.length, 0)
  const completedTasks = Object.values(checked).flat().filter(Boolean).length
  const completionPct = Math.round((completedTasks / totalTasks) * 100)

  const weekCompleted = (weekId) => {
    const tasks = checked[weekId]
    const done = tasks.filter(Boolean).length
    return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) }
  }

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link to="/dashboard/marca-vende" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors mb-4">
          <ArrowLeft size={14} /> Tu Marca Vende
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold/20 to-amber-500/10 flex items-center justify-center">
            <Trophy size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Acompanamiento 30 dias</h1>
            <p className="text-sm text-gray-500">$5,900 MXN - Programa intensivo de busqueda laboral</p>
          </div>
        </div>
      </motion.div>

      {/* Completion Score */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-xl p-5 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-gold" />
            <span className="text-sm font-medium text-white">Progreso general</span>
          </div>
          <span className="text-2xl font-bold text-gold">{completionPct}%</span>
        </div>
        <div className="h-3 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-gold to-amber-500"
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">{completedTasks} de {totalTasks} tareas completadas</p>
      </motion.div>

      {/* 30-Day Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Timeline del programa</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {WEEKS.map((week, i) => {
            const { done, total, pct } = weekCompleted(week.id)
            const isActive = activeWeek === week.id
            return (
              <button
                key={week.id}
                onClick={() => setActiveWeek(week.id)}
                className={`relative rounded-xl p-4 text-left transition-all ${
                  isActive ? `bg-gradient-to-br ${week.color} border ${week.borderColor}` : 'glass hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} className={isActive ? week.textColor : 'text-gray-500'} />
                  <span className={`text-xs font-bold ${isActive ? week.textColor : 'text-gray-500'}`}>
                    Semana {week.id}
                  </span>
                </div>
                <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-300'} mb-3`}>
                  {week.title}
                </p>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      pct === 100 ? 'bg-accent' : 'bg-white/30'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">{done}/{total} tareas</p>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Active Week Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist */}
        <motion.div
          key={activeWeek}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 glass rounded-xl p-6"
        >
          <h3 className="text-lg font-display font-semibold text-white mb-1">
            Semana {activeWeek}: {WEEKS[activeWeek - 1].title}
          </h3>
          <p className="text-xs text-gray-500 mb-5">Marca las tareas conforme las vayas completando.</p>

          <div className="space-y-3">
            {WEEKS[activeWeek - 1].tasks.map((task, idx) => {
              const isDone = checked[activeWeek][idx]
              return (
                <button
                  key={idx}
                  onClick={() => toggleTask(activeWeek, idx)}
                  className={`flex items-center gap-3 w-full rounded-lg px-4 py-3 text-left transition-all ${
                    isDone
                      ? 'bg-accent/10 border border-accent/20'
                      : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.06]'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle size={18} className="text-accent flex-shrink-0" />
                  ) : (
                    <Circle size={18} className="text-gray-600 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${isDone ? 'text-accent line-through' : 'text-gray-300'}`}>
                    {task}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Session Notes */}
          <div className="mt-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <BookOpen size={14} />
              Notas de sesion - Semana {activeWeek}
            </label>
            <textarea
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-light/40 focus:ring-1 focus:ring-primary-light/20 transition-colors min-h-[120px] resize-y"
              value={notes[activeWeek]}
              onChange={e => setNotes(prev => ({ ...prev, [activeWeek]: e.target.value }))}
              placeholder="Escribe aqui las notas de tu sesion de coaching..."
            />
          </div>
        </motion.div>

        {/* Resource Links */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-xl p-6 h-fit"
        >
          <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Herramientas rapidas</h3>
          <div className="space-y-2">
            {RESOURCE_LINKS.map(link => {
              const Icon = link.icon
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-colors group"
                >
                  <Icon size={16} className="text-gray-500 group-hover:text-primary-light transition-colors" />
                  {link.label}
                  <ExternalLink size={12} className="ml-auto text-gray-600 group-hover:text-gray-400" />
                </Link>
              )
            })}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-gold/5 border border-gold/10">
            <p className="text-xs text-gold font-medium mb-1">Necesitas ayuda?</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Contacta a tu coach para agendar tu proxima sesion o resolver dudas sobre el programa.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
