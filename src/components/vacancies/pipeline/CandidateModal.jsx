import { useState } from 'react'
import { Plus, Star, X, Mail, Phone, MapPin, ExternalLink, Briefcase, Calendar, Tag, Clock, MessageCircle, Send, Loader2, CheckCircle, ArrowUpRight, ArrowDownLeft, FileText, Video, Link2, AlertTriangle, Workflow, StickyNote } from 'lucide-react'
import { scoreColor } from './stages'

// Modal de detalle del candidato: info + CV + contactar + entrevistas
// (Fireflies/Calendar), timeline de interacciones y notas de entrevista.
// Todo el estado/acciones vienen del hook useCandidateModal (prop `modal`).
export default function CandidateModal({ modal, stages, onEnroll }) {
  const {
    selectedVC, setSelectedVC,
    savingContact, markAsContacted,
    interactions, loadingInteractions, deleteInteraction, addInteraction,
    newMessage, setNewMessage, messageType, setMessageType,
    messageDirection, setMessageDirection,
    interviewNotes, loadingNotes,
    firefliesNotes, calendarEvents, loadingGoogle, googleError,
    modalCvUploading, uploadCvForCandidate,
    saveCandidateNotes, savingCandidateNotes,
  } = modal
        const c = selectedVC.candidates || {}
        const currentStage = stages.find(s => s.id === selectedVC.stage)
        // Notas del candidato (candidates.notes) — editable en el modal. Reset
        // al cambiar de candidato con el patrón "adjust state during render"
        // (sin effect, evita renders en cascada).
        const [notesState, setNotesState] = useState({ candId: null, text: '', savedAt: null })
        if (selectedVC.candidate_id !== notesState.candId) {
          setNotesState({ candId: selectedVC.candidate_id, text: c.notes || '', savedAt: null })
        }
        const candNotes = notesState.text
        const candNotesSavedAt = notesState.savedAt
        const setCandNotes = text => setNotesState(s => ({ ...s, text }))
        const setCandNotesSavedAt = savedAt => setNotesState(s => ({ ...s, savedAt }))
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVC(null)}>
            <div className="bg-theme-surface rounded-2xl w-full max-w-6xl max-h-[85vh] border border-white/10 flex" onClick={e => e.stopPropagation()}>

              {/* Left side — Candidate info */}
              <div className="w-[38%] overflow-y-auto" style={{ borderRight: '1px solid var(--border-default)' }}>
                {/* Header */}
                <div className="flex items-start justify-between p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary-light text-base font-bold">
                      {c.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-display font-bold text-white">{c.full_name}</h2>
                      {c.current_title && <p className="text-xs text-gray-400">{c.current_title}</p>}
                      {c.current_company && <p className="text-[11px] text-gray-500">{c.current_company}</p>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedVC(null)} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Stage badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${currentStage?.color} bg-white/5`}>
                      {currentStage?.label}
                    </span>
                    {selectedVC.match_score != null && (
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 ${scoreColor(selectedVC.match_score)}`}>
                        <Star size={10} /> {Math.round(selectedVC.match_score)}%
                      </span>
                    )}
                    {selectedVC.contacted_at && (
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle size={10} className="inline mr-1" />{selectedVC.contacted_via}
                      </span>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="grid grid-cols-2 gap-2">
                    {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"><Mail size={12} className="text-gray-500" /><span className="text-[11px] text-gray-300 truncate">{c.email}</span></a>}
                    {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"><Phone size={12} className="text-gray-500" /><span className="text-[11px] text-gray-300">{c.phone}</span></a>}
                    {c.location && <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"><MapPin size={12} className="text-gray-500" /><span className="text-[11px] text-gray-300">{c.location}</span></div>}
                    {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener" className="flex items-center gap-2 bg-primary-light/5 rounded-lg px-3 py-2 hover:bg-primary-light/10 border border-primary-light/10"><ExternalLink size={12} className="text-primary-light" /><span className="text-[11px] text-primary-light">LinkedIn</span></a>}
                  </div>

                  {/* Extra info */}
                  {(c.years_experience || c.salary_expectation) && (
                    <div className="grid grid-cols-2 gap-2">
                      {c.years_experience && <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"><Briefcase size={12} className="text-gray-500" /><span className="text-[11px] text-gray-300">{c.years_experience} años exp.</span></div>}
                      {c.salary_expectation && <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"><span className="text-gray-500 text-xs font-medium">$</span><span className="text-[11px] text-gray-300">{Number(c.salary_expectation).toLocaleString('es-MX')}</span></div>}
                    </div>
                  )}

                  {/* CV — view or upload */}
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Curriculum Vitae</p>
                    {c.cv_url ? (
                      <div className="flex items-center gap-2">
                        <a href={c.cv_url} target="_blank" rel="noopener" className="flex-1 flex items-center gap-2 bg-accent/5 rounded-lg px-3 py-2.5 hover:bg-accent/10 border border-accent/15 transition-colors">
                          <FileText size={14} className="text-accent" />
                          <span className="text-xs text-accent font-medium">Ver CV</span>
                          <ExternalLink size={10} className="text-accent/60 ml-auto" />
                        </a>
                        <label className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors text-xs text-gray-400">
                          {modalCvUploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                          Reemplazar
                          <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => e.target.files?.[0] && uploadCvForCandidate(selectedVC.candidate_id, e.target.files[0])} />
                        </label>
                      </div>
                    ) : (
                      <label className="flex items-center gap-3 px-3 py-3 rounded-lg border-2 border-dashed border-white/10 hover:border-accent/30 cursor-pointer transition-colors">
                        {modalCvUploading ? <Loader2 size={18} className="text-accent animate-spin" /> : <FileText size={18} className="text-gray-600" />}
                        <div className="flex-1">
                          <p className="text-xs text-gray-400">{modalCvUploading ? 'Subiendo CV...' : 'Subir CV del candidato'}</p>
                          <p className="text-[10px] text-gray-600">PDF, DOC o DOCX</p>
                        </div>
                        <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={modalCvUploading} onChange={e => e.target.files?.[0] && uploadCvForCandidate(selectedVC.candidate_id, e.target.files[0])} />
                      </label>
                    )}
                  </div>

                  {/* Tags */}
                  {c.tags?.length > 0 && <div className="flex flex-wrap gap-1.5">{c.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400"><Tag size={8} className="inline mr-1" />{t}</span>)}</div>}

                  {/* Notas del candidato — editables (candidates.notes) */}
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1"><StickyNote size={10} /> Notas</p>
                    <textarea value={candNotes} onChange={e => setCandNotes(e.target.value)}
                      rows={3} placeholder="Observaciones sobre este candidato…"
                      className="w-full text-xs text-gray-300 bg-white/5 border border-white/10 rounded-lg p-2.5 resize-y placeholder:text-gray-600 focus:outline-none focus:border-amber-400/40" />
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={async () => { if (await saveCandidateNotes(selectedVC.candidate_id, candNotes)) setCandNotesSavedAt(new Date()) }}
                        disabled={savingCandidateNotes || candNotes.trim() === (c.notes || '').trim()}
                        className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium text-amber-200 bg-amber-400/15 hover:bg-amber-400/25 disabled:opacity-40">
                        {savingCandidateNotes ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />} Guardar
                      </button>
                      {candNotesSavedAt && (
                        <span className="text-[11px] text-emerald-400">
                          Guardado {candNotesSavedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Secuencia de outreach (Fase 5) */}
                  <button onClick={() => onEnroll({ type: 'vc', id: selectedVC.id, name: c.full_name })}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
                    style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}
                    title="Inscribir al candidato en una secuencia multi-touch automática">
                    <Workflow size={13} /> Inscribir en secuencia
                  </button>

                  {/* Contact actions */}
                  {!selectedVC.contacted_at && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Contactar</p>
                      <div className="flex gap-2">
                        {c.linkedin_url && <button onClick={() => markAsContacted(selectedVC, 'LinkedIn', c.linkedin_url)} disabled={savingContact} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400 hover:bg-blue-500/20 disabled:opacity-40">{savingContact ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />} LinkedIn</button>}
                        {c.email && <button onClick={() => markAsContacted(selectedVC, 'Email', `mailto:${c.email}`)} disabled={savingContact} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-400 hover:bg-purple-500/20 disabled:opacity-40">{savingContact ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Email</button>}
                        {c.phone && <button onClick={() => markAsContacted(selectedVC, 'Telefono', `https://wa.me/${c.phone.replace(/\D/g, '')}`)} disabled={savingContact} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400 hover:bg-green-500/20 disabled:opacity-40">{savingContact ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />} WhatsApp</button>}
                      </div>
                    </div>
                  )}

                  {/* Interviews — Fireflies + Calendar */}
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Entrevistas</p>
                    {loadingGoogle ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 size={10} className="animate-spin" /> Buscando en Gmail y Calendar...</div>
                    ) : googleError ? (
                      <p className="text-[11px] text-amber-400/70">Reconecta Google para ver entrevistas (cierra sesion y vuelve a entrar)</p>
                    ) : (firefliesNotes.length > 0 || calendarEvents.length > 0) ? (
                      <div className="space-y-2">
                        {/* Calendar events */}
                        {calendarEvents.map(ev => (
                          <div key={ev.id} className="bg-blue-500/[0.04] border border-blue-500/10 rounded-lg p-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar size={11} className="text-blue-400" />
                              <span className="text-[11px] font-medium text-white truncate">{ev.title}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-gray-400">
                              <span>{new Date(ev.start).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              {ev.meetLink && <a href={ev.meetLink} target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5"><Video size={9} /> Meet</a>}
                            </div>
                          </div>
                        ))}
                        {/* Fireflies notes */}
                        {firefliesNotes.map(note => (
                          <div key={note.id} className="bg-purple-500/[0.04] border border-purple-500/10 rounded-lg p-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText size={11} className="text-purple-400" />
                              <span className="text-[11px] font-medium text-white truncate">{note.meetingTitle}</span>
                              {note.duration && <span className="text-[10px] text-gray-500">{note.duration}</span>}
                            </div>
                            {note.summary && <p className="text-[11px] text-gray-400 line-clamp-3 mb-1.5">{note.summary.slice(0, 200)}</p>}
                            {note.actionItems.length > 0 && (
                              <div className="space-y-0.5 mb-1.5">
                                {note.actionItems.slice(0, 3).map((item, j) => (
                                  <div key={j} className="text-[10px] text-gray-400 flex items-start gap-1">
                                    <CheckCircle size={8} className="text-purple-400 mt-0.5 flex-shrink-0" /> {item}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-gray-500">{note.date?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                              {note.firefliesUrl && <a href={note.firefliesUrl} target="_blank" rel="noopener" className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5"><Link2 size={8} /> Transcripcion</a>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-600">Sin entrevistas encontradas para este candidato</p>
                    )}
                  </div>

                  {/* Investigate + activity */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Google', url: `https://www.google.com/search?q=${encodeURIComponent(`"${c.full_name}" ${c.current_company || ''}`)}` },
                      // Con URL guardada abre el perfil DIRECTO; sin URL lo dice
                      // claro (antes el botón "LinkedIn" mandaba a Google sin avisar).
                      { label: c.linkedin_url ? 'LinkedIn' : 'Buscar en LinkedIn', url: c.linkedin_url || `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in "${c.full_name || ''}"`)}` },
                      { label: 'Noticias', url: `https://www.google.com/search?q=${encodeURIComponent(`"${c.full_name}"`)}&tbm=nws` },
                    ].map((s, i) => <a key={i} href={s.url} target="_blank" rel="noopener" className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"><ExternalLink size={8} className="inline mr-0.5" />{s.label}</a>)}
                  </div>
                  <div className="space-y-1">
                    {selectedVC.stage_changed_at && <div className="flex items-center gap-2 text-[10px] text-gray-500"><Clock size={9} />Movido a {currentStage?.label}: {new Date(selectedVC.stage_changed_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</div>}
                    <div className="flex items-center gap-2 text-[10px] text-gray-500"><Calendar size={9} />Agregado: {new Date(selectedVC.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>

              {/* Middle — Conversation */}
              <div className="w-[30%] flex flex-col" style={{ borderRight: '1px solid var(--border-default)' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold text-white">Conversacion</p>
                </div>

                {/* Timeline entries */}
                <div className="flex-1 overflow-y-auto p-4">
                  {loadingInteractions ? (
                    <div className="text-center py-8"><Loader2 size={16} className="animate-spin mx-auto text-gray-500" /></div>
                  ) : interactions.length > 0 ? (
                    <div className="space-y-2">
                      {interactions.map(int => {
                        const isOutbound = int.direction === 'outbound'
                        const typeLabels = { linkedin_message: 'LinkedIn', email: 'Email', whatsapp: 'WhatsApp', call: 'Llamada', note: 'Nota' }
                        const typeColors = { linkedin_message: 'text-blue-400', email: 'text-purple-400', whatsapp: 'text-green-400', call: 'text-amber-400', note: 'text-gray-400' }
                        return (
                          <div key={int.id} className={`flex gap-2.5 p-2.5 rounded-lg group/int ${isOutbound ? 'bg-blue-500/[0.04]' : 'bg-emerald-500/[0.04]'}`}>
                            <div className={`flex-shrink-0 mt-0.5 ${isOutbound ? 'text-blue-400' : 'text-emerald-400'}`}>
                              {isOutbound ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[10px] font-medium ${typeColors[int.type] || 'text-gray-400'}`}>{typeLabels[int.type] || int.type}</span>
                                <span className="text-[10px] text-gray-600">{new Date(int.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-xs text-gray-300">{int.content}</p>
                            </div>
                            <button onClick={() => deleteInteraction(int.id)}
                              className="flex-shrink-0 p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/int:opacity-100 transition-all" title="Eliminar">
                              <X size={11} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MessageCircle size={24} className="mx-auto text-gray-700 mb-2" />
                      <p className="text-xs text-gray-600">Sin interacciones registradas</p>
                      <p className="text-[10px] text-gray-700 mt-1">Los mensajes de LinkedIn se detectan automaticamente</p>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                  <div className="flex gap-1">
                    {[
                      { id: 'linkedin_message', label: 'LinkedIn' },
                      { id: 'email', label: 'Email' },
                      { id: 'note', label: 'Nota' },
                    ].map(t => (
                      <button key={t.id} onClick={() => setMessageType(t.id)}
                        className={`text-[9px] px-2 py-0.5 rounded transition-all ${messageType === t.id ? 'bg-primary-light/15 text-primary-light' : 'text-gray-600 hover:text-gray-400'}`}>
                        {t.label}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button onClick={() => setMessageDirection(d => d === 'outbound' ? 'inbound' : 'outbound')}
                      className={`text-[9px] px-2 py-0.5 rounded ${messageDirection === 'outbound' ? 'text-blue-400' : 'text-emerald-400'}`}>
                      {messageDirection === 'outbound' ? '↗ Enviado' : '↙ Recibido'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newMessage.trim()) addInteraction(selectedVC.id) }}
                      placeholder={messageDirection === 'outbound' ? 'Que le dijiste...' : 'Que te respondio...'}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary-light/40 outline-none text-white placeholder-gray-500 text-xs" />
                    <button onClick={() => addInteraction(selectedVC.id)} disabled={!newMessage.trim() || savingContact}
                      className="px-3 py-2 bg-primary-light/15 text-primary-light rounded-lg hover:bg-primary-light/25 disabled:opacity-40">
                      {savingContact ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right side — Interview Notes */}
              <div className="w-[32%] flex flex-col">
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold text-white">Notas de Entrevista</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {loadingNotes ? (
                    <div className="text-center py-8"><Loader2 size={16} className="animate-spin mx-auto text-gray-500" /></div>
                  ) : interviewNotes.length > 0 ? (
                    <div className="space-y-3">
                      {interviewNotes.map(note => {
                        const verdictConfig = { advance: { label: 'Avanzar', color: 'bg-emerald-500/15 text-emerald-400', border: 'border-emerald-500/20' }, hold: { label: 'En espera', color: 'bg-amber-500/15 text-amber-400', border: 'border-amber-500/20' }, reject: { label: 'No avanzar', color: 'bg-red-500/15 text-red-400', border: 'border-red-500/20' } }
                        const v = verdictConfig[note.verdict] || verdictConfig.hold
                        const ratingStars = Array.from({ length: 5 }, (_, i) => i < (note.overall_rating || 0))
                        const typeLabels = { phone_screen: 'Filtro telefónico', technical: 'Técnica', behavioral: 'Competencias', cultural: 'Cultural', final: 'Final', client: 'Con cliente' }

                        return (
                          <div key={note.id} className={`rounded-xl p-3.5 border ${v.border}`} style={{ background: note.verdict === 'reject' ? 'rgba(239,68,68,0.04)' : note.verdict === 'advance' ? 'rgba(34,197,94,0.04)' : 'rgba(245,158,11,0.04)' }}>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: note.interview_type === 'technical' ? 'rgba(139,92,246,0.15)' : 'rgba(37,99,235,0.15)', color: note.interview_type === 'technical' ? '#A78BFA' : '#93C5FD' }}>
                                  {typeLabels[note.interview_type] || note.interview_type}
                                </span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v.color}`}>{v.label}</span>
                              </div>
                            </div>

                            {/* Rating */}
                            <div className="flex items-center gap-1 mb-2">
                              {ratingStars.map((filled, i) => (
                                <Star key={i} size={12} className={filled ? 'text-amber-400' : 'text-gray-600'} fill={filled ? 'currentColor' : 'none'} />
                              ))}
                              <span className="text-[10px] text-gray-500 ml-1">{note.overall_rating}/5</span>
                            </div>

                            {/* Strengths */}
                            {note.strengths?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Fortalezas</p>
                                {note.strengths.map((s, i) => (
                                  <div key={i} className="flex items-start gap-1.5 mb-0.5">
                                    <CheckCircle size={9} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-[11px] text-gray-300">{s}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Concerns */}
                            {note.concerns?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Preocupaciones</p>
                                {note.concerns.map((c, i) => (
                                  <div key={i} className="flex items-start gap-1.5 mb-0.5">
                                    <AlertTriangle size={9} className="text-red-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-[11px] text-gray-300">{c}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Notes */}
                            {note.notes && (
                              <p className="text-[11px] text-gray-400 leading-relaxed mt-2 pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                                {note.notes}
                              </p>
                            )}

                            {/* Footer */}
                            <div className="flex items-center gap-2 mt-2 text-[9px] text-gray-600">
                              <span>{note.interviewer}</span>
                              <span>·</span>
                              <span>{new Date(note.interview_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText size={24} className="mx-auto text-gray-700 mb-2" />
                      <p className="text-xs text-gray-600">Sin notas de entrevista</p>
                      <p className="text-[10px] text-gray-700 mt-1">Las notas aparecerán aquí cuando se realicen entrevistas</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
}
