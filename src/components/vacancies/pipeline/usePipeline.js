import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useStageLabels } from '../../../lib/useStageLabels'
import { PIPELINE_STAGE_DEFS } from './stages'

// Estado y lógica de datos del tablero principal (VacancyPipeline):
// carga de candidatos + resumen de interacciones (en LOTES ≤80), drag&drop
// con actualización optimista, auto-evaluación al llegar a "evaluated",
// rechazo masivo al contratar, reglas SLA y filtro del tablero.
export function usePipeline(vacancyId) {
  const { profile } = useAuth()
  const { getLabel } = useStageLabels()
  const stages = PIPELINE_STAGE_DEFS.map(s => ({ ...s, label: getLabel(s.id) }))
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [boardSearch, setBoardSearch] = useState('') // filtro del tablero por nombre

  // ── SLAs por etapa (FASE 6) ── map stage → max_days de las reglas activas
  // de la org (se carga UNA vez). null = tabla sin migrar / sin reglas / error
  // → simplemente no se pintan badges (tolerante a prod sin la migración).
  const [slaRules, setSlaRules] = useState(null)
  useEffect(() => {
    if (!profile?.organization_id) return
    let alive = true
    supabase
      .from('sla_rules')
      .select('stage, max_days')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (!alive || error || !data?.length) return
        const map = {}
        for (const r of data) map[r.stage] = r.max_days
        setSlaRules(map)
      })
    return () => { alive = false }
  }, [profile?.organization_id])

  // Badge SLA por tarjeta (por TIEMPO en etapa — adicional al semáforo de
  // no-respuesta que sale de las interacciones): ámbar al llegar al 80% del
  // límite de la etapa, rojo al excederlo.
  function slaBadge(vc) {
    if (!slaRules || vc.stage === 'hired' || vc.stage === 'rejected') return null
    const max = slaRules[vc.stage]
    if (!max) return null
    const ref = vc.stage_changed_at || vc.created_at
    if (!ref) return null
    const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000)
    if (days > max) return { days, cls: 'bg-red-500/15 text-red-400', title: `SLA vencido: ${days} días en etapa (límite ${max})` }
    if (days >= Math.ceil(max * 0.8)) return { days, cls: 'bg-amber-500/15 text-amber-400', title: `SLA por vencer: ${days} días en etapa (límite ${max})` }
    return null
  }

  useEffect(() => { loadPipeline() }, [vacancyId])

  async function loadPipeline() {
    // Todo va en try/finally: un error de red aquí (p. ej. un proxy corporativo
    // que rechaza requests) dejaba el spinner girando para siempre.
    try {
    setLoadError(null)
    const { data, error } = await supabase.from('vacancy_candidates').select('*, candidates(*)').eq('vacancy_id', vacancyId).order('created_at')
    if (error) throw error
    const vcs = data || []
    // Load interaction summary per candidate to determine response status
    if (vcs.length > 0) {
      const vcIds = vcs.map(vc => vc.id)
      // En LOTES de 80: con 260 candidatos los ids en la URL suman ~10KB y los
      // proxies corporativos matan el request (pipeline colgado para Karina).
      const ints = []
      for (let i = 0; i < vcIds.length; i += 80) {
        const { data: chunk } = await supabase.from('candidate_interactions').select('vacancy_candidate_id, direction, created_at').in('vacancy_candidate_id', vcIds.slice(i, i + 80))
        if (chunk?.length) ints.push(...chunk)
      }
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
    setCandidates(vcs)
    } catch (e) {
      console.error('loadPipeline:', e)
      setLoadError(e.message || 'Error de red')
    } finally {
      setLoading(false)
    }
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
          // En lotes de 80: con cientos de ids la URL crece a ~10KB y los
          // proxies corporativos la rechazan.
          for (let i = 0; i < otherIds.length; i += 80) {
            await supabase.from('vacancy_candidates').update({ stage: 'rejected', stage_changed_at: now }).in('id', otherIds.slice(i, i + 80))
          }
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

  // Filtro del tablero: insensible a mayúsculas y acentos, por nombre o puesto.
  const normalize = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const q = normalize(boardSearch.trim())
  const matchesSearch = vc => !q || normalize(vc.candidates?.full_name).includes(q) || normalize(vc.candidates?.current_title).includes(q)
  const matchCount = q ? candidates.filter(matchesSearch).length : candidates.length

  return {
    profile,
    getLabel,
    stages,
    candidates,
    setCandidates,
    loading,
    setLoading,
    loadError,
    loadPipeline,
    slaBadge,
    handleDragEnd,
    boardSearch,
    setBoardSearch,
    q,
    matchesSearch,
    matchCount,
  }
}
