import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, User, Star, X, Mail, Phone, MapPin, ExternalLink, Briefcase, Calendar, Tag, Clock, MessageCircle, Send, Loader2, CheckCircle, ArrowUpRight, ArrowDownLeft, FileText, Video, Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { getFirefliesEmails, matchEmailToCandidate, getCalendarEvents, matchEventToCandidate } from '../../lib/googleApi'

const stages = [
  { id: 'sourced', label: 'Sourced', color: 'border-gray-400' },
  { id: 'contacted', label: 'Contactado', color: 'border-blue-400' },
  { id: 'screening', label: 'Screening', color: 'border-cyan-400' },
  { id: 'interviewing', label: 'Entrevista', color: 'border-purple-400' },
  { id: 'evaluated', label: 'Evaluado', color: 'border-gold' },
  { id: 'presented', label: 'Presentado', color: 'border-accent' },
  { id: 'offer', label: 'Oferta', color: 'border-green-400' },
  { id: 'hired', label: 'Contratado', color: 'border-green-500' },
  { id: 'rejected', label: 'Rechazado', color: 'border-red-400' },
]

export default function VacancyPipeline({ vacancyId }) {
  const { profile, session, getProviderToken } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [bankCandidates, setBankCandidates] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVC, setSelectedVC] = useState(null)
  const [contactNote, setContactNote] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [interactions, setInteractions] = useState([])
  const [loadingInteractions, setLoadingInteractions] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [messageType, setMessageType] = useState('linkedin_message')
  const [messageDirection, setMessageDirection] = useState('outbound')
  const [firefliesNotes, setFirefliesNotes] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [googleError, setGoogleError] = useState(null)

  useEffect(() => { loadPipeline() }, [vacancyId])

  async function loadPipeline() {
    const { data } = await supabase.from('vacancy_candidates').select('*, candidates(*)').eq('vacancy_id', vacancyId).order('created_at')
    setCandidates(data || []); setLoading(false)
  }

  async function handleDragEnd(result) {
    if (!result.destination) return
    const newStage = result.destination.droppableId
    const vcId = result.draggableId
    setCandidates(prev => prev.map(c => c.id === vcId ? { ...c, stage: newStage } : c))
    const { error } = await supabase.from('vacancy_candidates').update({ stage: newStage, stage_changed_at: new Date().toISOString() }).eq('id', vcId)
    if (error) loadPipeline()
    else {
      const candidate = candidates.find(c => c.id === vcId)
      await supabase.from('activity_log').insert({ organization_id: profile.organization_id, entity_type: 'vacancy_candidate', entity_id: vcId, action: `${candidate?.candidates?.full_name} → ${stages.find(s => s.id === newStage)?.label}`, details: { vacancy_id: vacancyId, to_stage: newStage }, performed_by: profile.id })
    }
  }

  async function openAddModal() {
    setShowAddModal(true)
    const existingIds = candidates.map(c => c.candidate_id)
    const { data } = await supabase.from('candidates').select('*').order('full_name')
    setBankCandidates((data || []).filter(c => !existingIds.includes(c.id)))
  }

  async function addCandidate(candidateId) {
    await supabase.from('vacancy_candidates').insert({ vacancy_id: vacancyId, candidate_id: candidateId, stage: 'sourced', assigned_to: profile.id })
    setShowAddModal(false); loadPipeline()
  }

  function scoreColor(score) {
    if (score >= 80) return 'bg-green-500/20 text-green-400'
    if (score >= 60) return 'bg-gold/20 text-gold'
    return 'bg-red-500/20 text-red-400'
  }

  async function markAsContacted(vc, method, url) {
    setSavingContact(true)
    const now = new Date().toISOString()
    const note = contactNote.trim()
    const candidateName = vc.candidates?.full_name

    // Update stage to contacted + save contact info
    await supabase.from('vacancy_candidates').update({
      stage: 'contacted',
      stage_changed_at: now,
      contacted_at: now,
      contacted_via: method,
      contact_notes: note || null,
    }).eq('id', vc.id)

    // Log activity
    await supabase.from('activity_log').insert({
      organization_id: profile.organization_id,
      entity_type: 'vacancy_candidate',
      entity_id: vc.id,
      action: `${candidateName} contactado via ${method}`,
      details: { vacancy_id: vacancyId, method, note, to_stage: 'contacted' },
      performed_by: profile.id,
    })

    // Log interaction
    const { data: interactionData } = await supabase.from('candidate_interactions').insert({
      vacancy_candidate_id: vc.id,
      type: method === 'LinkedIn' ? 'linkedin_message' : method === 'Email' ? 'email' : 'whatsapp',
      content: note || `Primer contacto via ${method}`,
      direction: 'outbound',
      performed_by: profile.id,
    }).select().single()
    if (interactionData) setInteractions(prev => [interactionData, ...prev])

    // Open the link
    if (url) window.open(url, '_blank')

    // Update local state
    setCandidates(prev => prev.map(c => c.id === vc.id ? { ...c, stage: 'contacted', stage_changed_at: now, contacted_at: now, contacted_via: method, contact_notes: note || null } : c))
    setSelectedVC(prev => prev ? { ...prev, stage: 'contacted', stage_changed_at: now, contacted_at: now, contacted_via: method, contact_notes: note || null } : null)
    setContactNote('')
    setSavingContact(false)
  }

  async function saveContactNote(vc) {
    const note = contactNote.trim()
    if (!note) return
    setSavingContact(true)
    await supabase.from('vacancy_candidates').update({ contact_notes: note }).eq('id', vc.id)
    setSelectedVC(prev => prev ? { ...prev, contact_notes: note } : null)
    setCandidates(prev => prev.map(c => c.id === vc.id ? { ...c, contact_notes: note } : c))
    setSavingContact(false)
  }

  async function loadInteractions(vcId) {
    setLoadingInteractions(true)
    const { data } = await supabase.from('candidate_interactions')
      .select('*').eq('vacancy_candidate_id', vcId).order('created_at', { ascending: false })
    setInteractions(data || [])
    setLoadingInteractions(false)
  }

  async function deleteInteraction(id) {
    await supabase.from('candidate_interactions').delete().eq('id', id)
    setInteractions(prev => prev.filter(i => i.id !== id))
  }

  async function addInteraction(vcId) {
    const content = newMessage.trim()
    if (!content) return
    setSavingContact(true)
    const { data } = await supabase.from('candidate_interactions').insert({
      vacancy_candidate_id: vcId,
      type: messageType,
      content,
      direction: messageDirection,
      performed_by: profile.id,
    }).select().single()
    if (data) setInteractions(prev => [data, ...prev])
    setNewMessage('')
    setSavingContact(false)
  }

  async function loadGoogleData(candidateName) {
    const token = getProviderToken()
    if (!token || !candidateName) {
      setFirefliesNotes([])
      setCalendarEvents([])
      return
    }
    setLoadingGoogle(true)
    setGoogleError(null)
    try {
      const [emails, events] = await Promise.all([
        getFirefliesEmails(token).catch(() => []),
        getCalendarEvents(token).catch(() => []),
      ])
      setFirefliesNotes(emails.filter(e => matchEmailToCandidate(e, candidateName)))
      setCalendarEvents(events.filter(e => matchEventToCandidate(e, candidateName)))
    } catch (e) {
      setGoogleError(e.message)
    }
    setLoadingGoogle(false)
  }

  // Load interactions when modal opens
  function openCandidateModal(vc) {
    setSelectedVC(vc)
    setContactNote('')
    setNewMessage('')
    setFirefliesNotes([])
    setCalendarEvents([])
    loadInteractions(vc.id)
    loadGoogleData(vc.candidates?.full_name)
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{candidates.length} candidato{candidates.length !== 1 ? 's' : ''} en pipeline</p>
        <button onClick={openAddModal} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg hover:opacity-90 text-sm font-medium">
          <Plus size={16} /> Agregar candidato
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map(stage => {
            const items = candidates.filter(c => c.stage === stage.id)
            return (
              <Droppable key={stage.id} droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}
                    className={`flex-shrink-0 w-56 rounded-xl p-3 border-t-2 ${stage.color} ${snapshot.isDraggingOver ? 'bg-primary/5' : 'bg-white/[0.03]'}`}
                    style={{ border: '1px solid rgba(255,255,255,0.05)', borderTopWidth: '2px' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{stage.label}</h3>
                      <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{items.length}</span>
                    </div>
                    <div className="space-y-2 min-h-[100px]">
                      {items.map((vc, index) => (
                        <Draggable key={vc.id} draggableId={vc.id} index={index}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                              onClick={() => !snapshot.isDragging && openCandidateModal(vc)}
                              className={`glass rounded-lg p-3 cursor-grab hover:border-primary/20 transition-all ${snapshot.isDragging ? 'shadow-lg shadow-primary/10 rotate-2' : ''}`}>
                              <div className="flex items-start gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-gray-300 flex-shrink-0">
                                  <User size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white truncate">{vc.candidates?.full_name}</div>
                                  {vc.candidates?.current_title && <div className="text-xs text-gray-400 truncate">{vc.candidates.current_title}</div>}
                                </div>
                              </div>
                              {vc.match_score != null && (
                                <div className="mt-2 flex items-center gap-1">
                                  <Star size={12} className="text-gold" />
                                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${scoreColor(vc.match_score)}`}>{Math.round(vc.match_score)}%</span>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            )
          })}
        </div>
      </DragDropContext>

      {/* Candidate detail modal */}
      {selectedVC && (() => {
        const c = selectedVC.candidates || {}
        const currentStage = stages.find(s => s.id === selectedVC.stage)
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVC(null)}>
            <div className="bg-[#111827] rounded-2xl w-full max-w-4xl max-h-[85vh] border border-white/[0.08] flex" onClick={e => e.stopPropagation()}>

              {/* Left side — Candidate info */}
              <div className="w-[55%] overflow-y-auto" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Header */}
                <div className="flex items-start justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${currentStage?.color} bg-white/[0.03]`}>
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
                    {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2 hover:bg-white/[0.06] transition-colors"><Mail size={12} className="text-gray-500" /><span className="text-[11px] text-gray-300 truncate">{c.email}</span></a>}
                    {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2 hover:bg-white/[0.06] transition-colors"><Phone size={12} className="text-gray-500" /><span className="text-[11px] text-gray-300">{c.phone}</span></a>}
                    {c.location && <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2"><MapPin size={12} className="text-gray-500" /><span className="text-[11px] text-gray-300">{c.location}</span></div>}
                    {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener" className="flex items-center gap-2 bg-primary-light/5 rounded-lg px-3 py-2 hover:bg-primary-light/10 border border-primary-light/10"><ExternalLink size={12} className="text-primary-light" /><span className="text-[11px] text-primary-light">LinkedIn</span></a>}
                  </div>

                  {/* Extra info */}
                  {(c.years_experience || c.salary_expectation) && (
                    <div className="grid grid-cols-2 gap-2">
                      {c.years_experience && <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2"><Briefcase size={12} className="text-gray-500" /><span className="text-[11px] text-gray-300">{c.years_experience} años exp.</span></div>}
                      {c.salary_expectation && <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2"><span className="text-gray-500 text-xs font-medium">$</span><span className="text-[11px] text-gray-300">{Number(c.salary_expectation).toLocaleString('es-MX')}</span></div>}
                    </div>
                  )}

                  {/* Tags */}
                  {c.tags?.length > 0 && <div className="flex flex-wrap gap-1.5">{c.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-gray-400"><Tag size={8} className="inline mr-1" />{t}</span>)}</div>}

                  {/* Notes */}
                  {c.notes && <div><p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Notas</p><p className="text-xs text-gray-300 whitespace-pre-wrap">{c.notes}</p></div>}

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
                      { label: 'LinkedIn', url: c.linkedin_url || `https://www.google.com/search?q=site:linkedin.com/in+${encodeURIComponent(c.full_name || '')}` },
                      { label: 'Noticias', url: `https://www.google.com/search?q=${encodeURIComponent(`"${c.full_name}"`)}&tbm=nws` },
                    ].map((s, i) => <a key={i} href={s.url} target="_blank" rel="noopener" className="text-[10px] px-2 py-1 rounded bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08]"><ExternalLink size={8} className="inline mr-0.5" />{s.label}</a>)}
                  </div>
                  <div className="space-y-1">
                    {selectedVC.stage_changed_at && <div className="flex items-center gap-2 text-[10px] text-gray-500"><Clock size={9} />Movido a {currentStage?.label}: {new Date(selectedVC.stage_changed_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</div>}
                    <div className="flex items-center gap-2 text-[10px] text-gray-500"><Calendar size={9} />Agregado: {new Date(selectedVC.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>

              {/* Right side — Conversation */}
              <div className="w-[45%] flex flex-col">
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
                <div className="p-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
                      className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-primary-light/40 outline-none text-white placeholder-gray-500 text-xs" />
                    <button onClick={() => addInteraction(selectedVC.id)} disabled={!newMessage.trim() || savingContact}
                      className="px-3 py-2 bg-primary-light/15 text-primary-light rounded-lg hover:bg-primary-light/25 disabled:opacity-40">
                      {savingContact ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add candidate modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="glass-strong rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-display font-semibold text-white">Agregar candidato</h3>
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por nombre..." className="w-full mt-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" autoFocus />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {bankCandidates.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                <button key={c.id} onClick={() => addCandidate(c.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-left transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-gray-300"><User size={14} /></div>
                  <div><div className="text-sm font-medium text-white">{c.full_name}</div><div className="text-xs text-gray-400">{c.current_title || c.email || 'Sin titulo'}</div></div>
                </button>
              ))}
              {bankCandidates.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No hay candidatos disponibles.</p>
              )}
            </div>
            <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => setShowAddModal(false)} className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
