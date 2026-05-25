import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Briefcase, Users, Clock, TrendingUp, Target, ShieldCheck,
  AlertTriangle, Calendar, ChevronRight, ArrowRight, Settings,
  Link2, Globe, UserPlus, Mail, Building2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

/* ───── MOCK DATA (replaced by Supabase when available) ───── */

const MOCK_KPIS = {
  activeVacancies: 5,
  maxVacancies: 8,
  candidatesInProcess: 47,
  avgTimeToFill: 22,
  conversionRate: 18.4,
  bestSource: 'LinkedIn',
  slaCompliance: 87,
}

const MOCK_PIPELINE = [
  { stage: 'Sourced', count: 120, color: '#3b82f6' },
  { stage: 'Contactados', count: 78, color: '#06b6d4' },
  { stage: 'Screening', count: 52, color: '#8b5cf6' },
  { stage: 'Entrevista', count: 31, color: '#f59e0b' },
  { stage: 'Evaluacion', count: 18, color: '#f97316' },
  { stage: 'Oferta', count: 9, color: '#10b981' },
  { stage: 'Contratados', count: 6, color: '#22c55e' },
]

const MOCK_SOURCES = [
  { name: 'LinkedIn', hires: 42, quality: 4.2, color: '#0a66c2' },
  { name: 'Referidos', hires: 28, quality: 4.5, color: '#8b5cf6' },
  { name: 'OCC', hires: 18, quality: 3.4, color: '#f59e0b' },
  { name: 'Indeed', hires: 12, quality: 3.1, color: '#3b82f6' },
  { name: 'Portal propio', hires: 8, quality: 3.8, color: '#10b981' },
]

const MOCK_MONTHLY_TREND = [
  { month: 'Dic', hires: 4 },
  { month: 'Ene', hires: 6 },
  { month: 'Feb', hires: 3 },
  { month: 'Mar', hires: 8 },
  { month: 'Abr', hires: 5 },
  { month: 'May', hires: 7 },
]

const MOCK_VACANCIES = [
  {
    id: 1,
    title: 'Desarrollador Full Stack Sr.',
    priority: 'Alta',
    candidates: 12,
    stages: { sourced: 4, screening: 3, interview: 3, offer: 2 },
    daysOpen: 15,
    recruiter: 'Maria Lopez',
    slaOk: true,
  },
  {
    id: 2,
    title: 'Product Manager',
    priority: 'Media',
    candidates: 8,
    stages: { sourced: 3, screening: 2, interview: 2, offer: 1 },
    daysOpen: 28,
    recruiter: 'Carlos Ruiz',
    slaOk: false,
  },
  {
    id: 3,
    title: 'Director Comercial',
    priority: 'Critica',
    candidates: 5,
    stages: { sourced: 1, screening: 2, interview: 1, offer: 1 },
    daysOpen: 35,
    recruiter: 'Ana Torres',
    slaOk: false,
  },
  {
    id: 4,
    title: 'Analista de Datos',
    priority: 'Baja',
    candidates: 18,
    stages: { sourced: 8, screening: 5, interview: 3, offer: 2 },
    daysOpen: 10,
    recruiter: 'Maria Lopez',
    slaOk: true,
  },
  {
    id: 5,
    title: 'UX Designer Mid',
    priority: 'Alta',
    candidates: 6,
    stages: { sourced: 2, screening: 2, interview: 1, offer: 1 },
    daysOpen: 20,
    recruiter: 'Carlos Ruiz',
    slaOk: true,
  },
]

const MOCK_ALERTS = {
  overSLA: [
    { vacancy: 'Product Manager', days: 28, sla: 25 },
    { vacancy: 'Director Comercial', days: 35, sla: 30 },
  ],
  stuck: [
    { candidate: 'Roberto Mendez', vacancy: 'Director Comercial', stage: 'Screening', days: 12 },
    { candidate: 'Laura Vega', vacancy: 'Product Manager', stage: 'Entrevista', days: 8 },
  ],
  interviews: [
    { candidate: 'Sofia Ramirez', vacancy: 'Desarrollador Full Stack Sr.', date: '2026-05-26', time: '10:00' },
    { candidate: 'Diego Martinez', vacancy: 'UX Designer Mid', date: '2026-05-27', time: '14:30' },
    { candidate: 'Paola Herrera', vacancy: 'Analista de Datos', date: '2026-05-28', time: '11:00' },
  ],
}

const SOURCE_ICONS = {
  LinkedIn: Link2,
  Referidos: UserPlus,
  OCC: Globe,
  Indeed: Globe,
  'Portal propio': Building2,
}

