import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Users, Clock, AlertTriangle, Sparkles, ExternalLink, Package, Zap, GraduationCap, Star, Building2, UserCircle, ArrowRight, TrendingUp, Shield, Target, ChevronRight, CheckCircle } from 'lucide-react'
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

      {/* ══════════════════════════════════════════════════════════
          HERO — PREMIUM EDITORIAL BANNER
          ══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.6 }}
        className="relative mb-10 rounded-3xl overflow-hidden"
      >
        {/* Multi-layer background */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0c1929 0%, #122a4a 35%, #0a3d3a 65%, #0f2027 100%)' }} />
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] -mr-40 -mt-40" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.15), transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[100px] -ml-32 -mb-32" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.1), transparent 70%)' }} />
        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative px-8 sm:px-12 py-12 sm:py-16 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 max-w-2xl">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style={{ background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.2)' }}>
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-accent" /></span>
              <span className="text-xs font-semibold tracking-wider uppercase text-accent/90">Talent Intelligence Marketplace</span>
            </motion.div>

            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[2.75rem] text-white mb-5 leading-[1.15] tracking-tight">
              Cada vacante sin sistema{' '}
              <span className="relative inline-block">
                <span className="relative z-10 gradient-text">te cuesta talento.</span>
                <span className="absolute bottom-0 left-0 right-0 h-3 bg-accent/10 rounded-sm -z-0" />
              </span>
            </motion.h2>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-gray-300/90 text-base sm:text-lg mb-8 leading-relaxed max-w-xl">
              Mientras decides, tu competencia ya está contactando a tus mejores candidatos. Enlace 468 conecta <span className="text-white font-medium">metodología + IA + criterio humano</span> para que reclutes con inteligencia, no con suerte.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="flex flex-wrap items-center gap-4">
              <a href="/#precios" className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-accent to-teal-400 text-white font-bold text-sm shadow-xl shadow-accent/20 hover:shadow-accent/40 transition-all hover:-translate-y-0.5">
                Ver planes y precios
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <Link to="/dashboard/talent-desk" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm text-white/80 hover:text-white transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Solicitar Talent Desk
              </Link>
            </motion.div>
          </div>

          {/* Right side — floating stats */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.7 }} className="hidden lg:grid grid-cols-2 gap-3 w-[280px] flex-shrink-0">
            {[
              { val: '87%', label: 'Match score\npromedio', color: 'text-accent' },
              { val: '5d', label: 'Time to\nshortlist', color: 'text-blue-400' },
              { val: '3x', label: 'Más rápido\nque agencia', color: 'text-purple-400' },
              { val: '94%', label: 'Satisfacción\ncliente', color: 'text-amber-400' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 + i * 0.1 }}
                className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
                <div className={`text-2xl font-extrabold font-display ${s.color} stat-glow`}>{s.val}</div>
                <div className="text-[10px] text-gray-500 mt-1 leading-tight whitespace-pre-line">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════
          PRODUCT SHOWCASE — PREMIUM CARDS
          ══════════════════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="mb-6">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-white">Soluciones que resuelven tu problema <span className="gradient-text">hoy</span></h2>
        </div>

        {/* ── ANCHOR: Talent Desk ───────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Link to="/dashboard/talent-desk" className="card-premium block mb-6 rounded-3xl" style={{ background: 'linear-gradient(160deg, rgba(139,92,246,0.12) 0%, rgba(88,28,135,0.08) 40%, rgba(15,23,42,0.95) 100%)' }}>
            <div className="card-shimmer" />
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-[100px] -mr-20 -mt-20" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)' }} />
            <div className="relative p-8 sm:p-10 flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', boxShadow: '0 8px 32px rgba(139,92,246,0.3)' }}>
                    <Package size={26} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-extrabold text-xl text-white">Talent Desk</h3>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(168,85,247,0.2))', color: '#C4B5FD' }}>Producto ancla</span>
                    </div>
                    <p className="text-purple-300/60 text-xs">El camino más rápido a candidatos listos</p>
                  </div>
                </div>
                <p className="text-white/90 text-lg sm:text-xl font-medium leading-snug mb-2 max-w-lg">"Tu vacante lleva semanas abierta. <span className="text-purple-300">Nosotros te entregamos candidatos listos en días."</span></p>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-lg">No implementas nada. No aprendes un software. Nos dices qué necesitas y recibes candidatos mapeados, filtrados, rankeados y con mensajes de contacto sugeridos.</p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6">
                  {['10-15 candidatos mapeados', 'Match score por criterio', 'Mensajes de contacto listos', 'Reporte ejecutivo'].map(f => (
                    <span key={f} className="flex items-center gap-1.5 text-xs text-gray-300"><CheckCircle size={12} className="text-purple-400 flex-shrink-0" />{f}</span>
                  ))}
                </div>
                <div className="flex items-center gap-5">
                  <div>
                    <span className="text-3xl font-extrabold text-white font-display">$4,900</span>
                    <span className="text-gray-400 text-sm ml-1">MXN / vacante</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-500/20 text-purple-200 text-sm font-semibold hover:bg-purple-500/30 transition-colors">
                    Solicitar ahora <ArrowRight size={14} />
                  </span>
                </div>
              </div>
              {/* Right visual */}
              <div className="hidden md:flex flex-col items-center justify-center w-48 flex-shrink-0">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full flex items-center justify-center" style={{ background: 'conic-gradient(from 0deg, #8B5CF6 0%, #6D28D9 30%, rgba(139,92,246,0.1) 30%)' }}>
                    <div className="w-24 h-24 rounded-full bg-[#0c1220] flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-extrabold text-purple-300 stat-glow">87%</div>
                        <div className="text-[9px] text-gray-500 uppercase tracking-wider">Match avg</div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mt-3 text-center">Resultados reales, no promesas</p>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* ── POWER CARDS: Enterprise + Recruiter Pro ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Enterprise */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Link to="/dashboard/enterprise" className="card-premium block h-full rounded-2xl" style={{ background: 'linear-gradient(160deg, rgba(37,99,235,0.1) 0%, rgba(15,23,42,0.95) 60%)' }}>
              <div className="card-shimmer" />
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] -mr-16 -mt-16" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.1), transparent 70%)' }} />
              <div className="relative p-7 h-full flex flex-col">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563EB, #1E40AF)', boxShadow: '0 6px 24px rgba(37,99,235,0.25)' }}>
                    <Building2 size={22} className="text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-blue-300" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.15)' }}>
                    <Shield size={10} /> Enterprise
                  </div>
                </div>
                <h3 className="font-display font-extrabold text-lg text-white mb-2">Tu operación de talento no puede seguir sin sistema</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-5 flex-1">Cada vacante sin SLA, cada candidato sin seguimiento, cada reporte que no se hace... <span className="text-blue-300">es dinero y talento que pierdes</span>. Enterprise integra screening, pipeline, scorecards y reportes en un solo flujo.</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {['Pipeline Kanban', 'Scorecards', 'Reportes ejecutivos', 'SLA por etapa'].map(f => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.12)', color: '#93C5FD' }}>{f}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-white font-bold text-lg font-display">$14,900<span className="text-gray-500 text-xs font-normal ml-1">/mes</span></span>
                  <span className="flex items-center gap-1 text-blue-300 text-xs font-semibold">Explorar <ChevronRight size={14} /></span>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Recruiter Pro */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Link to="/dashboard/recruiter-tools" className="card-premium block h-full rounded-2xl" style={{ background: 'linear-gradient(160deg, rgba(13,148,136,0.1) 0%, rgba(15,23,42,0.95) 60%)' }}>
              <div className="card-shimmer" />
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] -mr-16 -mt-16" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.1), transparent 70%)' }} />
              <div className="relative p-7 h-full flex flex-col">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)', boxShadow: '0 6px 24px rgba(13,148,136,0.25)' }}>
                    <Zap size={22} className="text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-teal-300" style={{ background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.15)' }}>
                    <TrendingUp size={10} /> Recruiter Pro
                  </div>
                </div>
                <h3 className="font-display font-extrabold text-lg text-white mb-2">Tu productividad como reclutador tiene un techo. Romperlo es tu decisión</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-5 flex-1">14 prompts de IA, 11 templates de outreach, boolean search avanzado y reportes ejecutivos. <span className="text-teal-300">Herramientas que convierten horas de trabajo en minutos.</span></p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {['Prompts IA', 'Outreach', 'Boolean Search', 'Reportes'].map(f => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.12)', color: '#5EEAD4' }}>{f}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-white font-bold text-lg font-display">$499<span className="text-gray-500 text-xs font-normal ml-1">/mes</span></span>
                  <span className="flex items-center gap-1 text-teal-300 text-xs font-semibold">Activar <ChevronRight size={14} /></span>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* ── EDITORIAL CARDS: Academy + Tu Marca Vende + Perfil ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              to: '/dashboard/academy', icon: GraduationCap,
              title: 'Academy', hook: 'El reclutador que no evoluciona, desaparece.',
              desc: 'Playbooks ejecutivos, casos reales, sesiones en vivo y una comunidad que te mantiene relevante.',
              price: 'Gratis', priceSub: 'para empezar',
              accent: '#F59E0B', accentRgb: '245,158,11',
              features: ['4 Playbooks', 'Casos reales', 'Sesiones en vivo'],
            },
            {
              to: '/dashboard/marca-vende', icon: Target,
              title: 'Tu Marca Vende', hook: 'Si nadie te encuentra, no existes profesionalmente.',
              desc: 'Diagnóstico IA de tu perfil, CV optimizado, simulador de entrevista y estrategia de visibilidad.',
              price: '$399', priceSub: 'diagnóstico',
              accent: '#F43F5E', accentRgb: '244,63,94',
              features: ['Diagnóstico IA', 'Perfil optimizado', 'Simulador entrevista'],
            },
            {
              to: '/dashboard/candidate-profile', icon: UserCircle,
              title: 'Marketplace', hook: 'Las mejores oportunidades buscan candidatos, no al revés.',
              desc: 'Crea tu perfil profesional y que las empresas correctas te encuentren primero.',
              price: 'Gratis', priceSub: 'perfil básico',
              accent: '#22C55E', accentRgb: '34,197,94',
              features: ['Visibilidad', 'Alertas', 'Perfil IA'],
            },
          ].map((card, idx) => (
            <motion.div key={card.to} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + idx * 0.08 }}>
              <Link to={card.to} className="card-premium block h-full rounded-2xl" style={{ background: `linear-gradient(180deg, rgba(${card.accentRgb},0.06) 0%, rgba(15,23,42,0.9) 100%)` }}>
                <div className="card-shimmer" />
                <div className="relative p-6 h-full flex flex-col">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `linear-gradient(135deg, ${card.accent}, ${card.accent}99)`, boxShadow: `0 4px 20px rgba(${card.accentRgb},0.2)` }}>
                    <card.icon size={20} className="text-white" />
                  </div>
                  <h3 className="font-display font-extrabold text-base text-white mb-1">{card.title}</h3>
                  <p className="text-sm font-medium mb-2" style={{ color: card.accent }}>{card.hook}</p>
                  <p className="text-gray-400 text-xs leading-relaxed mb-4 flex-1">{card.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {card.features.map(f => (
                      <span key={f} className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: `rgba(${card.accentRgb},0.08)`, color: `${card.accent}CC` }}>{f}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-white font-bold font-display">{card.price} <span className="text-gray-500 text-[10px] font-normal">{card.priceSub}</span></span>
                    <ChevronRight size={16} style={{ color: card.accent }} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
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
