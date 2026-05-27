import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, User, Star, X, Mail, Phone, MapPin, ExternalLink, Briefcase, Calendar, Tag, Clock, MessageCircle, Send, Loader2, CheckCircle, ArrowUpRight, ArrowDownLeft, FileText, Video, Link2, UserPlus, Lock, Crown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePlan } from '../../lib/planContext'
import { getFirefliesEmails, matchEmailToCandidate, getCalendarEvents, matchEventToCandidate } from '../../lib/googleApi'

const stages = [
  { id: 'sourced', label: 'Sourced', color: 'border-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/30' },
  { id: 'contacted', label: 'Contactado', color: 'border-blue-400', bg: 'bg-gray-100/60 dark:bg-gray-800/30' },
  { id: 'screening', label: 'Screening', color: 'border-cyan-400', bg: 'bg-gray-100 dark:bg-gray-800/40' },
  { id: 'interviewing', label: 'Entrevista', color: 'border-purple-400', bg: 'bg-gray-200/50 dark:bg-gray-700/30' },
  { id: 'evaluated', label: 'Evaluado', color: 'border-gold', bg: 'bg-gray-200/70 dark:bg-gray-700/40' },
  { id: 'presented', label: 'Presentado', color: 'border-accent', bg: 'bg-gray-200 dark:bg-gray-700/50' },
  { id: 'offer', label: 'Oferta', color: 'border-green-400', bg: 'bg-gray-300/50 dark:bg-gray-600/30' },
  { id: 'hired', label: 'Contratado', color: 'border-green-500', bg: 'bg-gray-300/70 dark:bg-gray-600/40' },
  { id: 'rejected', label: 'Rechazado', color: 'border-red-400', bg: 'bg-gray-300 dark:bg-gray-600/50' },
]

