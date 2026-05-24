import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Users, UserCheck, Clock, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePlan } from '../../lib/planContext'
import PlanBadge from '../ui/PlanBadge'

const statCards = [
  { key: 'openVacancies', label: 'Vacantes abiertas', icon: Briefcase, gradient: 'from-primary/20 to-primary/5', iconColor: 'text-primary' },
  { key: 'totalCandidates', label: 'Candidatos en banco', icon: Users, gradient: 'from-accent/20 to-accent/5', iconColor: 'text-accent' },
  { key: 'inProcess', label: 'En proceso', icon: Clock, gradient: 'from-gold/20 to-gold/5', iconColor: 'text-gold' },
  { key: 'hired', label: 'Contratados', icon: UserCheck, gradient: 'from-green-500/20 to-green-500/5', iconColor: 'text-green-400' },
]

export default function DashboardHome() {
  const { profile } = useAuth()
  const { currentPlan } = usePlan()
  const [stats, setStats] = useState({ openVacancies: 0, totalCandidates: 0, inProcess: 0, hired: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadStats()
  }, [profile])

  async function loadStats() {
    try {
      const [vacancies, candidates, pipeline] = await Promise.all([
        supabase.from('vacancies').select('id, status').eq('organization_id', profile.organization_id),
        supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id),
        supabase.from('vacancy_candidates').select('stage, vacancies!inner(organization_id)').eq('vacancies.organization_id', profile.organization_id),
      ])

      const openVacancies = vacancies.data?.filter(v => v.status === 'open').length || 0
      const totalCandidates = candidates.count || 0
      const stages = pipeline.data || []
      const inProcess = stages.filter(s => !['hired', 'rejected', 'sourced'].includes(s.stage)).length
      const hired = stages.filter(s => s.stage === 'hired').length

      setStats({ openVacancies, totalCandidates, inProcess, hired })

      const { data: activity } = await supabase
        .from('activity_log')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(10)

      setRecentActivity(activity || [])
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ key, label, icon: Icon, gradient, iconColor }) => (
          <div key={key} className="glass rounded-xl p-5 hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${iconColor}`}>
                <Icon size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {loading ? '-' : stats[key]}
            </div>
            <div className="text-sm text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
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

      {/* Recent Activity */}
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
