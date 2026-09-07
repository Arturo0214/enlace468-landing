// Modal "Inscribir en secuencia" (FASE 5).
// Lista las secuencias ACTIVAS de la organización y crea el
// sequence_enrollment (next_run_at = ahora → el runner lo toma en el
// siguiente tick, dentro de horario laboral). Muestra el estado si el
// candidato ya está inscrito — el unique parcial de BD impide duplicar.
//
// target: { type: 'bank' | 'vc', id, name }  (sourcing_bank_id o vacancy_candidate_id)
import { useEffect, useState } from 'react'
import { X, Loader2, Workflow, CheckCircle, Play } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STATUS_LABEL = {
  active: { text: 'En curso', cls: 'bg-emerald-500/15 text-emerald-300' },
  paused: { text: 'Pausada', cls: 'bg-amber-400/15 text-amber-300' },
  replied: { text: 'Respondió', cls: 'bg-teal-500/15 text-teal-300' },
  completed: { text: 'Completada', cls: 'bg-blue-500/15 text-blue-300' },
  stopped: { text: 'Detenida', cls: 'bg-white/10 text-gray-400' },
  bounced: { text: 'Rebotó', cls: 'bg-red-500/15 text-red-300' },
}

export default function EnrollModal({ target, profile, onClose, onEnrolled }) {
  const [sequences, setSequences] = useState([])
  const [enrollments, setEnrollments] = useState({}) // sequence_id → enrollment
  const [loading, setLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState(null)
  const [error, setError] = useState(null)

  const targetCol = target?.type === 'vc' ? 'vacancy_candidate_id' : 'sourcing_bank_id'

  useEffect(() => {
    if (!target || !profile?.organization_id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [{ data: seqs }, { data: enrs }] = await Promise.all([
        supabase.from('outreach_sequences').select('*, sequence_steps(id)')
          .eq('organization_id', profile.organization_id).eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('sequence_enrollments').select('id, sequence_id, status')
          .eq(targetCol, target.id),
      ])
      if (cancelled) return
      setSequences(seqs || [])
      setEnrollments(Object.fromEntries((enrs || []).map(e => [e.sequence_id, e])))
      setLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, profile?.organization_id])

  async function enroll(seq) {
    setEnrollingId(seq.id); setError(null)
    const { data, error: err } = await supabase.from('sequence_enrollments').insert({
      organization_id: profile.organization_id,
      sequence_id: seq.id,
      [targetCol]: target.id,
      status: 'active',
      current_step: 0,
      next_run_at: new Date().toISOString(),
      enrolled_by: profile.id,
    }).select().single()
    setEnrollingId(null)
    if (err) {
      setError(err.message?.includes('duplicate') ? 'Este candidato ya estuvo inscrito en esa secuencia (no se re-inscribe, anti-spam).' : err.message)
      return
    }
    setEnrollments(prev => ({ ...prev, [seq.id]: data }))
    onEnrolled?.(seq, data)
  }

  if (!target) return null
  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto border border-white/[0.08]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,169,157,0.15)' }}>
              <Workflow size={15} style={{ color: '#00A99D' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Inscribir en secuencia</p>
              <p className="text-[11px] text-gray-500 truncate max-w-[240px]">{target.name || 'Candidato'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-4 justify-center"><Loader2 size={14} className="animate-spin" /> Cargando secuencias…</div>
          ) : sequences.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">
              No hay secuencias activas. Créalas en <span className="text-primary-light">Secuencias</span> del menú.
            </p>
          ) : sequences.map(seq => {
            const enr = enrollments[seq.id]
            const st = enr && STATUS_LABEL[enr.status]
            return (
              <div key={seq.id} className="flex items-center gap-3 rounded-xl p-3 bg-white/[0.02] border border-white/[0.06]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{seq.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {(seq.sequence_steps || []).length} paso{(seq.sequence_steps || []).length === 1 ? '' : 's'}
                    {seq.stop_on_reply && ' · se detiene al responder'}
                  </p>
                </div>
                {st ? (
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${st.cls}`}>
                    <CheckCircle size={10} className="inline mr-0.5" /> {st.text}
                  </span>
                ) : (
                  <button onClick={() => enroll(seq)} disabled={enrollingId === seq.id}
                    className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50 flex-shrink-0"
                    style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}>
                    {enrollingId === seq.id ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                    Inscribir
                  </button>
                )}
              </div>
            )
          })}
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <p className="text-[10px] text-gray-600 pt-1">
            Los envíos salen del outbox con cuota anti-ban (LinkedIn) y solo en horario laboral L-V.
          </p>
        </div>
      </div>
    </div>
  )
}
