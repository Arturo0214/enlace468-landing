import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { getFirefliesEmails, matchEmailToCandidate, getCalendarEvents, matchEventToCandidate } from '../../../lib/googleApi'

// Estado y acciones del modal de detalle del candidato (CandidateModal):
// interacciones/timeline, marcar contactado, notas de entrevista, datos de
// Google (Fireflies + Calendar) y subida/reemplazo de CV. El estado vive en
// el padre (VacancyPipeline) para conservar el flujo original: todo se
// resetea/carga desde openCandidateModal (event handler), sin effects nuevos.
export function useCandidateModal({ vacancyId, candidates, setCandidates }) {
  const { profile, getProviderToken } = useAuth()
  const [selectedVC, setSelectedVC] = useState(null)
  const [contactNote, setContactNote] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [interactions, setInteractions] = useState([])
  const [loadingInteractions, setLoadingInteractions] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [messageType, setMessageType] = useState('linkedin_message')
  const [interviewNotes, setInterviewNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [messageDirection, setMessageDirection] = useState('outbound')
  const [firefliesNotes, setFirefliesNotes] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [googleError, setGoogleError] = useState(null)
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

  return {
    selectedVC, setSelectedVC, openCandidateModal,
    contactNote, setContactNote, savingContact,
    interactions, loadingInteractions, deleteInteraction, addInteraction,
    newMessage, setNewMessage, messageType, setMessageType,
    messageDirection, setMessageDirection,
    interviewNotes, loadingNotes,
    firefliesNotes, calendarEvents, loadingGoogle, googleError,
    modalCvUploading, uploadCvForCandidate,
    markAsContacted, saveContactNote,
  }
}
