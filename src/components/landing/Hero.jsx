import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FileText, Search, BarChart3, Users, CheckCircle, ArrowRight, ChevronLeft, ChevronRight, Briefcase, Target, Shield, Send } from 'lucide-react'

/* ── Carousel steps: simulated hiring process ────────────────── */
const steps = [
  {
    id: 1,
    label: 'Intake',
    title: 'Define tu vacante con inteligencia',
    subtitle: 'La IA convierte una descripción de puesto en un perfil inteligente con competencias, skills y scorecard.',
    icon: FileText,
    color: '#2563EB',
    colorLight: '#93C5FD',
    demo: {
      type: 'intake',
      vacancy: 'Ejecutivo Comercial Técnico Agro',
      fields: [
        { label: 'Competencias detectadas', items: ['Venta consultiva', 'Gestión de cuentas clave', 'Negociación B2B'] },
        { label: 'Scorecard sugerido', items: [
          { name: 'Experiencia agro', weight: '25%' },
          { name: 'Venta técnica B2B', weight: '25%' },
          { name: 'Red de distribuidores', weight: '20%' },
          { name: 'Resiliencia/campo', weight: '15%' },
          { name: 'Comunicación', weight: '15%' },
        ]},
      ],
    },
  },
  {
    id: 2,
    label: 'Sourcing',
    title: 'Encuentra candidatos en segundos',
    subtitle: 'Busca en LinkedIn, importa CSVs o usa el banco de talento. Cada candidato con fuente, tags y consentimiento.',
    icon: Search,
    color: '#8B5CF6',
    colorLight: '#C4B5FD',
    demo: {
      type: 'sourcing',
      candidates: [
        { name: 'Ricardo Vega M.', title: 'Gerente Ventas Agro', company: 'Syngenta', source: 'LinkedIn', score: null },
        { name: 'Laura Campos I.', title: 'Ing. Agrónoma', company: 'Bayer', source: 'Referido', score: null },
        { name: 'Martín Delgado R.', title: 'Ejecutivo B2B Sr.', company: 'Dist. Nacional', source: 'LinkedIn', score: null },
      ],
    },
  },
  {
    id: 3,
    label: 'Screening',
    title: 'Evalúa con criterios, no con intuición',
    subtitle: 'Match score por criterio, fortalezas, brechas y preguntas pendientes. La IA organiza, el humano decide.',
    icon: BarChart3,
    color: '#0D9488',
    colorLight: '#5EEAD4',
    demo: {
      type: 'screening',
      candidates: [
        { name: 'Ricardo Vega', score: 87, rec: 'Avanzar', strengths: ['Experiencia agro profunda', 'Red de distribuidores'], color: '#22C55E' },
        { name: 'Laura Campos', score: 68, rec: 'Evaluar más', strengths: ['Conocimiento técnico', 'Disposición campo'], color: '#F59E0B' },
        { name: 'Martín Delgado', score: 58, rec: 'Evaluar más', strengths: ['Venta B2B senior', 'Comunicación'], color: '#EF4444' },
      ],
    },
  },
  {
    id: 4,
    label: 'Pipeline',
    title: 'Gestiona el proceso end-to-end',
    subtitle: 'Pipeline Kanban con drag & drop, SLA por etapa, aging de candidatos y tracking de cada movimiento.',
    icon: Users,
    color: '#D97706',
    colorLight: '#FCD34D',
    demo: {
      type: 'pipeline',
      stages: [
        { name: 'Sourced', count: 3, color: '#6B7280' },
        { name: 'Contactado', count: 1, color: '#3B82F6' },
        { name: 'Screening', count: 1, color: '#8B5CF6' },
        { name: 'Entrevista', count: 1, color: '#D97706' },
        { name: 'Shortlist', count: 1, color: '#0D9488' },
        { name: 'Oferta', count: 0, color: '#22C55E' },
      ],
    },
  },
  {
    id: 5,
    label: 'Reporte',
    title: 'Decide con evidencia, no con impresiones',
    subtitle: 'Reporte ejecutivo con shortlist, match scores, fortalezas, riesgos y próximos pasos. Listo para el hiring manager.',
    icon: Target,
    color: '#EC4899',
    colorLight: '#F9A8D4',
    demo: {
      type: 'report',
      shortlist: [
        { name: 'Ricardo Vega M.', score: 87, verdict: 'Avanzar a entrevista con HM' },
        { name: 'Patricia Navarro L.', score: 82, verdict: 'Validar transición de sector' },
      ],
      metrics: { evaluated: 6, shortlisted: 2, avgScore: 84, days: 8 },
    },
  },
]

