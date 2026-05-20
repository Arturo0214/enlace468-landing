import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Briefcase, Clock, CheckCircle, PauseCircle, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const statusConfig = {
  draft: { label: 'Borrador', color: 'bg-gray-500/20 text-gray-300' },
  open: { label: 'Abierta', color: 'bg-green-500/20 text-green-400' },
  on_hold: { label: 'En pausa', color: 'bg-gold/20 text-gold' },
  closed_filled: { label: 'Cerrada', color: 'bg-accent/20 text-accent' },
  closed_cancelled: { label: 'Cancelada', color: 'bg-red-500/20 text-red-400' },
}

const priorityColors = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-accent/20 text-accent-light',
  high: 'bg-gold/20 text-gold',
  urgent: 'bg-red-500/20 text-red-400',
}

export default function VacancyList() {
  const { profile } = useAuth()
  const [vacancies, setVacancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { if (profile) loadVacancies() }, [profile])

  async function loadVacancies() {
    const { data, error } = await supabase
      .from('vacancies')
      .select('*, vacancy_candidates(stage)')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
    if (!error) setVacancies(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? vacancies : vacancies.filter(v => v.status === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Vacantes</h1>
          <p className="text-gray-400 mt-1">{vacancies.length} vacante{vacancies.length !== 1 ? 's' : ''} en total</p>
        </div>
        <Link
          to="/dashboard/vacancies/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus size={18} />
          Nueva vacante
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[{ key: 'all', label: 'Todas' }, { key: 'open', label: 'Abiertas' }, { key: 'draft', label: 'Borradores' }, { key: 'on_hold', label: 'En pausa' }, { key: 'closed_filled', label: 'Cerradas' }].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.key
                ? 'bg-gradient-to-r from-primary/30 to-accent/20 text-white border border-primary/30'
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl">
          <Briefcase size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No hay vacantes</h3>
          <p className="text-gray-400 mb-4 text-sm">Crea tu primera vacante para comenzar</p>
          <Link
            to="/dashboard/vacancies/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg text-sm font-medium"
          >
            <Plus size={16} /> Crear vacante
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(vacancy => {
            const status = statusConfig[vacancy.status] || statusConfig.draft
            const candidateCount = vacancy.vacancy_candidates?.length || 0
            const hiredCount = vacancy.vacancy_candidates?.filter(vc => vc.stage === 'hired').length || 0
            return (
              <Link
                key={vacancy.id}
                to={`/dashboard/vacancies/${vacancy.id}`}
                className="block glass rounded-xl p-5 hover:border-primary/30 hover:scale-[1.01] transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-white">{vacancy.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
                      {vacancy.priority && vacancy.priority !== 'medium' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[vacancy.priority]}`}>{vacancy.priority}</span>
                      )}
                    </div>
                    {vacancy.company_name && (
                      <p className="text-sm text-gray-400">{vacancy.company_name} {vacancy.location ? `· ${vacancy.location}` : ''}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-medium text-white">{candidateCount} candidatos</div>
                    {hiredCount > 0 && <div className="text-xs text-green-400">{hiredCount} contratado{hiredCount > 1 ? 's' : ''}</div>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
