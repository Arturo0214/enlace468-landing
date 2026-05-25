import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Users, Clock, AlertTriangle, Sparkles, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePlan } from '../../lib/planContext'
import PlanBadge from '../ui/PlanBadge'

/* ── KPI card definitions ─────────────────────────────────────── */
const kpiCards = [
  { key: 'activeVacancies', label: 'Vacantes activas', icon: Briefcase, gradient: 'from-primary/20 to-primary/5', iconColor: 'text-primary' },
  { key: 'pipelineCandidates', label: 'Candidatos en pipeline', icon: Users, gradient: 'from-accent/20 to-accent/5', iconColor: 'text-accent' },
  { key: 'avgTimeToShortlist', label: 'Tiempo a shortlist (d)', icon: Clock, gradient: 'from-gold/20 to-gold/5', iconColor: 'text-gold' },
  { key: 'redFlags', label: 'Focos rojos', icon: AlertTriangle, gradient: 'from-red-500/20 to-red-500/5', iconColor: 'text-red-400' },
]

/* ── Pipeline stage labels & colours ──────────────────────────── */
const stageConfig = [
  { key: 'sourced', label: 'Sourced', color: 'bg-gray-500' },
  { key: 'screening', label: 'Screening', color: 'bg-blue-500' },
  { key: 'interview', label: 'Entrevista', color: 'bg-amber-500' },
  { key: 'shortlisted', label: 'Shortlist', color: 'bg-purple-500' },
  { key: 'offer', label: 'Oferta', color: 'bg-cyan-500' },
  { key: 'hired', label: 'Contratado', color: 'bg-green-500' },
]

/* ── helpers ──────────────────────────────────────────────────── */
function daysBetween(a, b) {
  return Math.round(Math.abs(new Date(b) - new Date(a)) / 86400000)
}