/* ── Animated demo panels per step ───────────────────────────── */
function DemoPanel({ step }) {
  const { demo } = step

  if (demo.type === 'intake') {
    return (
      <div className="space-y-3">
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={14} style={{ color: step.colorLight }} />
            <span className="text-xs text-gray-400">Vacante detectada</span>
          </div>
          <p className="text-sm font-semibold text-white">{demo.vacancy}</p>
        </div>
        {demo.fields.map((field, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.2 }} className="glass rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{field.label}</p>
            {field.items && !field.items[0]?.weight && (
              <div className="flex flex-wrap gap-1.5">
                {field.items.map((item, j) => (
                  <motion.span key={j} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + j * 0.1 }}
                    className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${step.color}15`, color: step.colorLight }}>{item}</motion.span>
                ))}
              </div>
            )}
            {field.items && field.items[0]?.weight && (
              <div className="space-y-1.5">
                {field.items.map((item, j) => (
                  <motion.div key={j} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ delay: 0.4 + j * 0.1 }} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-300 w-28 truncate">{item.name}</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: item.weight }} transition={{ delay: 0.6 + j * 0.12, duration: 0.6 }}
                        className="h-full rounded-full" style={{ background: step.color }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-8 text-right">{item.weight}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    )
  }

  if (demo.type === 'sourcing') {
    return (
      <div className="space-y-2">
        {demo.candidates.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.15 }}
            className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${step.color}20`, color: step.colorLight }}>
              {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{c.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{c.title} · {c.company}</p>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: `${step.color}15`, color: step.colorLight }}>{c.source}</span>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-center pt-2">
          <span className="text-[10px] text-gray-500">3 perfiles encontrados en 4 segundos</span>
        </motion.div>
      </div>
    )
  }

  if (demo.type === 'screening') {
    return (
      <div className="space-y-2.5">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-1" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.15)' }}>
          <Shield size={12} className="text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-amber-300">Análisis asistido por IA — Requiere validación humana</span>
        </motion.div>
        {demo.candidates.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.2 }}
            className="glass rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">{c.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: c.color }}>{c.score}%</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${c.color}15`, color: c.color }}>{c.rec}</span>
              </div>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
              <motion.div initial={{ width: 0 }} animate={{ width: `${c.score}%` }} transition={{ delay: 0.5 + i * 0.2, duration: 0.8 }}
                className="h-full rounded-full" style={{ background: c.color }} />
            </div>
            <div className="flex flex-wrap gap-1">
              {c.strengths.map((s, j) => (
                <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{s}</span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    )
  }

  if (demo.type === 'pipeline') {
    return (
      <div className="space-y-3">
        <div className="flex gap-1.5 overflow-hidden">
          {demo.stages.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
              className="flex-1 min-w-0">
              <div className="text-center mb-1.5">
                <div className="text-lg font-bold text-white">{s.count}</div>
                <div className="text-[8px] text-gray-500 truncate">{s.name}</div>
              </div>
              <div className="h-1 rounded-full" style={{ background: `${s.color}30` }}>
                <motion.div initial={{ width: 0 }} animate={{ width: s.count > 0 ? '100%' : '0%' }} transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                  className="h-full rounded-full" style={{ background: s.color }} />
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="glass rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Candidato movido:</span>
            <span className="text-white font-medium">Ricardo Vega → Shortlist</span>
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="text-gray-400">SLA restante:</span>
            <span className="text-green-400 font-medium">2 días</span>
          </div>
        </motion.div>
      </div>
    )
  }

  if (demo.type === 'report') {
    return (
      <div className="space-y-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
          <span className="text-[9px] font-bold uppercase tracking-wider text-red-400">Confidencial</span>
        </motion.div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { v: demo.metrics.evaluated, l: 'Evaluados' },
            { v: demo.metrics.shortlisted, l: 'Shortlist' },
            { v: `${demo.metrics.avgScore}%`, l: 'Score avg' },
            { v: `${demo.metrics.days}d`, l: 'Tiempo' },
          ].map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.1 }}
              className="text-center glass rounded-lg p-2">
              <div className="text-sm font-bold" style={{ color: step.colorLight }}>{m.v}</div>
              <div className="text-[8px] text-gray-500">{m.l}</div>
            </motion.div>
          ))}
        </div>
        {demo.shortlist.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.15 }}
            className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center">
              <CheckCircle size={14} className="text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white">{c.name} <span className="text-green-400 font-bold ml-1">{c.score}%</span></p>
              <p className="text-[10px] text-gray-500">{c.verdict}</p>
            </div>
          </motion.div>
        ))}
      </div>
    )
  }

  return null
}

/* ── HERO COMPONENT ──────────────────────────────────────────── */
export default function Hero() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  // Auto-advance every 5s
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setActive(prev => (prev + 1) % steps.length), 5000)
    return () => clearInterval(timer)
  }, [paused])

  const step = steps[active]

  return (
    <section id="inicio" className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/15 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-[150px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full pt-28 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* LEFT: Text content */}
          <div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-accent opacity-75" /><span className="relative rounded-full h-2 w-2 bg-accent" /></span>
              <span className="text-sm text-gray-300">Talent Intelligence Marketplace</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
              className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.1] mb-6 tracking-tight">
              Conectamos{' '}
              <span className="gradient-text">talento, conocimiento</span>{' '}
              y tecnología
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
              className="text-lg text-gray-400 mb-8 leading-relaxed max-w-lg">
              La plataforma que conecta empresas, reclutadores y candidatos mediante IA, metodología, datos y criterio humano.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45 }}
              className="flex flex-wrap items-center gap-4 mb-10">
              <a href="#precios" className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all">
                Ver planes <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <Link to="/login" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl glass text-white font-semibold text-sm hover:bg-white/10 transition-all">
                Acceder a la plataforma
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex gap-8">
              {[
                { v: '5', l: 'Líneas de producto' },
                { v: '21', l: 'Planes' },
                { v: '500+', l: 'Profesionales' },
              ].map(s => (
                <div key={s.l}>
                  <div className="font-display font-extrabold text-2xl gradient-text">{s.v}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.l}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* RIGHT: Animated demo carousel */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>

            {/* Step indicators */}
            <div className="flex items-center gap-1 mb-4">
              {steps.map((s, i) => (
                <button key={s.id} onClick={() => setActive(i)} className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-medium"
                  style={{ background: i === active ? `${s.color}15` : 'transparent', color: i === active ? s.colorLight : '#6B7280', border: i === active ? `1px solid ${s.color}30` : '1px solid transparent' }}>
                  <s.icon size={12} />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Demo card */}
            <div className="card-premium rounded-2xl min-h-[420px]" style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(20px)' }}>
              <div className="card-shimmer" />

              {/* Header */}
              <div className="relative px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${step.color}, ${step.color}99)`, boxShadow: `0 4px 16px ${step.color}30` }}>
                    <step.icon size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: step.colorLight }}>Paso {step.id}</span>
                      <span className="text-[10px] text-gray-600">/ {steps.length}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{step.title}</h3>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">{step.subtitle}</p>
              </div>

              {/* Animated demo content */}
              <div className="relative px-6 py-5">
                <AnimatePresence mode="wait">
                  <motion.div key={step.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
                    <DemoPanel step={step} />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Progress bar */}
              <div className="px-6 pb-4">
                <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    key={`progress-${active}`}
                    initial={{ width: '0%' }}
                    animate={{ width: paused ? undefined : '100%' }}
                    transition={{ duration: 5, ease: 'linear' }}
                    className="h-full rounded-full"
                    style={{ background: step.color }}
                  />
                </div>
              </div>

              {/* Nav buttons */}
              <div className="absolute top-1/2 -left-4 -translate-y-1/2">
                <button onClick={() => setActive(prev => (prev - 1 + steps.length) % steps.length)}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all shadow-lg">
                  <ChevronLeft size={16} />
                </button>
              </div>
              <div className="absolute top-1/2 -right-4 -translate-y-1/2">
                <button onClick={() => setActive(prev => (prev + 1) % steps.length)}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all shadow-lg">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Floating accent */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full blur-[60px] pointer-events-none" style={{ background: `radial-gradient(circle, ${step.color}15, transparent 70%)` }} />
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0B1120] to-transparent" />
    </section>
  )
}