const PRIORITY_STYLES = {
  Critica: 'bg-red-500/20 text-red-400',
  Alta: 'bg-orange-500/20 text-orange-400',
  Media: 'bg-amber-500/20 text-amber-400',
  Baja: 'bg-green-500/20 text-green-400',
}

/* ───── COMPONENT ───── */

export default function EnterpriseDashboard() {
  const { profile } = useAuth()
  const [kpis, setKpis] = useState(MOCK_KPIS)
  const [pipeline, setPipeline] = useState(MOCK_PIPELINE)
  const [sources, setSources] = useState(MOCK_SOURCES)
  const [trend, setTrend] = useState(MOCK_MONTHLY_TREND)
  const [vacancies, setVacancies] = useState(MOCK_VACANCIES)
  const [alerts, setAlerts] = useState(MOCK_ALERTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const orgId = profile?.organization_id

      // Try to load real vacancies
      if (orgId) {
        const { data: realVacancies } = await supabase
          .from('vacancies')
          .select('*, candidates(count)')
          .eq('organization_id', orgId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })

        if (realVacancies && realVacancies.length > 0) {
          // Use real data if available
          setKpis(prev => ({
            ...prev,
            activeVacancies: realVacancies.length,
          }))
        }
      }
    } catch (err) {
      // Fallback to mock data silently
    } finally {
      setLoading(false)
    }
  }

  const maxPipeline = Math.max(...pipeline.map(p => p.count))
  const maxSource = Math.max(...sources.map(s => s.hires))
  const maxTrend = Math.max(...trend.map(t => t.hires))

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
              <Building2 size={20} className="text-primary-light" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">Enterprise Dashboard</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Vista ejecutiva de tu operacion de reclutamiento
          </p>
        </div>
        <Link
          to="/dashboard/enterprise/config"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-all text-sm font-medium"
        >
          <Settings size={16} />
          Configuracion estrategica
        </Link>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          {
            label: 'Vacantes activas',
            value: `${kpis.activeVacancies}/${kpis.maxVacancies}`,
            icon: Briefcase,
            color: 'text-blue-400',
            bg: 'from-blue-500/20 to-blue-500/5',
          },
          {
            label: 'Candidatos en proceso',
            value: kpis.candidatesInProcess,
            icon: Users,
            color: 'text-cyan-400',
            bg: 'from-cyan-500/20 to-cyan-500/5',
          },
          {
            label: 'Time-to-fill prom.',
            value: `${kpis.avgTimeToFill}d`,
            icon: Clock,
            color: 'text-amber-400',
            bg: 'from-amber-500/20 to-amber-500/5',
          },
          {
            label: 'Conversion',
            value: `${kpis.conversionRate}%`,
            icon: TrendingUp,
            color: 'text-green-400',
            bg: 'from-green-500/20 to-green-500/5',
          },
          {
            label: 'Mejor fuente',
            value: kpis.bestSource,
            icon: Target,
            color: 'text-violet-400',
            bg: 'from-violet-500/20 to-violet-500/5',
          },
          {
            label: 'SLA compliance',
            value: `${kpis.slaCompliance}%`,
            icon: ShieldCheck,
            color: kpis.slaCompliance >= 80 ? 'text-emerald-400' : 'text-red-400',
            bg: kpis.slaCompliance >= 80 ? 'from-emerald-500/20 to-emerald-500/5' : 'from-red-500/20 to-red-500/5',
          },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-4"
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${kpi.bg} flex items-center justify-center ${kpi.color} mb-3`}>
                <Icon size={16} />
              </div>
              <div className="text-xl font-bold text-white">{kpi.value}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{kpi.label}</div>
            </motion.div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Pipeline Velocity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Velocidad de pipeline</h3>
          <div className="space-y-3">
            {pipeline.map((stage) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-400 w-20 text-right flex-shrink-0">{stage.stage}</span>
                <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div
                    className="h-full rounded-md transition-all duration-700 flex items-center justify-end pr-2"
                    style={{
                      width: `${(stage.count / maxPipeline) * 100}%`,
                      background: stage.color,
                      minWidth: '24px',
                    }}
                  >
                    <span className="text-[10px] font-bold text-white">{stage.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Source Effectiveness */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Efectividad por fuente</h3>
          <div className="space-y-3">
            {sources.map((source) => {
              const SIcon = SOURCE_ICONS[source.name] || Globe
              return (
                <div key={source.name} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-24 flex-shrink-0">
                    <SIcon size={12} className="text-gray-500" />
                    <span className="text-[11px] text-gray-400 truncate">{source.name}</span>
                  </div>
                  <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div
                      className="h-full rounded-md transition-all duration-700 flex items-center justify-end pr-2"
                      style={{
                        width: `${(source.hires / maxSource) * 100}%`,
                        background: source.color,
                        minWidth: '24px',
                      }}
                    >
                      <span className="text-[10px] font-bold text-white">{source.hires}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 w-8 text-right flex-shrink-0">{source.quality}</span>
                </div>
              )
            })}
            <div className="flex items-center gap-2 text-[10px] text-gray-600 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span>Contrataciones</span>
              <span className="ml-auto">Calidad (1-5)</span>
            </div>
          </div>
        </motion.div>

        {/* Monthly Trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Tendencia de contratacion (6 meses)</h3>
          <div className="flex items-end gap-3 h-32">
            {trend.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-white">{m.hires}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary to-primary-light transition-all duration-500"
                  style={{ height: `${(m.hires / maxTrend) * 100}%`, minHeight: '8px' }}
                />
                <span className="text-[10px] text-gray-500">{m.month}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Active Vacancies Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass rounded-xl p-5 mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Vacantes activas</h3>
          <Link to="/dashboard/vacancies" className="text-xs text-primary-light hover:underline flex items-center gap-1">
            Ver todas <ChevronRight size={12} />
          </Link>
        </div>
        {vacancies.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No hay vacantes activas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="pb-3 pr-4 font-medium">Vacante</th>
                  <th className="pb-3 pr-4 font-medium">Prioridad</th>
                  <th className="pb-3 pr-4 font-medium text-center">Candidatos</th>
                  <th className="pb-3 pr-4 font-medium">Pipeline</th>
                  <th className="pb-3 pr-4 font-medium text-center">Dias</th>
                  <th className="pb-3 pr-4 font-medium">Recruiter</th>
                  <th className="pb-3 font-medium text-center">SLA</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {vacancies.map((v) => {
                  const stageValues = Object.values(v.stages)
                  const stageMax = Math.max(...stageValues, 1)
                  const stageColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981']
                  return (
                    <tr key={v.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-4">
                        <span className="text-white font-medium">{v.title}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[v.priority]}`}>
                          {v.priority}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-center text-gray-300">{v.candidates}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-0.5 h-3">
                          {Object.entries(v.stages).map(([stage, count], si) => (
                            <div
                              key={stage}
                              className="h-full rounded-sm"
                              style={{
                                width: `${(count / stageMax) * 40}px`,
                                minWidth: '4px',
                                background: stageColors[si],
                                opacity: 0.8,
                              }}
                              title={`${stage}: ${count}`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className={v.daysOpen > 25 ? 'text-red-400 font-semibold' : 'text-gray-300'}>
                          {v.daysOpen}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-400">{v.recruiter}</td>
                      <td className="py-3 text-center">
                        {v.slaOk ? (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Dentro de SLA" />
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Fuera de SLA" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Over SLA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-white">Vacantes fuera de SLA</h3>
          </div>
          {alerts.overSLA.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">Todo dentro de SLA</p>
          ) : (
            <div className="space-y-3">
              {alerts.overSLA.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div>
                    <p className="text-sm text-white font-medium">{a.vacancy}</p>
                    <p className="text-[11px] text-gray-500">{a.days} dias (SLA: {a.sla}d)</p>
                  </div>
                  <span className="text-xs text-red-400 font-semibold">+{a.days - a.sla}d</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Stuck Candidates */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Candidatos estancados</h3>
          </div>
          {alerts.stuck.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">Sin candidatos estancados</p>
          ) : (
            <div className="space-y-3">
              {alerts.stuck.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <div>
                    <p className="text-sm text-white font-medium">{s.candidate}</p>
                    <p className="text-[11px] text-gray-500">{s.vacancy} - {s.stage}</p>
                  </div>
                  <span className="text-xs text-amber-400 font-semibold">{s.days}d</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Upcoming Interviews */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Proximas entrevistas</h3>
          </div>
          {alerts.interviews.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">Sin entrevistas programadas</p>
          ) : (
            <div className="space-y-3">
              {alerts.interviews.map((int, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <div>
                    <p className="text-sm text-white font-medium">{int.candidate}</p>
                    <p className="text-[11px] text-gray-500">{int.vacancy}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-400 font-semibold">{int.date}</p>
                    <p className="text-[10px] text-gray-500">{int.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
