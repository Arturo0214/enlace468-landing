import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePlan } from '../../lib/planContext'
import { verifyBadge, hasVerifyProblem, verifyTooltip } from '../../lib/verifyBadge'
import UpgradePrompt from '../ui/UpgradePrompt'
import { EmptyState, Spinner } from '../ui'
import CandidateForm from './CandidateForm'

export default function CandidateBank() {
  const { canDo } = usePlan()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [verifyFilter, setVerifyFilter] = useState('todos') // todos | activos | problemas
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { if (canDo('access_candidate_bank')) loadCandidates() }, [])

  if (!canDo('access_candidate_bank')) {
    return <UpgradePrompt action="access_candidate_bank" />
  }

  async function loadCandidates() {
    const { data } = await supabase.from('candidates').select('*, vacancy_candidates(vacancy_id, stage)').is('archived_at', null).order('created_at', { ascending: false })
    setCandidates(data || []); setLoading(false)
  }

  const filtered = candidates.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.current_title || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  ).filter(c => {
    // Filtro de frescura (Fase 4): tolerante a que la columna aún no exista.
    if (verifyFilter === 'activos') return c.verify_status === 'activo'
    if (verifyFilter === 'problemas') return hasVerifyProblem(c.verify_status)
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Banco de candidatos</h1>
          <p className="text-gray-400 mt-1">{candidates.length} candidato{candidates.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg hover:opacity-90 text-sm font-medium">
          <Plus size={18} /> Nuevo candidato
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, email, titulo o tag..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm" />
        </div>
        <select value={verifyFilter} onChange={e => setVerifyFilter(e.target.value)} title="Estado del perfil (verificación automática)"
          className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-gray-300 text-sm [&>option]:bg-gray-900">
          <option value="todos">Estado del perfil: todos</option>
          <option value="activos">Verificados activos</option>
          <option value="problemas">Con problemas</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={User}
          title={search ? 'Sin resultados' : 'No hay candidatos'}
          description={search ? 'Intenta con otra busqueda' : 'Agrega tu primer candidato al banco'}
        />
      ) : (
        <div className="glass rounded-xl divide-y divide-white/5">
          {filtered.map(candidate => (
            <Link key={candidate.id} to={`/dashboard/candidates/${candidate.id}`} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-gray-300 flex-shrink-0">
                <User size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{candidate.full_name}</span>
                  {candidate.source && <span className="text-xs text-gray-500">{candidate.source}</span>}
                  {hasVerifyProblem(candidate.verify_status) && (() => {
                    const vb = verifyBadge(candidate.verify_status)
                    return vb && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: vb.bg, color: vb.fg }}
                        title={verifyTooltip(candidate.verify_status, candidate.verify_details)}>
                        {vb.icon} {vb.label}
                      </span>
                    )
                  })()}
                </div>
                <div className="text-sm text-gray-400 truncate">
                  {[candidate.current_title, candidate.current_company].filter(Boolean).join(' · ') || candidate.email || 'Sin informacion'}
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {(candidate.tags || []).slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400">{tag}</span>
                ))}
                {candidate.vacancy_candidates?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary-light font-medium">
                    {candidate.vacancy_candidates.length} vacante{candidate.vacancy_candidates.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {showForm && <CandidateForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadCandidates() }} />}
    </div>
  )
}
