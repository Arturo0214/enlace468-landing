import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Wand2, MessageSquare, Search, ClipboardList, ArrowRight, BarChart3, Award, GraduationCap, BookOpen, Clock, Users, CheckCircle, Star } from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import UpgradePrompt from '../ui/UpgradePrompt'

const modules = [
  { number: '01', title: 'Prompts de IA para Reclutamiento', desc: 'Domina la generación de prompts para cada etapa: sourcing, screening, outreach, entrevistas y reportes.', duration: '2 hrs', icon: Wand2 },
  { number: '02', title: 'Outreach Profesional', desc: 'Diseña mensajes que generan respuesta en LinkedIn, email y WhatsApp con plantillas probadas.', duration: '1.5 hrs', icon: MessageSquare },
  { number: '03', title: 'Boolean Search y Sourcing Avanzado', desc: 'Técnicas de X-Ray search, operadores booleanos y estrategias para encontrar talento pasivo.', duration: '2 hrs', icon: Search },
  { number: '04', title: 'Pipeline y Seguimiento', desc: 'Formatos, checklists y frameworks para no perder ningún candidato en el proceso.', duration: '1.5 hrs', icon: ClipboardList },
  { number: '05', title: 'Reportes Ejecutivos', desc: 'Genera reportes que convencen al hiring manager: métricas, shortlist, evidencia y próximos pasos.', duration: '1 hr', icon: BarChart3 },
  { number: '06', title: 'Mejores Prácticas', desc: 'Frameworks comprobados: intake, screening sin sesgo, negociación de oferta y onboarding.', duration: '2 hrs', icon: Award },
]

const tools = [
  { id: 'prompts', name: 'Generador de Prompts IA', description: '14 prompts listos para usar en cada etapa', icon: Wand2, gradient: 'from-primary/20 to-accent/10', iconColor: 'text-primary-light', borderHover: 'hover:border-primary-light/30', to: '/dashboard/recruiter-tools/prompts' },
  { id: 'outreach', name: 'Plantillas de Outreach', description: '11 templates para LinkedIn, email y WhatsApp', icon: MessageSquare, gradient: 'from-accent/20 to-gold/10', iconColor: 'text-accent-light', borderHover: 'hover:border-accent-light/30', to: '/dashboard/recruiter-tools/outreach' },
  { id: 'search-guides', name: 'Guías de Búsqueda', description: 'Boolean strings y estrategias de sourcing', icon: Search, gradient: 'from-gold/20 to-primary/10', iconColor: 'text-gold', borderHover: 'hover:border-gold/30', to: '/dashboard/recruiter-tools/search-guides' },
  { id: 'tracking', name: 'Formatos de Seguimiento', description: 'Checklists y formatos para tracking', icon: ClipboardList, gradient: 'from-emerald-500/20 to-primary/10', iconColor: 'text-emerald-400', borderHover: 'hover:border-emerald-400/30', to: '/dashboard/recruiter-tools/tracking' },
  { id: 'reports', name: 'Generador de Reportes', description: 'Reportes de pipeline y cierre de vacantes', icon: BarChart3, gradient: 'from-amber-500/20 to-orange-500/10', iconColor: 'text-amber-400', borderHover: 'hover:border-amber-400/30', to: '/dashboard/recruiter-tools/reports' },
  { id: 'best-practices', name: 'Mejores Prácticas', description: 'Frameworks y estrategias comprobadas', icon: Award, gradient: 'from-rose-500/20 to-pink-500/10', iconColor: 'text-rose-400', borderHover: 'hover:border-rose-400/30', to: '/dashboard/recruiter-tools/best-practices' },
]

