import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { matchExcludedCompany } from '../../../../lib/excludedCompanies'
import { promoteBankItem } from '../../../../lib/promote'
import { normalizeLinkedInUrl } from '../../../../lib/sourcingScore'
import { useToast } from '../../../../lib/toast'

// Banco de sourcing persistente por vacante: guardar/quitar/promover/bloquear
// cards, guardado masivo, export CSV, descartados globales de la organización
// e importación de perfiles de LinkedIn por URL.
export default function useSourcingBank({ profile, vacancy, vacancyId, platform, excludeSector, googleResults, setAddedIds }) {
  const toast = useToast()
  const [savingUrl, setSavingUrl] = useState(null)
  // Sourcing bank (persistent collection of candidate cards, per vacancy)
  const [bankItems, setBankItems] = useState([])
  const [savingAll, setSavingAll] = useState(false)
  const [promotingId, setPromotingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [discardingUrl, setDiscardingUrl] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState(null)
  const [blockedGlobal, setBlockedGlobal] = useState(new Set()) // descartados de TODA la organización

  // Claves CANÓNICAS (normalizeLinkedInUrl): http/https, www/mx, %encoding y
  // slash final cuentan como la MISMA URL — la QA tester descartó al mismo
  // perfil ~3 veces porque las variantes re-entraban como "nuevos".
  const bankUrls = new Set(bankItems.map(b => normalizeLinkedInUrl(b.url))) // incluye guardados Y descartados
  /** ¿La URL (en cualquier variante) ya vive en el banco de esta vacante? */
  const hasUrl = url => bankUrls.has(normalizeLinkedInUrl(url))
  // Banco visible = solo guardados (los descartados se ocultan del banco y de resultados)
  const savedItems = bankItems.filter(b => b.source !== 'descartado')

  // Carga los candidatos DESCARTADOS de toda la organización → nunca reaparecen
  // en ninguna búsqueda (no solo en esta vacante).
  useEffect(() => {
    const orgId = profile?.organization_id
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('sourcing_bank').select('url')
        .eq('organization_id', orgId).eq('source', 'descartado')
      if (!cancelled) setBlockedGlobal(new Set((data || []).map(b => normalizeLinkedInUrl(b.url))))
    })()
    return () => { cancelled = true }
  }, [profile?.organization_id])

  // Load sourcing bank for this vacancy
  useEffect(() => {
    if (!vacancyId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('sourcing_bank').select('*').eq('vacancy_id', vacancyId).order('created_at', { ascending: false })
      if (cancelled) return
      setBankItems(data || [])
    })()
    return () => { cancelled = true }
  }, [vacancyId])

  // ── Sourcing bank ────────────────────────────────────────
  // Turn a raw web result into a bank row (parses LinkedIn "Name - Title - Company")
  function resultToBankRow(result) {
    let name = result.title || '', title = null, company = null
    const isLinkedin = result.url?.includes('linkedin.com')
    if (isLinkedin) {
      const match = name.match(/^(.+?)\s*[-–]\s*(.+?)\s*[-–]\s*(.+?)(?:\s*\|.*)?$/)
      if (match) { name = match[1].trim(); title = match[2].trim(); company = match[3].trim() }
      else { name = name.replace(/\s*\|.*$/, '').trim() }
    }
    // Score del sourcing automático (auto-source.mjs devuelve score/strengths/gaps):
    // se persiste para que el banco quede rankeado y no se pierda el ranking.
    const hasScore = typeof result.score === 'number'
    return {
      organization_id: profile.organization_id, vacancy_id: vacancyId,
      title: result.title, url: result.url, display_url: result.displayUrl || null,
      snippet: result.snippet || null, platform,
      full_name: name || result.title, current_title: title, current_company: company,
      source: isLinkedin ? 'linkedin' : 'web-sourced', created_by: profile.id,
      score: hasScore ? result.score : null,
      score_details: hasScore
        ? { strengths: result.strengths || [], gaps: result.gaps || [] }
        : null,
    }
  }

  async function saveToBank(result) {
    if (hasUrl(result.url)) return
    setSavingUrl(result.url)
    try {
      const { data } = await supabase.from('sourcing_bank').insert(resultToBankRow(result)).select().single()
      if (data) setBankItems(prev => [data, ...prev])
    } catch (e) { console.error(e) }
    finally { setSavingUrl(null) }
  }

  // Save every card from the current search into the bank at once
  async function saveAllToBank() {
    const fresh = googleResults.filter(r => !hasUrl(r.url))
    if (!fresh.length) return
    setSavingAll(true)
    try {
      const { data } = await supabase.from('sourcing_bank')
        .upsert(fresh.map(resultToBankRow), { onConflict: 'vacancy_id,url', ignoreDuplicates: true })
        .select()
      if (data?.length) {
        setBankItems(prev => {
          const existing = new Set(prev.map(b => normalizeLinkedInUrl(b.url)))
          return [...data.filter(d => !existing.has(normalizeLinkedInUrl(d.url))), ...prev]
        })
      }
    } catch (e) { console.error(e) }
    finally { setSavingAll(false) }
  }

  const unsavedCount = googleResults.filter(r => !hasUrl(r.url)).length

  // Notas por candidato (sourcing_bank.notes) — ahí viven las observaciones de
  // la QA tester y las razones de auto-descarte; editable desde el modal.
  const [savingNotesId, setSavingNotesId] = useState(null)
  async function updateNotes(id, notes) {
    setSavingNotesId(id)
    try {
      const { error } = await supabase.from('sourcing_bank').update({ notes: notes?.trim() || null }).eq('id', id)
      if (error) throw error
      setBankItems(prev => prev.map(b => b.id === id ? { ...b, notes: notes?.trim() || null } : b))
      return true
    } catch (e) { console.error(e); return false }
    finally { setSavingNotesId(null) }
  }

  async function removeFromBank(id) {
    setRemovingId(id)
    setBankItems(prev => prev.filter(b => b.id !== id))
    try { await supabase.from('sourcing_bank').delete().eq('id', id) } catch (e) { console.error(e) }
    finally { setRemovingId(null) }
  }

  async function promoteToPipeline(item) {
    setPromotingId(item.id)
    try {
      // Lógica compartida con "Candidatos de hoy" (src/lib/promote.js)
      const data = await promoteBankItem(supabase, { item, vacancyId, profile })
      if (data) {
        setBankItems(prev => prev.map(b => b.id === item.id ? { ...b, candidate_id: data.id } : b))
        setAddedIds(prev => new Set([...prev, data.id]))
      }
    } catch (e) { console.error(e); toast.error(e.message || 'No se pudo promover al pipeline.') }
    finally { setPromotingId(null) }
  }

  function exportBank() {
    if (!savedItems.length) return
    const csv = ['Nombre,Puesto,Empresa,URL,Plataforma,EnPipeline,Notas', ...savedItems.map(b =>
      [b.full_name||b.title||'', b.current_title||'', b.current_company||'', b.url||'', b.platform||'', b.candidate_id ? 'Si' : 'No', b.snippet||''].map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',')
    )].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `banco_sourcing_${vacancy?.title?.replace(/\s/g,'_')}.csv`; a.click()
  }

  // Bloquear/descartar un candidato: lo persiste en el banco como 'descartado'
  // para que NO vuelva a aparecer en futuras búsquedas de esta vacante.
  async function blockResult(result) {
    setDiscardingUrl(result.url)
    try {
      const row = { ...resultToBankRow(result), source: 'descartado' }
      const { data } = await supabase.from('sourcing_bank')
        .upsert(row, { onConflict: 'vacancy_id,url', ignoreDuplicates: true }).select().single()
      // Aunque ignoreDuplicates no devuelva fila, lo agregamos localmente para ocultarlo ya
      const key = normalizeLinkedInUrl(result.url)
      setBankItems(prev => prev.some(b => normalizeLinkedInUrl(b.url) === key) ? prev : [(data || row), ...prev])
      setBlockedGlobal(prev => new Set([...prev, key])) // bloqueo global inmediato
    } catch (e) { console.error(e) }
    finally { setDiscardingUrl(null) }
  }

  // Importar un perfil de LinkedIn por su URL → jala datos → lo guarda al banco.
  async function importByUrl() {
    const url = importUrl.trim()
    if (!url) return
    if (!/linkedin\.com\/in\//i.test(url)) { setImportMsg({ type: 'err', text: 'Pega una URL de perfil (…/in/…).' }); return }
    setImporting(true); setImportMsg(null)
    try {
      const res = await fetch('/api/import-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok || !data.profile) { setImportMsg({ type: 'err', text: data.hint || data.error || 'No se pudo importar.' }); return }
      const p = data.profile
      if (hasUrl(p.url)) { setImportMsg({ type: 'err', text: 'Ese perfil ya está en el banco de esta vacante.' }); return }
      if (excludeSector && matchExcludedCompany(p.current_company, p.current_title, p.snippet, p.full_name)) {
        setImportMsg({ type: 'err', text: 'Ese perfil es del sector asegurador/inversiones (exclusión activa).' }); return
      }
      const row = {
        organization_id: profile.organization_id, vacancy_id: vacancyId,
        title: p.full_name, url: p.url, display_url: p.location ? `linkedin.com · ${p.location}` : 'linkedin.com',
        snippet: p.snippet || null, platform: 'linkedin',
        full_name: p.full_name, current_title: p.current_title, current_company: p.current_company,
        source: 'manual', created_by: profile.id, // pegado a mano por el reclutador
      }
      const { data: saved } = await supabase.from('sourcing_bank').insert(row).select().single()
      if (saved) setBankItems(prev => [saved, ...prev])
      setImportUrl('')
      setImportMsg({ type: 'ok', text: `Importado: ${p.full_name}${p.current_title ? ' · ' + p.current_title : ''}${data.partial ? ' (datos limitados)' : ''}` })
    } catch (e) {
      setImportMsg({ type: 'err', text: 'No se pudo conectar con el importador.' })
    } finally { setImporting(false) }
  }

  return {
    // estado
    bankItems, setBankItems, bankUrls, hasUrl, savedItems, blockedGlobal,
    savingUrl, savingAll, setSavingAll, promotingId, removingId, discardingUrl,
    importUrl, setImportUrl, importing, importMsg, unsavedCount, savingNotesId,
    // acciones
    resultToBankRow, saveToBank, saveAllToBank, removeFromBank, promoteToPipeline,
    exportBank, blockResult, importByUrl, updateNotes,
  }
}
