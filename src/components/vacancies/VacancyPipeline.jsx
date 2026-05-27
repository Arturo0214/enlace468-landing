import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, User, Star, X, Mail, Phone, MapPin, ExternalLink, Briefcase, Calendar, Tag, Clock, MessageCircle, Send, Loader2, CheckCircle, ArrowUpRight, ArrowDownLeft, FileText, Video, Link2, UserPlus, Lock, Crown, AlertTriangle, Heart, Copy, Trash2 } from 'lucide-react'
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
  { id: 'offer', label: 'Oferta', color: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'hired', label: 'Contratado', color: 'border-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  { id: 'rejected', label: 'Rechazado', color: 'border-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
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
  const [interviewNotes, setInterviewNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showThankYouModal, setShowThankYouModal] = useState(false)
  const [thankYouSubject, setThankYouSubject] = useState('Agradecimiento por tu participación en nuestro proceso')
  const [thankYouBody, setThankYouBody] = useState('')
  const [keepInBank, setKeepInBank] = useState(true)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [emailsSent, setEmailsSent] = useState(false)
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
    if (result.source.droppableId === newStage) return
    setCandidates(prev => prev.map(c => c.id === vcId ? { ...c, stage: newStage, stage_changed_at: new Date().toISOString() } : c))
    const { error } = await supabase.from('vacancy_candidates').update({ stage: newStage, stage_changed_at: new Date().toISOString() }).eq('id', vcId)
    if (error) { console.error('Drag error:', error); alert('Error al mover: ' + error.message); loadPipeline() }
    else {
      const candidate = candidates.find(c => c.id === vcId)
      await supabase.from('activity_log').insert({ organization_id: profile.organization_id, entity_type: 'vacancy_candidate', entity_id: vcId, action: `${candidate?.candidates?.full_name} → ${stages.find(s => s.id === newStage)?.label}`, details: { vacancy_id: vacancyId, to_stage: newStage }, performed_by: profile.id })

      // Auto-evaluate when moved to "evaluated"
      if (newStage === 'evaluated') {
        await evaluateCandidate(vcId, candidate)
      }

      // When someone is hired, reject all others
      if (newStage === 'hired') {
        const others = candidates.filter(c => c.id !== vcId && !['hired', 'rejected'].includes(c.stage))
        if (others.length > 0) {
          const now = new Date().toISOString()
          const otherIds = others.map(c => c.id)
          await supabase.from('vacancy_candidates').update({ stage: 'rejected', stage_changed_at: now }).in('id', otherIds)
          await supabase.from('vacancies').update({ status: 'closed_filled', closed_at: now, closed_reason: `Candidato contratado: ${candidate?.candidates?.full_name}` }).eq('id', vacancyId)
          loadPipeline()
        }
      }
    }
  }

  async function evaluateCandidate(vcId, vc) {
    const c = vc?.candidates || {}

    // 1. Get interview notes
    const { data: notes } = await supabase.from('interview_notes').select('*').eq('vacancy_candidate_id', vcId)

    // 2. Get vacancy competencies
    const { data: vac } = await supabase.from('vacancies').select('title, description, competencies').eq('id', vacancyId).single()

    // 3. Interview score (avg of ratings, weighted 60%)
    const ratings = (notes || []).filter(n => n.overall_rating).map(n => n.overall_rating)
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
    const interviewScore = (avgRating / 5) * 100 // 0-100

    // 4. CV keyword match (weighted 40%)
    let cvScore = 0
    if (c.cv_url) {
      try {
        const resp = await fetch(c.cv_url)
        if (resp.ok) {
          const cvText = (await resp.text()).toLowerCase()
          const stopwords = new Set(['de','en','el','la','los','las','y','o','a','para','con','del','al','un','una','que','por','su','es','se','no'])
          const vacText = [vac?.title, vac?.description, ...(vac?.competencies || []).map(c => c.name + ' ' + (c.description || ''))].join(' ').toLowerCase()
          const keywords = [...new Set(vacText.split(/[\s,;.:()\-\/]+/).filter(w => w.length > 3 && !stopwords.has(w)))]
          const matched = keywords.filter(kw => cvText.includes(kw))
          cvScore = keywords.length > 0 ? (matched.length / keywords.length) * 100 : 0
        }
      } catch (e) { /* skip */ }
    }

    // 5. Combined score: 60% interview + 40% CV
    const finalScore = Math.round(interviewScore * 0.6 + cvScore * 0.4)

    // 6. Collect strengths/concerns from all notes
    const allStrengths = [...new Set((notes || []).flatMap(n => n.strengths || []))]
    const allConcerns = [...new Set((notes || []).flatMap(n => n.concerns || []))]

    // 7. Determine verdict
    const rejectCount = (notes || []).filter(n => n.verdict === 'reject').length
    const advanceCount = (notes || []).filter(n => n.verdict === 'advance').length
    let recommendation = 'evaluate'
    if (rejectCount > advanceCount) recommendation = 'reject'
    else if (advanceCount > 0 && rejectCount === 0 && finalScore >= 60) recommendation = 'advance'

    // 8. Save
    await supabase.from('vacancy_candidates').update({
      match_score: finalScore,
      match_details: {
        overall_score: finalScore,
        interview_score: Math.round(interviewScore),
        cv_score: Math.round(cvScore),
        interview_count: (notes || []).length,
        avg_rating: avgRating ? Number(avgRating.toFixed(1)) : null,
        strengths: allStrengths.slice(0, 5),
        gaps: allConcerns.slice(0, 5),
        recommendation,
        evaluated_at: new Date().toISOString(),
        pending_questions: allConcerns.length > 0 ? allConcerns.slice(0, 3).map(c => `Validar: ${c}`) : [],
      },
    }).eq('id', vcId)

    // Reload to reflect new score
    loadPipeline()
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
    // Show candidates with meaningful match (>10% keywords or 5+ keywords matched)
    const relevant = scored.filter(c => c._matchScore > 0.10 || c._matchCount >= 5).sort((a, b) => b._matchScore - a._matchScore).slice(0, 10)
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
  async function loadInterviewNotes(vcId) {
    setLoadingNotes(true)
    const { data } = await supabase.from('interview_notes').select('*').eq('vacancy_candidate_id', vcId).order('interview_date', { ascending: false })
    setInterviewNotes(data || [])
    setLoadingNotes(false)
  }

  function openThankYouModal() {
    const vacTitle = candidates[0]?.vacancies?.title || 'la vacante'
    setThankYouBody(`Estimado/a {{nombre}},

Queremos agradecerte sinceramente por tu interés y participación en nuestro proceso de selección para la posición de ${vacTitle || 'esta posición'}.

Después de una evaluación cuidadosa, hemos decidido avanzar con otro perfil que se ajusta más a las necesidades actuales del puesto. Esta decisión no refleja tu valor profesional — tu experiencia y trayectoria son notables.

${keepInBank ? 'Con tu autorización, conservaremos tu perfil en nuestro banco de talento para futuras oportunidades que se alineen mejor con tu perfil. Si prefieres que eliminemos tus datos, solo responde a este correo indicándolo.' : ''}

Te deseamos mucho éxito en tu búsqueda profesional.

Cordialmente,
${profile?.full_name || 'El equipo de reclutamiento'}
Enlace 468`)
    setEmailsSent(false)
    setShowThankYouModal(true)
  }

  async function sendThankYouEmails() {
    setSendingEmails(true)
    const rejected = candidates.filter(c => c.stage === 'rejected' && c.candidates?.email)

    for (const vc of rejected) {
      const c = vc.candidates
      const personalizedBody = thankYouBody.replace(/\{\{nombre\}\}/g, c.full_name?.split(' ')[0] || 'candidato/a')

      // Log as interaction
      await supabase.from('candidate_interactions').insert({
        vacancy_candidate_id: vc.id,
        type: 'email',
        content: `[Agradecimiento] ${thankYouSubject}\n\n${personalizedBody}`,
        direction: 'outbound',
        performed_by: profile.id,
      })

      // Log activity
      await supabase.from('activity_log').insert({
        organization_id: profile.organization_id,
        entity_type: 'vacancy_candidate',
        entity_id: vc.id,
        action: `Correo de agradecimiento enviado a ${c.full_name}`,
        details: { type: 'thank_you_email', keep_in_bank: keepInBank },
        performed_by: profile.id,
      })
    }

    // Open mailto with BCC for mass send
    const emails = rejected.map(vc => vc.candidates?.email).filter(Boolean)
    if (emails.length > 0) {
      const mailto = `mailto:${profile?.email || ''}?bcc=${emails.join(',')}&subject=${encodeURIComponent(thankYouSubject)}&body=${encodeURIComponent(thankYouBody.replace(/\{\{nombre\}\}/g, 'estimado/a candidato/a'))}`
      window.open(mailto, '_blank')
    }

    setEmailsSent(true)
    setSendingEmails(false)
  }

  function openCandidateModal(vc) {
    setSelectedVC(vc)
    setContactNote('')
    setNewMessage('')
    setFirefliesNotes([])
    setCalendarEvents([])
    setInterviewNotes([])
    loadInteractions(vc.id)
    loadInterviewNotes(vc.id)
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
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ height: 'calc(100vh - 330px)' }}>
          {stages.map(stage => {
            const items = candidates.filter(c => c.stage === stage.id)
            return (
              <Droppable key={stage.id} droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}
                    className={`flex-shrink-0 w-56 rounded-xl p-3 border-t-2 flex flex-col ${stage.color} ${snapshot.isDraggingOver ? 'bg-primary/10' : stage.bg}`}
                    style={{ border: '1px solid var(--border-default)', borderTopWidth: '2px' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{stage.label}</h3>
                      <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{items.length}</span>
                    </div>
                    {stage.id === 'rejected' && items.length > 0 && (
                      <button onClick={openThankYouModal}
                        className="w-full mb-2 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-medium transition-all"
                        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#FCA5A5' }}>
                        <Heart size={12} /> Gracias por participar
                      </button>
                    )}
                    <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                      {items.map((vc, index) => (
                        <Draggable key={vc.id} draggableId={vc.id} index={index}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                              onClick={() => !snapshot.isDragging && openCandidateModal(vc)}
                              style={{
                                ...provided.draggableProps.style,
                                ...(stage.id === 'offer'
                                  ? { borderColor: 'rgba(34,197,94,0.5)', background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(16,185,129,0.03))', boxShadow: '0 0 0 1px rgba(34,197,94,0.2), 0 4px 12px rgba(34,197,94,0.08)' }
                                  : vc._interactions?.inbound > 0
                                  ? { borderColor: 'rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.08)', boxShadow: '0 0 0 1px rgba(34,197,94,0.15)' }
                                  : vc._interactions?.pending
                                  ? { borderColor: 'rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.08)', boxShadow: '0 0 0 1px rgba(245,158,11,0.15)' }
                                  : vc._interactions?.noResponse
                                  ? { borderColor: 'rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.08)', boxShadow: '0 0 0 1px rgba(239,68,68,0.15)' }
                                  : {}),
                              }}
                              className={`glass rounded-lg p-3 cursor-grab hover:border-primary/20 transition-all relative overflow-hidden group ${snapshot.isDragging ? 'shadow-lg shadow-primary/10 rotate-2' : ''}`}>
                              {/* Red ribbon for offer */}
                              {stage.id === 'offer' && (
                                <div className="absolute -top-1 -right-1 w-12 h-12 overflow-hidden z-10">
                                  <div className="absolute top-[6px] right-[-14px] w-16 text-center text-[7px] font-bold text-white uppercase tracking-wider py-[2px]" style={{ background: 'linear-gradient(90deg, #DC2626, #EF4444)', transform: 'rotate(45deg)', boxShadow: '0 2px 4px rgba(220,38,38,0.3)' }}>
                                    Oferta
                                  </div>
                                </div>
                              )}
                              {/* Green ribbon for hired */}
                              {stage.id === 'hired' && (
                                <div className="absolute -top-1 -right-1 w-14 h-14 overflow-hidden z-10">
                                  <div className="absolute top-[8px] right-[-12px] w-[72px] text-center text-[7px] font-bold text-white uppercase tracking-wider py-[2px]" style={{ background: 'linear-gradient(90deg, #059669, #10B981)', transform: 'rotate(45deg)', boxShadow: '0 2px 4px rgba(5,150,105,0.3)' }}>
                                    Hired
                                  </div>
                                </div>
                              )}
                              <div className="flex items-start gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-gray-300 flex-shrink-0">
                                  <User size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{vc.candidates?.full_name}</div>
                                  {vc.candidates?.current_title && <div className="text-xs text-gray-400 truncate">{vc.candidates.current_title}</div>}
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-1">
                                {vc.match_score != null && (
                                  <>
                                    <Star size={12} className="text-gold" />
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${scoreColor(vc.match_score)}`}>{Math.round(vc.match_score)}%</span>
                                  </>
                                )}
                                <div className="flex-1" />
                                <button
                                  onClick={e => { e.stopPropagation(); setConfirmDelete(vc) }}
                                  className="text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded p-0.5 transition-all opacity-0 group-hover:opacity-100"
                                  title="Eliminar del pipeline">
                                  <Trash2 size={11} />
                                </button>
                              </div>
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
      })()}

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
      {showThankYouModal && (() => {
        const rejected = candidates.filter(c => c.stage === 'rejected')
        const withEmail = rejected.filter(c => c.candidates?.email)
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowThankYouModal(false)}>
            <div className="bg-theme-surface rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-white/10" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between p-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Heart size={18} className="text-rose-400" />
                    <h2 className="font-display font-bold text-lg text-white">Gracias por participar</h2>
                  </div>
                  <p className="text-xs text-gray-400">Envía un correo de agradecimiento a los candidatos que no avanzaron</p>
                </div>
                <button onClick={() => setShowThankYouModal(false)} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
              </div>

              <div className="p-6 space-y-5">
                {/* Recipients */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Destinatarios ({withEmail.length} con email / {rejected.length} rechazados)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rejected.map(vc => {
                      const c = vc.candidates || {}
                      const hasEmail = !!c.email
                      return (
                        <span key={vc.id} className={`text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 ${hasEmail ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                          {hasEmail ? <Mail size={9} /> : <X size={9} />}
                          {c.full_name?.split(' ').slice(0, 2).join(' ')}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Asunto</label>
                  <input type="text" value={thankYouSubject} onChange={e => setThankYouSubject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white text-sm" />
                </div>

                {/* Body */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Mensaje <span className="text-gray-600 normal-case">(usa {"{{nombre}}"} para personalizar)</span></label>
                  <textarea value={thankYouBody} onChange={e => setThankYouBody(e.target.value)} rows={12}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white text-sm resize-none leading-relaxed" />
                </div>

                {/* Keep in bank toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={keepInBank} onChange={e => setKeepInBank(e.target.checked)}
                    className="w-4 h-4 rounded accent-accent" />
                  <div>
                    <span className="text-sm text-white">Conservar perfiles en banco de talento</span>
                    <p className="text-[11px] text-gray-500">El correo incluirá opción para que el candidato solicite eliminación de sus datos</p>
                  </div>
                </label>

                {/* Success state */}
                {emailsSent && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <p className="text-sm text-emerald-300">Se abrió tu cliente de correo con {withEmail.length} destinatarios. Las interacciones fueron registradas.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6" style={{ borderTop: '1px solid var(--border-default)' }}>
                <button onClick={() => {
                  const text = thankYouBody.replace(/\{\{nombre\}\}/g, '[Nombre]')
                  navigator.clipboard.writeText(text)
                }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
                  <Copy size={12} /> Copiar mensaje
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowThankYouModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
                  <button onClick={sendThankYouEmails} disabled={sendingEmails || withEmail.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 shadow-lg shadow-rose-500/15 transition-all">
                    {sendingEmails ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {sendingEmails ? 'Enviando...' : `Enviar a ${withEmail.length} candidatos`}
                  </button>
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