export default function RecruiterToolsDashboard() {
  const { canDo } = usePlan()

  if (!canDo('use_recruiter_tools')) {
    return <UpgradePrompt action="use_recruiter_tools" />
  }

  return (
    <div>
      {/* Hero Banner */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden mb-8"
        style={{ background: 'linear-gradient(135deg, #0F1B2E 0%, #1A2F4A 40%, #0C3B3A 70%, #1A2332 100%)' }}>
        {/* Particle dots */}
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        {/* Glow orbs */}
        <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.2), transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-56 h-56 rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.15), transparent 70%)' }} />
        <div className="absolute top-1/2 right-0 w-40 h-40 rounded-full blur-[80px]" style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.1), transparent 70%)' }} />

        <div className="relative flex flex-col lg:flex-row items-center gap-8 p-8 lg:p-10">
          {/* Left — Text */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-light to-accent flex items-center justify-center">
                <GraduationCap size={16} className="text-white" />
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Curso de IA Avanzado</span>
            </div>
            <h1 className="font-display font-extrabold text-white mb-1" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.1 }}>
              Recruiting{' '}
              <span className="relative inline-block">
                <span className="gradient-text">Lab</span>
                <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-primary-light to-accent rounded-full opacity-60" />
              </span>
            </h1>
            <p className="text-white/80 max-w-lg mb-5 text-sm leading-relaxed">
              Programa intensivo de Inteligencia Artificial aplicada al reclutamiento. Domina las herramientas, prompts y metodologías que transforman tu productividad.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}><Clock size={12} className="text-accent" /> 10 hrs</span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}><BookOpen size={12} className="text-primary-light" /> 6 módulos</span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}><Users size={12} className="text-gold" /> Intermedio-avanzado</span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-amber-300" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)' }}><Star size={12} /> Certificación (costo adicional)</span>
            </div>
          </div>

          {/* Right — Quick stats + progress */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-3">
            {/* Progress card */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Tu progreso</span>
                <span className="text-xs text-accent font-bold">0%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-gradient-to-r from-primary-light to-accent rounded-full" style={{ width: '0%' }} />
              </div>
              <p className="text-[10px] text-white/50">Completa los 6 módulos para obtener tu certificación (con costo adicional)</p>
            </div>
            {/* Stats mini cards */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: '14', label: 'Prompts\nlistos', color: 'text-primary-light' },
                { val: '11', label: 'Templates\noutreach', color: 'text-accent' },
                { val: '5', label: 'Guías\nsourcing', color: 'text-gold' },
                { val: '4', label: 'Formatos\nseguimiento', color: 'text-emerald-400' },
              ].map((s, i) => (
                <div key={i} className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className={`text-xl font-extrabold font-display ${s.color}`}>{s.val}</div>
                  <div className="text-[9px] text-white/50 leading-tight whitespace-pre-line mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Course Modules */}
      <div className="mb-10">
        <h2 className="font-display font-bold text-lg text-white mb-4">Módulos del programa</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((mod, i) => (
            <motion.div key={mod.number} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="glass rounded-xl p-4 flex items-start gap-3 group hover:border-primary-light/20 transition-all">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold gradient-text">{mod.number}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-0.5">{mod.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-1.5">{mod.desc}</p>
                <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={9} /> {mod.duration}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tools included */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-display font-bold text-lg text-white">Herramientas incluidas</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">Acceso inmediato</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool, i) => {
            const Icon = tool.icon
            return (
              <motion.div key={tool.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}>
                <Link to={tool.to} className={`block glass rounded-xl p-5 transition-all group ${tool.borderHover}`}>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center ${tool.iconColor} group-hover:scale-110 transition-transform mb-3`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-sm font-display font-bold text-white mb-1">{tool.name}</h3>
                  <p className="text-xs text-gray-400 mb-3">{tool.description}</p>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-light group-hover:gap-2 transition-all">
                    Explorar <ArrowRight size={12} />
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* What you'll learn */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        className="mt-10 glass rounded-xl p-6">
        <h2 className="font-display font-bold text-lg text-white mb-4">Al completar Recruiting Lab podrás</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Generar perfiles inteligentes desde cualquier JD usando IA',
            'Escribir boolean searches que encuentran talento pasivo en segundos',
            'Diseñar secuencias de outreach con tasa de respuesta >30%',
            'Evaluar candidatos con scorecards objetivos y basados en evidencia',
            'Crear reportes ejecutivos que cambian la conversación con el hiring manager',
            'Implementar un pipeline con SLA, métricas y trazabilidad completa',
            'Usar IA de forma ética, responsable y con gobierno de datos',
            'Reducir tu time-to-fill en un 40% con metodología + tecnología',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <CheckCircle size={14} className="text-accent flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-300">{item}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
