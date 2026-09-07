import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Briefcase, Clock, CheckCircle, PauseCircle, XCircle, Copy, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { duplicateVacancy } from '../../lib/duplicateVacancy'
import { ConfirmDialog, EmptyState, Spinner } from '../ui'

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
  const navigate = useNavigate()
  const toast = useToast()
  const [vacancies, setVacancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // vacante a confirmar

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

  async function handleDuplicate(e, vacancy) {
    e.preventDefault()
    e.stopPropagation()
    if (duplicatingId) return
    setDuplicatingId(vacancy.id)
    try {
      const copy = await duplicateVacancy(vacancy, profile)
      navigate(`/dashboard/vacancies/${copy.id}`)
    } catch (err) {
      toast.error('Error al duplicar: ' + err.message)
    } finally { setDuplicatingId(null) }
  }

  function handleDelete(e, vacancy) {
    e.preventDefault()
    e.stopPropagation()
    if (deletingId) return
    setPendingDelete(vacancy)
  }

  async function confirmDelete() {
    const vacancy = pendingDelete
    if (!vacancy) return
    setDeletingId(vacancy.id)
    try {
      const { error } = await supabase.from('vacancies').delete().eq('id', vacancy.id)
      if (error) throw error
      setVacancies(prev => prev.filter(v => v.id !== vacancy.id))
      toast.success('Vacante eliminada')
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    } finally {
      setDeletingId(null)
      setPendingDelete(null)
    }
  }

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
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No hay vacantes"
          description="Crea tu primera vacante para comenzar"
          action={
            <Link
              to="/dashboard/vacancies/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium"
            >
              <Plus size={16} /> Crear vacante
            </Link>
          }
        />
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
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-medium text-white">{candidateCount} candidatos</div>
                      {hiredCount > 0 && <div className="text-xs text-green-400">{hiredCount} contratado{hiredCount > 1 ? 's' : ''}</div>}
                    </div>
                    <button
                      onClick={e => handleDuplicate(e, vacancy)}
                      disabled={duplicatingId !== null}
                      title="Duplicar vacante"
                      className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-all"
                    >
                      {duplicatingId === vacancy.id ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                    </button>
                    <button
                      onClick={e => handleDelete(e, vacancy)}
                      disabled={deletingId !== null}
                      title="Eliminar vacante"
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-all"
                    >
                      {deletingId === vacancy.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        danger
        title={pendingDelete ? `¿Eliminar la vacante "${pendingDelete.title}"?` : ''}
        message={(() => {
          const count = pendingDelete?.vacancy_candidates?.length || 0
          return count > 0
            ? `Se borrarán también sus ${count} candidato${count > 1 ? 's' : ''} del pipeline y su banco de sourcing. Esta acción NO se puede deshacer.`
            : 'Esta acción NO se puede deshacer.'
        })()}
        confirmLabel="Eliminar"
        loading={!!deletingId}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deletingId) setPendingDelete(null) }}
      />
    </div>
  )
}