export default function VacancyPipeline({ vacancyId }) {
  const { profile, session, getProviderToken } = useAuth()
  const { canDo } = usePlan()
  const hasBankAccess = canDo('access_candidate_bank')
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
    const vcs = data || []
    // Load interaction summary per candidate to determine response status
    if (vcs.length > 0) {
      const vcIds = vcs.map(vc => vc.id)
      const { data: ints } = await supabase.from('candidate_interactions').select('vacancy_candidate_id, direction, created_at').in('vacancy_candidate_id', vcIds)
      const intMap = {}
      ;(ints || []).forEach(i => {
        if (!intMap[i.vacancy_candidate_id]) intMap[i.vacancy_candidate_id] = { outbound: 0, inbound: 0, lastOutbound: null }
        intMap[i.vacancy_candidate_id][i.direction]++
        if (i.direction === 'outbound') {
          const d = new Date(i.created_at)
          if (!intMap[i.vacancy_candidate_id].lastOutbound || d > intMap[i.vacancy_candidate_id].lastOutbound) {
            intMap[i.vacancy_candidate_id].lastOutbound = d
          }
        }
      })
      const now = Date.now()
      Object.values(intMap).forEach(m => {
        // pending = outbound exists, no inbound, last outbound < 3 days ago
        m.pending = m.outbound > 0 && m.inbound === 0 && m.lastOutbound && (now - m.lastOutbound.getTime()) < 3 * 86400000
        // noResponse = outbound exists, no inbound, last outbound >= 3 days ago
        m.noResponse = m.outbound > 0 && m.inbound === 0 && (!m.lastOutbound || (now - m.lastOutbound.getTime()) >= 3 * 86400000)
      })
      vcs.forEach(vc => { vc._interactions = intMap[vc.id] || null })
    }
    setCandidates(vcs); setLoading(false)
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

  const [newCandidate, setNewCandidate] = useState({ full_name: '', current_title: '', current_company: '', linkedin_url: '', email: '', phone: '' })
  const [addingNew, setAddingNew] = useState(false)
  const [cvFile, setCvFile] = useState(null)
  const [cvUploading, setCvUploading] = useState(false)
  const [modalCvUploading, setModalCvUploading] = useState(false)

  async function uploadCvForCandidate(candidateId, file) {
    if (!file) return
    setModalCvUploading(true)
    const ext = file.name.split('.').pop()
    const path = `cvs/${Date.now()}_${candidateId}.${ext}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
      const cvUrl = urlData?.publicUrl || null
      await supabase.from('candidates').update({ cv_url: cvUrl }).eq('id', candidateId)
      // Update local state
      setCandidates(prev => prev.map(vc => vc.candidate_id === candidateId ? { ...vc, candidates: { ...vc.candidates, cv_url: cvUrl } } : vc))
      setSelectedVC(prev => prev ? { ...prev, candidates: { ...prev.candidates, cv_url: cvUrl } } : null)
    }
    setModalCvUploading(false)
  }

  async function openAddModal() {
    setShowAddModal(true)
    setCvFile(null)
    setNewCandidate({ full_name: '', current_title: '', current_company: '', linkedin_url: '', email: '', phone: '' })
    const existingIds = candidates.map(c => c.candidate_id)

    // Get vacancy details for matching
    const { data: vac } = await supabase.from('vacancies').select('title, description, competencies, department').eq('id', vacancyId).single()
    const { data: allCandidates } = await supabase.from('candidates').select('*').order('full_name')
    const available = (allCandidates || []).filter(c => !existingIds.includes(c.id))

    if (!vac) { setBankCandidates(available); return }

    // Build vacancy keywords
    const stopwords = new Set(['de','en','el','la','los','las','y','o','a','para','con','del','al','un','una','que','por','su','es','se','no','lo','como','más','pero','sin','sobre','ser'])
    const vacText = [vac.title, vac.description, vac.department, ...(vac.competencies || []).map(c => c.name + ' ' + (c.description || ''))].join(' ').toLowerCase()
    const vacKeywords = [...new Set(vacText.split(/[\s,;.:()\-\/]+/).filter(w => w.length > 3 && !stopwords.has(w)))]

    // Score each candidate
    const scored = available.map(c => {
      const cText = [c.full_name, c.current_title, c.current_company, c.notes, (c.tags || []).join(' ')].join(' ').toLowerCase()
      const matched = vacKeywords.filter(kw => cText.includes(kw))
      const score = vacKeywords.length > 0 ? matched.length / vacKeywords.length : 0
      return { ...c, _matchScore: score, _matchCount: matched.length }
    })

    // Only show candidates with at least some match, sorted by score
    const relevant = scored.filter(c => c._matchScore > 0).sort((a, b) => b._matchScore - a._matchScore)
    setBankCandidates(relevant)
  }

  async function addNewRecommended() {
    if (!newCandidate.full_name.trim()) return
    setAddingNew(true)

    let cvUrl = null
    if (cvFile) {
      setCvUploading(true)
      const ext = cvFile.name.split('.').pop()
      const path = `cvs/${Date.now()}_${newCandidate.full_name.trim().replace(/\s+/g, '_')}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage.from('documents').upload(path, cvFile)
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        cvUrl = urlData?.publicUrl || null
      }
      setCvUploading(false)
    }

    const { data } = await supabase.from('candidates').insert({
      organization_id: profile.organization_id,
      full_name: newCandidate.full_name.trim(),
      current_title: newCandidate.current_title || null,
      current_company: newCandidate.current_company || null,
      linkedin_url: newCandidate.linkedin_url || null,
      email: newCandidate.email || null,
      phone: newCandidate.phone || null,
      cv_url: cvUrl,
      source: 'referral',
      tags: ['recomendado'],
    }).select().single()
    if (data) {
      await supabase.from('vacancy_candidates').insert({ vacancy_id: vacancyId, candidate_id: data.id, stage: 'sourced', assigned_to: profile.id })
    }
    setAddingNew(false)
    setCvFile(null)
    setShowAddModal(false)
    loadPipeline()
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

    // Auto-move to "contacted" if first outbound message and still in sourced
    const vc = candidates.find(c => c.id === vcId)
    if (vc && messageDirection === 'outbound' && vc.stage === 'sourced') {
      const now = new Date().toISOString()
      await supabase.from('vacancy_candidates').update({
        stage: 'contacted',
        stage_changed_at: now,
      }).eq('id', vcId)
      setCandidates(prev => prev.map(c => c.id === vcId ? { ...c, stage: 'contacted', stage_changed_at: now } : c))
      setSelectedVC(prev => prev ? { ...prev, stage: 'contacted', stage_changed_at: now } : null)
      await supabase.from('activity_log').insert({
        organization_id: profile.organization_id,
        entity_type: 'vacancy_candidate',
        entity_id: vcId,
        action: `${vc.candidates?.full_name} → Contactado (mensaje registrado)`,
        details: { vacancy_id: vacancyId, to_stage: 'contacted', via: messageType },
        performed_by: profile.id,
      })
    }

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
                    className={`flex-shrink-0 w-56 rounded-xl p-3 border-t-2 ${stage.color} ${snapshot.isDraggingOver ? 'bg-primary/10' : stage.bg}`}
                    style={{ border: '1px solid var(--border-default)', borderTopWidth: '2px' }}>
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
                              style={{
                                ...(vc._interactions?.inbound > 0
                                  ? { borderColor: 'rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.08)', boxShadow: '0 0 0 1px rgba(34,197,94,0.15)' }
                                  : vc._interactions?.pending
                                  ? { borderColor: 'rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.08)', boxShadow: '0 0 0 1px rgba(245,158,11,0.15)' }
                                  : vc._interactions?.noResponse
                                  ? { borderColor: 'rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.08)', boxShadow: '0 0 0 1px rgba(239,68,68,0.15)' }
                                  : {}),
                              }}
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
            <div className="bg-theme-surface rounded-2xl w-full max-w-4xl max-h-[85vh] border border-white/10 flex" onClick={e => e.stopPropagation()}>

              {/* Left side — Candidate info */}
              <div className="w-[55%] overflow-y-auto" style={{ borderRight: '1px solid var(--border-default)' }}>
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
                    ].map((s, i) => <a key={i} href={s.url} target="_blank" rel="noopener" className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"><ExternalLink size={8} className="inline mr-0.5" />{s.label}</a>)}
                  </div>
                  <div className="space-y-1">
                    {selectedVC.stage_changed_at && <div className="flex items-center gap-2 text-[10px] text-gray-500"><Clock size={9} />Movido a {currentStage?.label}: {new Date(selectedVC.stage_changed_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</div>}
                    <div className="flex items-center gap-2 text-[10px] text-gray-500"><Calendar size={9} />Agregado: {new Date(selectedVC.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>

              {/* Right side — Conversation */}
              <div className="w-[45%] flex flex-col">
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
            </div>
          </div>
        )
      })()}

      {/* Add candidate modal — two panels */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-theme-surface rounded-2xl w-full max-w-4xl max-h-[80vh] border border-white/10 flex overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* LEFT: Agregar recomendado */}
            <div className="w-1/2 flex flex-col" style={{ borderRight: '1px solid var(--border-default)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2">
                  <UserPlus size={16} className="text-accent" />
                  <h3 className="font-display font-semibold text-white text-sm">Agregar recomendado</h3>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Agrega un candidato nuevo manualmente</p>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Nombre completo *</label>
                  <input type="text" value={newCandidate.full_name} onChange={e => setNewCandidate(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Nombre del candidato" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Puesto actual</label>
                    <input type="text" value={newCandidate.current_title} onChange={e => setNewCandidate(p => ({ ...p, current_title: e.target.value }))}
                      placeholder="Título" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Empresa</label>
                    <input type="text" value={newCandidate.current_company} onChange={e => setNewCandidate(p => ({ ...p, current_company: e.target.value }))}
                      placeholder="Empresa" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">LinkedIn URL</label>
                  <input type="url" value={newCandidate.linkedin_url} onChange={e => setNewCandidate(p => ({ ...p, linkedin_url: e.target.value }))}
                    placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Email</label>
                    <input type="email" value={newCandidate.email} onChange={e => setNewCandidate(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@ejemplo.com" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Teléfono</label>
                    <input type="tel" value={newCandidate.phone} onChange={e => setNewCandidate(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+52 55 1234 5678" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                  </div>
                </div>
                {/* CV Upload */}
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">CV (PDF, Word)</label>
                  <label className="flex items-center gap-3 px-3 py-3 rounded-lg border-2 border-dashed border-white/10 hover:border-primary/30 cursor-pointer transition-colors">
                    <FileText size={18} className={cvFile ? 'text-accent' : 'text-gray-600'} />
                    <div className="flex-1 min-w-0">
                      {cvFile ? (
                        <div>
                          <p className="text-xs text-white font-medium truncate">{cvFile.name}</p>
                          <p className="text-[10px] text-gray-500">{(cvFile.size / 1024).toFixed(0)} KB</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Click para seleccionar archivo</p>
                      )}
                    </div>
                    {cvFile && (
                      <button type="button" onClick={e => { e.preventDefault(); setCvFile(null) }} className="text-gray-500 hover:text-red-400 p-0.5">
                        <X size={14} />
                      </button>
                    )}
                    <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => setCvFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
              <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                <button onClick={addNewRecommended} disabled={!newCandidate.full_name.trim() || addingNew || cvUploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent to-accent-light text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
                  {addingNew || cvUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {cvUploading ? 'Subiendo CV...' : 'Agregar recomendado'}
                </button>
              </div>
            </div>

            {/* RIGHT: Top candidatos del banco (requires upgrade) */}
            <div className="w-1/2 flex flex-col">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-gold" />
                  <h3 className="font-display font-semibold text-white text-sm">Candidatos relevantes del banco</h3>
                  {!hasBankAccess && <span className="text-[9px] px-2 py-0.5 rounded-full bg-gold/15 text-gold font-bold uppercase tracking-wider">Premium</span>}
                </div>
                {hasBankAccess && (
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o puesto..."
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                )}
              </div>

              {hasBankAccess ? (
                <>
                  <div className="flex-1 overflow-y-auto p-2">
                    {bankCandidates
                      .filter(c => {
                        const q = searchTerm.toLowerCase()
                        return c.full_name.toLowerCase().includes(q) || (c.current_title || '').toLowerCase().includes(q) || (c.current_company || '').toLowerCase().includes(q)
                      })
                      .sort((a, b) => (b.years_experience || 0) - (a.years_experience || 0))
                      .map(c => (
                      <button key={c.id} onClick={() => addCandidate(c.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-left transition-colors group">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-gray-300 flex-shrink-0 text-xs font-bold">
                          {c.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{c.full_name}</div>
                          <div className="text-xs text-gray-400 truncate">{c.current_title || 'Sin título'}{c.current_company ? ` · ${c.current_company}` : ''}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {c.years_experience && <span className="text-[10px] text-gray-500">{c.years_experience} años exp.</span>}
                            {c._matchCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">{c._matchCount} keywords</span>}
                          </div>
                        </div>
                        <Plus size={14} className="text-gray-600 group-hover:text-accent flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                    {bankCandidates.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                      <div className="text-center py-10">
                        <User size={24} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500">No hay candidatos en el banco que hagan match con esta vacante</p>
                        <p className="text-[11px] text-gray-600 mt-1">Usa el panel izquierdo para agregar un recomendado</p>
                      </div>
                    )}
                  </div>
                  <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                    <button onClick={() => setShowAddModal(false)} className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors">Cerrar</button>
                  </div>
                </>
              ) : (
                /* Upgrade CTA */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/20 to-amber-500/10 flex items-center justify-center mb-5">
                    <Lock size={28} className="text-gold" />
                  </div>
                  <h4 className="font-display font-bold text-white text-lg mb-2">Banco de Talento Inteligente</h4>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed max-w-xs">
                    Accede a tu banco de candidatos con match score, filtros avanzados y recomendaciones de IA para cada vacante.
                  </p>
                  <div className="space-y-2 mb-6 w-full max-w-xs">
                    {['Candidatos rankeados por match', 'Filtro por skills e industria', 'Historial de interacciones', 'Recomendaciones por vacante'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-gray-300">
                        <CheckCircle size={12} className="text-gold flex-shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                  <a href="/#precios" onClick={() => setShowAddModal(false)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-gold to-amber-500 text-white font-bold text-sm shadow-lg shadow-gold/20 hover:shadow-gold/40 hover:-translate-y-0.5 transition-all">
                    <Crown size={16} /> Desbloquear con Enterprise
                  </a>
                  <p className="text-[10px] text-gray-600 mt-3">Disponible en Enterprise Starter, Growth y Partner</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
