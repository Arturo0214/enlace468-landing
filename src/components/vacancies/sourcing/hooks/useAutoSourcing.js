import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'

// Sourcing automático server-side: corrida manual rankeada (auto-source),
// términos ganadores, umbral de score, y la config del sourcing nocturno
// (toggle + auto-promoción) que persiste en la vacante.
// Nota: `excludeSector`/`onlyEntrepreneurs`/`platform` viven en el orquestador
// porque también los usa la búsqueda manual (loadMoreLinkedIn / importByUrl).
export default function useAutoSourcing({ vacancy, vacancyId, platform, excludeSector, onlyEntrepreneurs, bankUrls, blockedGlobal, setBankItems, setSavingAll, resultToBankRow }) {
  // Auto-sourcing (server-side ranked prospects)
  const [autoResults, setAutoResults] = useState([])
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoRan, setAutoRan] = useState(false)
  const [autoCounts, setAutoCounts] = useState(null)
  const [autoError, setAutoError] = useState(null)
  const [autoMinScore, setAutoMinScore] = useState(40)
  // Términos "ganadores" del reclutador (cómo se describe la gente que SÍ
  // responde, ej. los filtros de Karina) — persisten en la vacante.
  const [autoTerms, setAutoTerms] = useState('')
  // Sourcing nocturno automático (cron L-V 4/5/6am CDMX) — persiste en la vacante
  const [autoNightly, setAutoNightly] = useState(false)
  const [autoPromoteMin, setAutoPromoteMin] = useState('')
  const [savingNightly, setSavingNightly] = useState(false)

  // Carga los términos ganadores guardados en la vacante
  useEffect(() => { setAutoTerms((vacancy?.search_terms || []).join(', ')) }, [vacancy?.id])

  // Carga la config del sourcing nocturno guardada en la vacante
  useEffect(() => {
    setAutoNightly(!!vacancy?.auto_source_enabled)
    setAutoPromoteMin(vacancy?.auto_promote_min_score ?? '')
  }, [vacancy?.id])

  // ── Sourcing automático ──────────────────────────────────
  // Llama a la Netlify function que busca (Google CSE), excluye aseguradoras,
  // puntúa cada perfil vs la vacante y devuelve solo los buenos, rankeados.
  async function runAutoSource() {
    setAutoLoading(true)
    setAutoError(null)
    setAutoRan(true)
    try {
      // Términos ganadores → se guardan en la vacante para todo el equipo.
      const terms = autoTerms.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4)
      supabase.from('vacancies').update({ search_terms: terms }).eq('id', vacancyId).then(() => {})
      // Semillas lookalike: los candidatos MANUALES del pipeline (los que mejor
      // responden según el equipo) → queries extra + boost a perfiles parecidos.
      let seeds = []
      try {
        const { data: vcSeed } = await supabase.from('vacancy_candidates')
          .select('candidates(current_title, current_company, source, tags)')
          .eq('vacancy_id', vacancyId).limit(200)
        seeds = (vcSeed || []).map(r => r.candidates)
          .filter(c => c && (['manual', 'referral'].includes(c.source) || (c.tags || []).includes('candidato-manual')))
          .map(c => ({ title: c.current_title, company: c.current_company }))
          .filter(s => s.title || s.company).slice(0, 8)
      } catch { /* sin semillas */ }
      const res = await fetch('/api/auto-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancy: {
            title: vacancy.title, location: vacancy.location, department: vacancy.department,
            company_name: vacancy.company_name, description: vacancy.description,
            challenges: vacancy.challenges, competencies: vacancy.competencies || [],
          },
          searchTerms: terms,
          seeds,
          onlyEntrepreneurs,
          platform: platform === 'all' ? 'linkedin' : platform,
          minScore: autoMinScore,
          excludeSector,
          // banco de esta vacante + TODOS los descartados de la org → nunca repetir
          excludeUrls: [...new Set([...bankUrls, ...blockedGlobal])],
          maxResults: 30,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAutoError(data.hint || data.error || 'No se pudo completar el sourcing automático.')
        setAutoResults([])
        setAutoCounts(null)
        return
      }
      // Reordena en cliente con el umbral actual (permite mover el slider sin re-buscar)
      setAutoResults(data.results || [])
      setAutoCounts({ ...data.counts, quotaHit: data.quotaHit })
    } catch (e) {
      setAutoError('No se pudo conectar con el servicio de sourcing.')
      setAutoResults([])
    } finally {
      setAutoLoading(false)
    }
  }

  async function saveAllAuto() {
    const fresh = autoResults.filter(r => !bankUrls.has(r.url))
    if (!fresh.length) return
    setSavingAll(true)
    try {
      const { data } = await supabase.from('sourcing_bank')
        .upsert(fresh.map(resultToBankRow), { onConflict: 'vacancy_id,url', ignoreDuplicates: true })
        .select()
      if (data?.length) {
        setBankItems(prev => {
          const existing = new Set(prev.map(b => b.url))
          return [...data.filter(d => !existing.has(d.url)), ...prev]
        })
      }
    } catch (e) { console.error(e) }
    finally { setSavingAll(false) }
  }

  const autoUnsaved = autoResults.filter(r => !bankUrls.has(r.url)).length

  // ── Sourcing nocturno automático (toggle por vacante) ─────
  // El cron (cron-auto-source.mjs) corre L-V a las 4, 5 y 6am CDMX y solo
  // procesa vacantes con auto_source_enabled=true.
  async function toggleNightly() {
    const next = !autoNightly
    setAutoNightly(next)
    setSavingNightly(true)
    try {
      const { error } = await supabase.from('vacancies')
        .update({ auto_source_enabled: next }).eq('id', vacancyId)
      if (error) { console.error(error); setAutoNightly(!next) }
    } catch (e) { console.error(e); setAutoNightly(!next) }
    finally { setSavingNightly(false) }
  }

  // Umbral de auto-promoción (vacío = no auto-promover). El cron lo LEE pero
  // la auto-promoción arranca apagada (flag interno) hasta validar calidad.
  async function savePromoteMin(raw) {
    const value = String(raw).trim() === '' ? null
      : Math.min(Math.max(parseInt(raw, 10) || 0, 0), 100)
    setAutoPromoteMin(value ?? '')
    try {
      const { error } = await supabase.from('vacancies')
        .update({ auto_promote_min_score: value }).eq('id', vacancyId)
      if (error) console.error(error)
    } catch (e) { console.error(e) }
  }

  return {
    // estado
    autoResults, autoLoading, autoRan, autoCounts, autoError,
    autoMinScore, setAutoMinScore, autoTerms, setAutoTerms,
    autoNightly, autoPromoteMin, setAutoPromoteMin, savingNightly, autoUnsaved,
    // acciones
    runAutoSource, saveAllAuto, toggleNightly, savePromoteMin,
  }
}
