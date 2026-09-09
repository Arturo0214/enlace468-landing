import { useState, useEffect, useRef } from 'react'
import { ExternalLink, Plus, Loader2, CheckCircle, X, Mail, Phone, MapPin, Sparkles, Copy, MessageSquare, Send, Workflow, StickyNote } from 'lucide-react'
import EnrollModal from '../../outreach/EnrollModal'
import ConfirmDialog from '../../ui/ConfirmDialog'
import { normalizeLinkedInUrl } from '../../../lib/sourcingScore'

// Modal del candidato (resultados locales): datos de contacto, draft de
// outreach con IA por canal, envío real por LinkedIn (con ConfirmDialog) y
// acciones de pipeline/secuencia. Incluye también el EnrollModal (Fase 5),
// que puede abrirse desde el banco aunque no haya candidato seleccionado.
export default function SourcingCandidateModal({
  selectedCandidate, setSelectedCandidate, addedIds, addingId,
  search, bank, outreach, enrollTarget, setEnrollTarget, profile,
}) {
  const { addToBank, addExisting } = search
  const { bankItems, updateNotes, savingNotesId } = bank
  const {
    draftChannel, setDraftChannel, draftLoading, draft, draftCopied,
    sending, sendResult, pendingSend, setPendingSend,
    generateDraft, copyDraft, sendLinkedIn, doSendLinkedIn,
  } = outreach

  // ── Notas por candidato (sourcing_bank.notes) ────────────────────────────
  // Ahí viven las observaciones de la QA tester y las razones de auto-descarte;
  // el reclutador puede editarlas desde aquí. La fila del banco se resuelve por
  // id (si el modal se abrió desde el banco) o por URL canónica.
  const candKey = selectedCandidate ? normalizeLinkedInUrl(selectedCandidate.url || selectedCandidate.linkedin_url) : ''
  const notesRow = selectedCandidate
    ? (bankItems.find(x => x.id === selectedCandidate.id)
      || (candKey && bankItems.find(x => normalizeLinkedInUrl(x.url) === candKey))
      || null)
    : null
  // Reset del borrador al cambiar de candidato — patrón "adjust state during
  // render" (sin effect, evita renders en cascada).
  const [noteState, setNoteState] = useState({ rowId: null, text: '', savedAt: null })
  if ((notesRow?.id ?? null) !== noteState.rowId) {
    setNoteState({ rowId: notesRow?.id ?? null, text: notesRow?.notes || '', savedAt: null })
  }
  const noteText = noteState.text
  const noteSavedAt = noteState.savedAt
  const setNoteText = text => setNoteState(s => ({ ...s, text }))
  const noteRef = useRef(null)
  useEffect(() => {
    // Abierto desde el icono 📝 de la tarjeta → llegar directo a las notas.
    if (selectedCandidate?._openNotes && noteRef.current) {
      noteRef.current.scrollIntoView({ block: 'center' })
      noteRef.current.focus()
    }
  }, [selectedCandidate?._openNotes, notesRow?.id])
  async function saveNote() {
    if (!notesRow) return
    const ok = await updateNotes(notesRow.id, noteText)
    if (ok) setNoteState(s => ({ ...s, savedAt: new Date() }))
  }

  return (
    <>
      {/* Candidate modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCandidate(null)}>
          <div className="rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center text-primary-light text-lg font-bold">
                  {selectedCandidate.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-white">{selectedCandidate.full_name}</h2>
                  {selectedCandidate.current_title && <p className="text-sm text-gray-400">{selectedCandidate.current_title}</p>}
                  {selectedCandidate.current_company && <p className="text-xs text-gray-500">{selectedCandidate.current_company}</p>}
                </div>
              </div>
              <button onClick={() => setSelectedCandidate(null)} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {selectedCandidate.email && <a href={`mailto:${selectedCandidate.email}`} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2.5 hover:bg-white/[0.06]"><Mail size={14} className="text-gray-500" /><span className="text-xs text-gray-300 truncate">{selectedCandidate.email}</span></a>}
                {selectedCandidate.phone && <a href={`tel:${selectedCandidate.phone}`} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2.5 hover:bg-white/[0.06]"><Phone size={14} className="text-gray-500" /><span className="text-xs text-gray-300">{selectedCandidate.phone}</span></a>}
                {selectedCandidate.location && <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2.5"><MapPin size={14} className="text-gray-500" /><span className="text-xs text-gray-300">{selectedCandidate.location}</span></div>}
                {selectedCandidate.linkedin_url && <a href={selectedCandidate.linkedin_url} target="_blank" rel="noopener" className="flex items-center gap-2 bg-primary-light/5 rounded-lg px-3 py-2.5 hover:bg-primary-light/10 border border-primary-light/10"><ExternalLink size={14} className="text-primary-light" /><span className="text-xs text-primary-light">Ver LinkedIn</span></a>}
              </div>
              {selectedCandidate.snippet && <div><p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Perfil</p><p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedCandidate.snippet}</p></div>}

              {/* Notas del candidato (sourcing_bank.notes) — editable */}
              {notesRow && (
                <div className="rounded-xl p-3.5" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <StickyNote size={14} className="text-amber-300" />
                    <p className="text-xs font-semibold text-white">Notas</p>
                  </div>
                  <textarea ref={noteRef} value={noteText} onChange={e => setNoteText(e.target.value)}
                    rows={3} placeholder="Observaciones sobre este candidato (QA, contexto, seguimiento)…"
                    className="w-full text-sm text-gray-200 bg-black/30 border border-white/[0.08] rounded-lg p-2.5 resize-y placeholder:text-gray-600 focus:outline-none focus:border-amber-400/40" />
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={saveNote} disabled={savingNotesId === notesRow.id || (noteText.trim() === (notesRow.notes || '').trim())}
                      className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium text-amber-200 bg-amber-400/15 hover:bg-amber-400/25 disabled:opacity-40">
                      {savingNotesId === notesRow.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Guardar
                    </button>
                    {noteSavedAt && (
                      <span className="text-[11px] text-emerald-400">
                        Guardado {noteSavedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Mensaje de outreach con IA */}
              <div className="rounded-xl p-3.5" style={{ background: 'rgba(0,169,157,0.05)', border: '1px solid rgba(0,169,157,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={14} style={{ color: '#00A99D' }} />
                  <p className="text-xs font-semibold text-white">Mensaje de contacto con IA</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { id: 'linkedin_note', label: 'Nota LinkedIn' },
                    { id: 'linkedin_message', label: 'Mensaje LinkedIn' },
                    { id: 'email', label: 'Email' },
                    { id: 'whatsapp', label: 'WhatsApp' },
                  ].map(ch => (
                    <button key={ch.id} onClick={() => setDraftChannel(ch.id)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${draftChannel === ch.id ? 'text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                      style={draftChannel === ch.id ? { background: 'rgba(0,169,157,0.15)', borderColor: 'rgba(0,169,157,0.4)' } : { background: 'rgba(255,255,255,0.03)' }}>
                      {ch.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => generateDraft(selectedCandidate, draftChannel)} disabled={draftLoading}
                  className="w-full py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}>
                  {draftLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {draftLoading ? 'Generando…' : draft ? 'Regenerar' : 'Generar mensaje'}
                </button>
                {draft?.error && <p className="text-[11px] text-red-400 mt-2">{draft.error}</p>}
                {draft?.body && (
                  <div className="mt-2.5 rounded-lg p-3 bg-black/30 border border-white/[0.06]">
                    {draft.subject && <p className="text-xs text-gray-400 mb-1.5"><span className="text-gray-500">Asunto:</span> {draft.subject}</p>}
                    <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{draft.body}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button onClick={copyDraft} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.06] text-gray-300 hover:text-white hover:bg-white/[0.1]">
                        {draftCopied ? <><CheckCircle size={12} className="text-emerald-400" /> Copiado</> : <><Copy size={12} /> Copiar</>}
                      </button>
                      {selectedCandidate.linkedin_url && (draft.channel === 'linkedin_note' || draft.channel === 'linkedin_message') && (
                        <button onClick={() => sendLinkedIn(selectedCandidate, draft.channel === 'linkedin_message' ? 'inmail' : 'connect')} disabled={sending}
                          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium text-white disabled:opacity-50" style={{ background: '#0a66c2' }}>
                          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          {draft.channel === 'linkedin_message' ? 'Enviar InMail' : 'Enviar conexión'}
                        </button>
                      )}
                    </div>
                    {sendResult && <p className={`text-[11px] mt-2 ${sendResult.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{sendResult.text}</p>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 p-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {(() => {
                const key = selectedCandidate._existing_id || selectedCandidate.linkedin_url || selectedCandidate.full_name
                return addedIds.has(key) ? (
                  <span className="text-sm text-emerald-400"><CheckCircle size={16} className="inline mr-1" />En pipeline</span>
                ) : (
                  <button onClick={() => selectedCandidate._existing_id ? addExisting(selectedCandidate._existing_id) : addToBank(selectedCandidate)}
                    disabled={addingId === key} className="px-4 py-2.5 bg-primary-light text-white rounded-lg text-sm font-medium hover:bg-primary-light/90 disabled:opacity-40">
                    <Plus size={14} className="inline mr-1" />Agregar al pipeline
                  </button>
                )
              })()}
              {(() => {
                // Si el candidato ya vive en el banco → puede inscribirse a una secuencia (Fase 5)
                const bankRow = bankItems.find(x => x.url && candKey && normalizeLinkedInUrl(x.url) === candKey && x.source !== 'descartado')
                return bankRow ? (
                  <button onClick={() => setEnrollTarget({ type: 'bank', id: bankRow.id, name: bankRow.full_name || bankRow.title })}
                    className="ml-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
                    style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}>
                    <Workflow size={14} /> Secuencia
                  </button>
                ) : null
              })()}
              <div className="flex-1" />
              <button onClick={() => setSelectedCandidate(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-white">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Inscribir en secuencia (Fase 5) */}
      {enrollTarget && <EnrollModal target={enrollTarget} profile={profile} onClose={() => setEnrollTarget(null)} />}

      <ConfirmDialog
        open={!!pendingSend}
        title={pendingSend ? `¿Enviar ${pendingSend.label} a ${pendingSend.cand.full_name || 'este candidato'} por LinkedIn?` : ''}
        message={pendingSend && draft?.body ? `"${draft.body.slice(0, 180)}"` : ''}
        confirmLabel="Enviar"
        onConfirm={doSendLinkedIn}
        onCancel={() => setPendingSend(null)}
      />
    </>
  )
}
