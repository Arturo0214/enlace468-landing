import { useState } from 'react'
import { DragDropContext } from '@hello-pangea/dnd'
import { Plus, X, Trash2, Search, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import EnrollModal from '../outreach/EnrollModal'
import { usePipeline } from './pipeline/usePipeline'
import { useCandidateModal } from './pipeline/useCandidateModal'
import { useThankYouEmails } from './pipeline/useThankYouEmails'
import { useAddCandidate } from './pipeline/useAddCandidate'
import StageColumn from './pipeline/StageColumn'
import CandidateModal from './pipeline/CandidateModal'
import ThankYouEmailModal from './pipeline/ThankYouEmailModal'
import AddCandidateModal from './pipeline/AddCandidateModal'

// Orquestador del pipeline de una vacante: la lógica de datos vive en los
// hooks de ./pipeline y la UI pesada en sus componentes; aquí solo se cablean
// (tablero drag&drop, modales de candidato/agradecimiento/alta y secuencias).
export default function VacancyPipeline({ vacancyId }) {
  const {
    profile, getLabel, stages,
    candidates, setCandidates, loading, setLoading, loadError, loadPipeline,
    slaBadge, handleDragEnd,
    boardSearch, setBoardSearch, q, matchesSearch, matchCount,
  } = usePipeline(vacancyId)
  const modal = useCandidateModal({ vacancyId, candidates, setCandidates })
  const thankYou = useThankYouEmails({ vacancyId, candidates })
  const add = useAddCandidate({ vacancyId, candidates, loadPipeline })
  const [enrollTarget, setEnrollTarget] = useState(null) // { type:'vc', id, name } → secuencias (Fase 5)
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>

  if (loadError) return (
    <div className="text-center py-12 glass rounded-xl">
      <p className="text-red-400 text-sm mb-1">No se pudo cargar el pipeline</p>
      <p className="text-gray-500 text-xs mb-4">{loadError}</p>
      <button onClick={() => { setLoading(true); loadPipeline() }}
        className="px-4 py-2 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg text-sm font-medium hover:opacity-90">
        Reintentar
      </button>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <p className="text-sm text-gray-400 whitespace-nowrap">
            {q
              ? <><span className="text-white font-medium">{matchCount}</span> de {candidates.length}</>
              : <>{candidates.length} candidato{candidates.length !== 1 ? 's' : ''} en pipeline</>}
          </p>
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={boardSearch}
              onChange={e => setBoardSearch(e.target.value)}
              placeholder="Buscar candidato por nombre..."
              className="w-full pl-8 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
            />
            {boardSearch && (
              <button onClick={() => setBoardSearch('')} title="Limpiar"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <button onClick={add.openAddModal} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg hover:opacity-90 text-sm font-medium flex-shrink-0">
          <Plus size={16} /> Agregar candidato
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ height: 'calc(100vh - 330px)' }}>
          {stages.map(stage => {
            const items = candidates.filter(c => c.stage === stage.id && matchesSearch(c))
            return (
              <StageColumn key={stage.id} stage={stage} items={items}
                getLabel={getLabel} slaBadge={slaBadge}
                onOpenCandidate={modal.openCandidateModal}
                onDeleteCandidate={setConfirmDelete}
                onOpenThankYou={thankYou.openThankYouModal} />
            )
          })}
        </div>
      </DragDropContext>

      {/* Candidate detail modal */}
      {modal.selectedVC && (
        <CandidateModal modal={modal} stages={stages} onEnroll={setEnrollTarget} />
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-theme-surface rounded-2xl w-full max-w-sm border border-white/10 p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Trash2 size={24} className="text-red-400" />
            </div>
            <h3 className="font-display font-bold text-white text-lg mb-2">Eliminar candidato</h3>
            <p className="text-sm text-gray-400 mb-6">
              ¿Estás seguro que quieres eliminar a <span className="text-white font-semibold">{confirmDelete.candidates?.full_name}</span> del pipeline?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors" style={{ border: '1px solid var(--border-default)' }}>
                Cancelar
              </button>
              <button onClick={async () => {
                setDeleting(confirmDelete.id)
                await supabase.from('vacancy_candidates').delete().eq('id', confirmDelete.id)
                setCandidates(prev => prev.filter(c => c.id !== confirmDelete.id))
                setConfirmDelete(null)
                setDeleting(null)
              }} disabled={deleting === confirmDelete.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
                {deleting === confirmDelete.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thank You Modal */}
      {thankYou.showThankYouModal && (
        <ThankYouEmailModal thankYou={thankYou} candidates={candidates}
          onClose={() => thankYou.setShowThankYouModal(false)} />
      )}

      {/* Add candidate modal — two panels */}
      {add.showAddModal && (
        <AddCandidateModal add={add} onClose={() => add.setShowAddModal(false)} />
      )}

      {/* Inscribir en secuencia (Fase 5) */}
      {enrollTarget && <EnrollModal target={enrollTarget} profile={profile} onClose={() => setEnrollTarget(null)} />}
    </div>
  )
}