export default function DashboardHome() {
  const { profile } = useAuth()
  const { currentPlan } = usePlan()

  const [kpis, setKpis] = useState({ activeVacancies: 0, pipelineCandidates: 0, avgTimeToShortlist: 0, redFlags: 0 })
  const [funnelData, setFunnelData] = useState([])
  const [vacancies, setVacancies] = useState([])
  const [agingAlerts, setAgingAlerts] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadDashboard()
  }, [profile])

  async function loadDashboard() {
    try {
      const orgId = profile.organization_id

      /* Parallel fetches */
      const [vacRes, candCountRes, pipeRes, actRes] = await Promise.all([
        supabase.from('vacancies').select('id, title, status, priority, target_date, created_at').eq('organization_id', orgId),
        supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('vacancy_candidates').select('stage, created_at, updated_at, vacancy_id, vacancies!inner(organization_id, title)').eq('vacancies.organization_id', orgId),
        supabase.from('activity_log').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(10),
      ])

      const allVacancies = vacRes.data || []
      const pipelineRows = pipeRes.data || []

      /* KPI: active vacancies */
      const openVacs = allVacancies.filter(v => v.status === 'open')
      const activeVacancies = openVacs.length

      /* KPI: candidates currently in pipeline (not hired/rejected) */
      const pipelineCandidates = pipelineRows.filter(r => !['hired', 'rejected'].includes(r.stage)).length

      /* KPI: avg time to shortlist */
      const shortlisted = pipelineRows.filter(r => r.stage === 'shortlisted' && r.created_at && r.updated_at)
      const avgTimeToShortlist = shortlisted.length > 0
        ? Math.round(shortlisted.reduce((sum, r) => sum + daysBetween(r.created_at, r.updated_at), 0) / shortlisted.length)
        : 0

      /* KPI: red flags — vacancies open > 30 days or urgent priority without candidates */
      const now = new Date()
      const vacancyIds = new Set(pipelineRows.map(r => r.vacancy_id))
      const redFlags = openVacs.filter(v => {
        const age = daysBetween(v.created_at, now)
        const noCandidates = !vacancyIds.has(v.id)
        return age > 30 || (v.priority === 'urgent' && noCandidates)
      }).length

      setKpis({ activeVacancies, pipelineCandidates, avgTimeToShortlist, redFlags })

      /* Funnel data */
      const stageCounts = {}
      stageConfig.forEach(s => { stageCounts[s.key] = 0 })
      pipelineRows.forEach(r => { if (stageCounts[r.stage] !== undefined) stageCounts[r.stage]++ })
      setFunnelData(stageConfig.map(s => ({ ...s, count: stageCounts[s.key] })))

      /* Active vacancies table (open only, up to 10) */
      const tableVacs = openVacs.slice(0, 10).map(v => {
        const candidates = pipelineRows.filter(r => r.vacancy_id === v.id)
        const age = daysBetween(v.created_at, now)
        return { ...v, candidateCount: candidates.length, age }
      })
      setVacancies(tableVacs)

      /* Aging alerts: open vacancies older than 20 days */
      const alerts = openVacs
        .map(v => ({ ...v, age: daysBetween(v.created_at, now) }))
        .filter(v => v.age > 20)
        .sort((a, b) => b.age - a.age)
        .slice(0, 5)
      setAgingAlerts(alerts)

      setRecentActivity(actRes.data || [])
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const maxFunnel = Math.max(...funnelData.map(s => s.count), 1)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold text-white">
            Hola, {profile?.full_name?.split(' ')[0]}
          </h1>
          <PlanBadge />
        </div>
        <p className="text-gray-400 mt-1">Resumen de tu actividad de reclutamiento</p>
      </div>

      {!currentPlan && (
        <a
          href="/#precios"
          className="flex items-center gap-3 mb-6 px-5 py-3 rounded-xl transition-all hover:scale-[1.01]"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(6,182,212,0.1))',
            border: '1px solid rgba(99,102,241,0.15)',
          }}
        >
          <Sparkles size={18} className="text-indigo-400 flex-shrink-0" />
          <span className="text-sm text-gray-300">
            Activa un plan para desbloquear todas las funciones
          </span>
        </a>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map(({ key, label, icon: Icon, gradient, iconColor }, idx) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass rounded-xl p-5 hover:scale-[1.02] transition-transform"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${iconColor}`}>
                <Icon size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {loading ? '-' : kpis[key]}
            </div>
            <div className="text-sm text-gray-400 mt-1">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Pipeline Funnel ───────────────────────────────────── */}
      <div className="glass rounded-xl mb-8">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-display font-semibold text-white">Pipeline de candidatos</h2>
        </div>
        <div className="p-5 space-y-3">
          {funnelData.length === 0 && !loading && (
            <p className="text-gray-500 text-sm text-center py-4">Sin datos de pipeline aun.</p>
          )}
          {funnelData.map((stage) => (
            <div key={stage.key} className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-24 text-right flex-shrink-0">{stage.label}</span>
              <div className="flex-1 h-7 bg-white/5 rounded-lg overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(stage.count / maxFunnel) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full ${stage.color} rounded-lg flex items-center justify-end pr-2`}
                >
                  {stage.count > 0 && (
                    <span className="text-xs font-medium text-white">{stage.count}</span>
                  )}
                </motion.div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* ── Active Vacancies Table ──────────────────────────── */}
        <div className="lg:col-span-2 glass rounded-xl">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="font-display font-semibold text-white">Vacantes activas</h2>
          </div>
          <div className="overflow-x-auto">
            {vacancies.length === 0 && !loading ? (
              <p className="text-gray-500 text-sm text-center py-8">
                No hay vacantes activas. <Link to="/dashboard/vacancies/new" className="text-primary hover:underline">Crea tu primera vacante</Link>
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">Vacante</th>
                    <th className="px-5 py-3">Prioridad</th>
                    <th className="px-5 py-3 text-center">Candidatos</th>
                    <th className="px-5 py-3 text-center">Dias</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {vacancies.map(v => (
                    <tr key={v.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-white font-medium truncate max-w-[200px]">{v.title}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          v.priority === 'urgent' ? 'bg-red-500/20 text-red-300' :
                          v.priority === 'high' ? 'bg-amber-500/20 text-amber-300' :
                          v.priority === 'medium' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>{v.priority === 'urgent' ? 'Urgente' : v.priority === 'high' ? 'Alta' : v.priority === 'medium' ? 'Media' : 'Baja'}</span>
                      </td>
                      <td className="px-5 py-3 text-center text-gray-300">{v.candidateCount}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={v.age > 30 ? 'text-red-400 font-medium' : 'text-gray-300'}>{v.age}</span>
                      </td>
                      <td className="px-5 py-3">
                        <Link to={`/dashboard/vacancies/${v.id}`} className="text-primary hover:text-primary-light">
                          <ExternalLink size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Aging Alerts ────────────────────────────────────── */}
        <div className="glass rounded-xl">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="font-display font-semibold text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400" /> Alertas de envejecimiento
            </h2>
          </div>
          <div className="p-5">
            {agingAlerts.length === 0 && !loading ? (
              <p className="text-gray-500 text-sm text-center py-4">Sin alertas. Todo al dia.</p>
            ) : (
              <div className="space-y-3">
                {agingAlerts.map(v => (
                  <Link
                    key={v.id}
                    to={`/dashboard/vacancies/${v.id}`}
                    className="flex items-start gap-3 text-sm hover:bg-white/[0.03] rounded-lg p-2 -mx-2 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${v.age > 30 ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <div>
                      <div className="text-gray-200 font-medium truncate max-w-[180px]">{v.title}</div>
                      <div className="text-gray-500 text-xs">{v.age} dias abierta</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          to="/dashboard/vacancies/new"
          className="flex items-center gap-4 glass rounded-xl p-5 hover:border-primary/30 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary group-hover:from-primary group-hover:to-primary-light group-hover:text-white transition-all">
            <Briefcase size={24} />
          </div>
          <div>
            <div className="font-semibold text-white">Nueva vacante</div>
            <div className="text-sm text-gray-400">Crear y publicar una nueva posicion</div>
          </div>
        </Link>

        <Link
          to="/dashboard/candidates"
          className="flex items-center gap-4 glass rounded-xl p-5 hover:border-accent/30 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center text-accent group-hover:from-accent group-hover:to-accent-light group-hover:text-white transition-all">
            <Users size={24} />
          </div>
          <div>
            <div className="font-semibold text-white">Banco de candidatos</div>
            <div className="text-sm text-gray-400">Explorar y gestionar candidatos</div>
          </div>
        </Link>
      </div>

      {/* ── Recent Activity ───────────────────────────────────── */}
      <div className="glass rounded-xl">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-display font-semibold text-white">Actividad reciente</h2>
        </div>
        <div className="p-5">
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No hay actividad reciente. Crea tu primera vacante para comenzar.
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map(item => (
                <div key={item.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-200 font-medium">{item.action}</span>
                    <span className="text-gray-500 ml-2">
                      {new Date(item.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
