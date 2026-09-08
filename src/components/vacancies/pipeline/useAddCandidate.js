import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'

// Estado y acciones del modal "Agregar candidato" (AddCandidateModal):
// alta manual de recomendado (con subida de CV) + sugerencias del banco de
// talento rankeadas por keywords de la vacante. El estado vive en el padre
// para conservar el flujo original (openAddModal es un event handler).
export function useAddCandidate({ vacancyId, candidates, loadPipeline }) {
  const { profile } = useAuth()
  const [showAddModal, setShowAddModal] = useState(false)
  const [bankCandidates, setBankCandidates] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [newCandidate, setNewCandidate] = useState({ full_name: '', current_title: '', current_company: '', linkedin_url: '', email: '', phone: '' })
  const [addingNew, setAddingNew] = useState(false)
  const [cvFile, setCvFile] = useState(null)
  const [cvUploading, setCvUploading] = useState(false)

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

  return {
    showAddModal, setShowAddModal, openAddModal,
    bankCandidates, searchTerm, setSearchTerm,
    newCandidate, setNewCandidate,
    addingNew, cvFile, setCvFile, cvUploading,
    addNewRecommended, addCandidate,
  }
}
