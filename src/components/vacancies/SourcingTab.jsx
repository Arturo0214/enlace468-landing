import { useState, useEffect, useRef } from 'react'
import { Search, Globe, ExternalLink, Plus, Loader2, CheckCircle, Download, Users, X, Mail, Phone, MapPin, Star, Archive, Trash2, Save, Sparkles, SlidersHorizontal, Ban, Link2, Copy, MessageSquare, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import FeatureGate from '../ui/FeatureGate'
import { matchExcludedCompany, NEGATIVE_QUERY, EXCLUDED_LABELS_SHORT } from '../../lib/excludedCompanies'

const CSE_ID = '234e26a7d970d4e6f'

export default function SourcingTab({ vacancy, profile, vacancyId, addedIds, setAddedIds, addingId, setAddingId, setActiveTab }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [localResults, setLocalResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [platform, setPlatform] = useState('linkedin')
  const [savingUrl, setSavingUrl] = useState(null)
  const [googleResults, setGoogleResults] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Sourcing bank (persistent collection of candidate cards, per vacancy)
  const [bankItems, setBankItems] = useState([])
  const [savingAll, setSavingAll] = useState(false)
  const [promotingId, setPromotingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  // Auto-sourcing (server-side ranked prospects)
  const [autoResults, setAutoResults] = useState([])
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoRan, setAutoRan] = useState(false)
  const [autoCounts, setAutoCounts] = useState(null)
  const [autoError, setAutoError] = useState(null)
  const [autoMinScore, setAutoMinScore] = useState(40)
  const [excludeSector, setExcludeSector] = useState(true) // excluir aseguradoras/inversiones (Prudential)
  const [discardingUrl, setDiscardingUrl] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState(null)
  const [draftChannel, setDraftChannel] = useState('linkedin_message')
  const [draftLoading, setDraftLoading] = useState(false)
  const [draft, setDraft] = useState(null)
  const [draftCopied, setDraftCopied] = useState(false)
  const [blockedGlobal, setBlockedGlobal] = useState(new Set()) // descartados de TODA la organización
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [activity, setActivity] = useState({ invitations: [], connections: [], conversations: [], counts: {} })
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [ourOutreach, setOurOutreach] = useState([]) // envíos registrados por el CRM (sourcing_bank)
  const cseRendered = useRef(false)
  const observerRef = useRef(null)
  const debounceRef = useRef(null)
  const isLoadingMore = useRef(false)
  const seenUrls = useRef(new Set())
  const loadMoreTimeout = useRef(null)
  const scrapedMore = useRef(false) // ya se jaló el lote extra del scraper (LinkedIn)

  const platforms = {
    linkedin: { label: 'LinkedIn', prefix: 'site:mx.linkedin.com/in', color: 'border-blue-500/30 text-blue-400' },
    occ: { label: 'OCC', prefix: 'site:occ.com.mx', color: 'border-emerald-500/30 text-emerald-400' },
    indeed: { label: 'Indeed', prefix: 'site:mx.indeed.com', color: 'border-indigo-500/30 text-indigo-400' },
    computrabajo: { label: 'CompuTrabajo', prefix: 'site:computrabajo.com.mx', color: 'border-orange-500/30 text-orange-400' },
    all: { label: 'Todos', prefix: '', color: 'border-white/20 text-white' },
  }

  const bankUrls = new Set(bankItems.map(b => b.url)) // incluye guardados Y descartados
  // Banco visible = solo guardados (los descartados se ocultan del banco y de resultados)
  const savedItems = bankItems.filter(b => b.source !== 'descartado')

  // Limpia el draft de IA al abrir otro candidato
  useEffect(() => { setDraft(null); setDraftCopied(false); setSendResult(null) }, [selectedCandidate])

  // Carga los candidatos DESCARTADOS de toda la organización → nunca reaparecen
  // en ninguna búsqueda (no solo en esta vacante).
  useEffect(() => {
    const orgId = profile?.organization_id
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('sourcing_bank').select('url')
        .eq('organization_id', orgId).eq('source', 'descartado')
      if (!cancelled) setBlockedGlobal(new Set((data || []).map(b => b.url)))
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

  // Dark CSS for CSE widget
  useEffect(() => {
    if (document.getElementById('gcs-css')) return
    const style = document.createElement('style')
    style.id = 'gcs-css'
    style.textContent = `
      #gcs-box .gsc-control-cse{background:transparent!important;border:none!important;padding:0!important;font-family:inherit!important}
      #gcs-box .gsc-above-wrapper-area,#gcs-box .gsc-adBlock,#gcs-box .gcsc-find-more-on-google,#gcs-box .gsc-search-box,#gcs-box .gsc-orderby-container{display:none!important}
      #gcs-box .gsc-resultsbox-visible{padding:0!important}
      #gcs-box .gsc-result-info{color:#6b7280!important;font-size:11px!important;margin-bottom:10px!important}
      #gcs-box .gsc-webResult.gsc-result{padding:0!important;margin-bottom:8px!important;border:none!important;background:transparent!important}
      #gcs-box .gsc-result .gs-result{background:rgba(255,255,255,0.02)!important;border:1px solid rgba(255,255,255,0.06)!important;border-radius:12px!important;padding:14px!important;transition:all 0.15s!important}
      #gcs-box .gsc-result .gs-result:hover{border-color:rgba(99,140,255,0.25)!important;background:rgba(255,255,255,0.04)!important}
      #gcs-box .gs-title a,#gcs-box .gs-title a b{color:#fff!important;text-decoration:none!important;font-size:14px!important;font-weight:600!important}
      #gcs-box .gs-title a:hover{color:#7cacff!important}
      #gcs-box .gs-snippet{color:#9ca3af!important;font-size:12px!important;line-height:1.5!important}
      #gcs-box .gs-snippet b{color:#d1d5db!important}
      #gcs-box .gs-visibleUrl,.gs-visibleUrl-long,.gs-visibleUrl-short{color:rgba(52,211,153,0.6)!important;font-size:11px!important}
      #gcs-box .gs-image-box,#gcs-box .gs-promotion{display:none!important}
      #gcs-box .gsc-table-result,#gcs-box .gsc-thumbnail-inside,#gcs-box .gsc-url-top{padding:0!important}
      #gcs-box .gsc-cursor-box{text-align:center!important;margin-top:16px!important;padding:8px 0!important}
      #gcs-box .gsc-cursor-page{display:inline-block!important;padding:6px 12px!important;margin:0 3px!important;border-radius:8px!important;color:#9ca3af!important;cursor:pointer!important;font-size:12px!important;background:rgba(255,255,255,0.03)!important;border:1px solid rgba(255,255,255,0.06)!important}
      #gcs-box .gsc-cursor-page:hover{color:#fff!important;background:rgba(255,255,255,0.06)!important}
      #gcs-box .gsc-cursor-current-page{color:#fff!important;background:rgba(99,140,255,0.15)!important;border-color:rgba(99,140,255,0.3)!important}
      #gcs-box .gs-no-results-result .gs-snippet{color:#6b7280!important;text-align:center!important;padding:20px!important}
    `
    document.head.appendChild(style)
  }, [])

  // Load CSE script
  useEffect(() => {
    if (document.querySelector('script[src*="cse.google.com/cse.js"]')) {
      renderCSE()
      return
    }
    window.__gcse = {
      parsetags: 'explicit',
      callback: () => renderCSE()
    }
    const s = document.createElement('script')
    s.src = `https://cse.google.com/cse.js?cx=${CSE_ID}`
    s.async = true
    document.head.appendChild(s)
  }, [])

  function renderCSE() {
    if (cseRendered.current) return
    const waitForBox = setInterval(() => {
      const container = document.getElementById('gcs-box')
      if (!container || !window.google?.search?.cse?.element) return
      clearInterval(waitForBox)

      try {
        window.google.search.cse.element.render({ div: 'gcs-box', tag: 'searchresults-only', gname: 'sourcing' })
        cseRendered.current = true
      } catch {}

      // MutationObserver to capture results
      observerRef.current = new MutationObserver(() => {
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          const noRes = container.querySelector('.gs-no-results-result')
          if (noRes) { setGoogleResults([]); return }

          let els = container.querySelectorAll('.gsc-webResult.gsc-result')
          if (!els.length) els = container.querySelectorAll('.gsc-result')
          if (!els.length) return

          const parsed = Array.from(els).map(el => {
            const a = el.querySelector('.gs-title a') || el.querySelector('a[data-ctorig]')
            const sn = el.querySelector('.gs-snippet')
            const u = el.querySelector('.gs-visibleUrl-long') || el.querySelector('.gs-visibleUrl-short')
            if (!a) return null
            return {
              title: a.textContent?.trim(),
              url: a.getAttribute('data-ctorig') || a.href,
              displayUrl: u?.textContent?.trim() || '',
              snippet: sn?.textContent?.trim() || '',
            }
          }).filter(r => r && r.title && r.url && !r.url.includes('google.com/search'))
            // Drop candidates from excluded firms (insurance / investment sector)
            .filter(r => !matchExcludedCompany(r.title, r.snippet, r.displayUrl))

          // Only keep results we haven't shown yet (dedupe by URL across pages)
          const fresh = parsed.filter(r => !seenUrls.current.has(r.url))

          if (isLoadingMore.current) {
            // Waiting for the next page after "Mostrar más" — append only when new results arrive
            if (fresh.length) {
              fresh.forEach(r => seenUrls.current.add(r.url))
              setGoogleResults(prev => [...prev, ...fresh])
              isLoadingMore.current = false
              setLoadingMore(false)
              clearTimeout(loadMoreTimeout.current)
            }
          } else if (parsed.length) {
            // Fresh search render — replace
            seenUrls.current = new Set(parsed.map(r => r.url))
            setGoogleResults(parsed)
          }

          // LinkedIn/Todos: siempre ofrecer "Ver más" (scraper) hasta que se jale.
          if (platform === 'linkedin' || platform === 'all') {
            setHasMore(!scrapedMore.current)
          } else {
            const pages = container.querySelectorAll('.gsc-cursor-page')
            const idx = Array.from(pages).findIndex(p => p.classList.contains('gsc-cursor-current-page'))
            setHasMore(idx >= 0 && idx + 1 < pages.length)
          }
        }, 400)
      })
      observerRef.current.observe(container, { childList: true, subtree: true })
    }, 300)
  }

  // Execute search
  useEffect(() => {
    if (!activeSearch) { setGoogleResults([]); setHasMore(false); return }
    setGoogleResults([])
    isLoadingMore.current = false
    setLoadingMore(false)
    seenUrls.current = new Set()
    scrapedMore.current = false
    const tryExec = setInterval(() => {
      const el = window.google?.search?.cse?.element?.getElement('sourcing')
      if (el) { clearInterval(tryExec); el.execute(activeSearch) }
    }, 200)
    const timeout = setTimeout(() => clearInterval(tryExec), 15000)
    return () => { clearInterval(tryExec); clearTimeout(timeout) }
  }, [activeSearch])

  // "Ver más" para LinkedIn: el widget CSE solo trae ~10 y su paginación es
  // frágil. Traemos más desde el scraper server-side (hasta ~40 confiables).
  async function loadMoreLinkedIn() {
    setLoadingMore(true)
    try {
      const res = await fetch('/api/auto-source', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancy: { title: searchQuery, location: vacancy.location || '', competencies: [] },
          platform: 'linkedin', minScore: 0, maxResults: 100, excludeSector,
        }),
      })
      const data = await res.json()
      const mapped = (data.results || []).map(r => ({
        title: [r.full_name, r.current_title].filter(Boolean).join(' - ') || r.full_name,
        url: r.url, displayUrl: r.displayUrl || 'linkedin.com', snippet: r.snippet || '',
      })).filter(r => r.url && !seenUrls.current.has(r.url))
      if (mapped.length) {
        mapped.forEach(r => seenUrls.current.add(r.url))
        setGoogleResults(prev => [...prev, ...mapped])
      }
      scrapedMore.current = true
      setHasMore(false) // el scraper ya trae el lote completo
    } catch (e) { console.error(e) }
    finally { setLoadingMore(false) }
  }

  function loadMore() {
    // Para LinkedIn/Todos usamos el scraper (confiable). Otros portales: cursor CSE.
    if (platform === 'linkedin' || platform === 'all') { loadMoreLinkedIn(); return }
    const container = document.getElementById('gcs-box')
    if (!container) return
    const pages = Array.from(container.querySelectorAll('.gsc-cursor-page'))
    const idx = pages.findIndex(p => p.classList.contains('gsc-cursor-current-page'))
    const next = idx >= 0 ? pages[idx + 1] : pages.find(p => !p.classList.contains('gsc-cursor-current-page'))
    if (!next) { setHasMore(false); return }
    isLoadingMore.current = true
    setLoadingMore(true)
    // Fallback: if no new results arrive, release the flag so the button can be retried
    clearTimeout(loadMoreTimeout.current)
    loadMoreTimeout.current = setTimeout(() => { isLoadingMore.current = false; setLoadingMore(false) }, 6000)
    // CSE cursor pages respond to a real anchor click event
    next.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  }

  function doSearch(q, plat) {
    const query = q || searchQuery
    if (!query.trim()) return
    const p = platforms[plat || platform]
    const base = p.prefix ? `${p.prefix} ${query}` : query
    const fullQuery = `${base} ${NEGATIVE_QUERY}`.trim()
    setActiveSearch(fullQuery)
    handleLocalSearch(query)
  }

  async function handleLocalSearch(q) {
    setSearching(true)
    try {
      const terms = q.replace(/"/g, '').split(/\s+/).filter(t => t.length > 1)
      if (terms.length > 0) {
        const orClauses = terms.flatMap(t => [`full_name.ilike.%${t}%`, `current_title.ilike.%${t}%`, `current_company.ilike.%${t}%`]).join(',')
        const { data } = await supabase.from('candidates').select('*').or(orClauses).limit(50)
        setLocalResults((data || [])
          .filter(c => !matchExcludedCompany(c.current_company, c.current_title, c.full_name, c.notes))
          .map(c => ({
            full_name: c.full_name, current_title: c.current_title, current_company: c.current_company,
            linkedin_url: c.linkedin_url, location: c.location, source: c.source,
            snippet: c.notes, tags: c.tags, _existing_id: c.id, email: c.email, phone: c.phone,
          })))
      }
    } catch(e) { console.error(e) }
    finally { setSearching(false) }
  }

  async function addToBank(candidate) {
    const key = candidate.linkedin_url || candidate.full_name
    setAddingId(key)
    try {
      const { data } = await supabase.from('candidates').insert({
        organization_id: profile.organization_id, full_name: candidate.full_name,
        current_title: candidate.current_title || null, current_company: candidate.current_company || null,
        linkedin_url: candidate.linkedin_url || null, location: candidate.location || null,
        source: 'sourced', tags: ['sourced'],
      }).select().single()
      if (data) await supabase.from('vacancy_candidates').insert({ vacancy_id: vacancyId, candidate_id: data.id, stage: 'sourced', assigned_to: profile.id })
      setAddedIds(prev => new Set([...prev, key]))
    } catch(e) {}
    finally { setAddingId(null) }
  }

  async function addExisting(candidateId) {
    setAddingId(candidateId)
    try {
      await supabase.from('vacancy_candidates').insert({ vacancy_id: vacancyId, candidate_id: candidateId, stage: 'sourced', assigned_to: profile.id })
      setAddedIds(prev => new Set([...prev, candidateId]))
    } catch(e) {}
    finally { setAddingId(null) }
  }

  function exportResults() {
    if (!localResults.length) return
    const csv = ['Nombre,Puesto,Empresa,LinkedIn,Ubicacion,Email,Telefono', ...localResults.map(c =>
      [c.full_name, c.current_title||'', c.current_company||'', c.linkedin_url||'', c.location||'', c.email||'', c.phone||''].map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',')
    )].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `sourcing_${vacancy?.title?.replace(/\s/g,'_')}.csv`; a.click()
  }

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
    return {
      organization_id: profile.organization_id, vacancy_id: vacancyId,
      title: result.title, url: result.url, display_url: result.displayUrl || null,
      snippet: result.snippet || null, platform,
      full_name: name || result.title, current_title: title, current_company: company,
      source: isLinkedin ? 'linkedin' : 'web-sourced', created_by: profile.id,
    }
  }

  async function saveToBank(result) {
    if (bankUrls.has(result.url)) return
    setSavingUrl(result.url)
    try {
      const { data } = await supabase.from('sourcing_bank').insert(resultToBankRow(result)).select().single()
      if (data) setBankItems(prev => [data, ...prev])
    } catch (e) { console.error(e) }
    finally { setSavingUrl(null) }
  }

  // Save every card from the current search into the bank at once
  async function saveAllToBank() {
    const fresh = googleResults.filter(r => !bankUrls.has(r.url))
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

  const unsavedCount = googleResults.filter(r => !bankUrls.has(r.url)).length

  async function removeFromBank(id) {
    setRemovingId(id)
    setBankItems(prev => prev.filter(b => b.id !== id))
    try { await supabase.from('sourcing_bank').delete().eq('id', id) } catch (e) { console.error(e) }
    finally { setRemovingId(null) }
  }

  async function promoteToPipeline(item) {
    setPromotingId(item.id)
    try {
      const isLinkedin = item.url?.includes('linkedin.com')
      const { data } = await supabase.from('candidates').insert({
        organization_id: profile.organization_id, full_name: item.full_name || item.title,
        current_title: item.current_title || null, current_company: item.current_company || null,
        linkedin_url: isLinkedin ? item.url : null,
        source: 'web-sourced', notes: item.snippet || null, tags: ['web-sourced'],
      }).select().single()
      if (data) {
        await supabase.from('vacancy_candidates').insert({ vacancy_id: vacancyId, candidate_id: data.id, stage: 'sourced', assigned_to: profile.id })
        await supabase.from('sourcing_bank').update({ candidate_id: data.id }).eq('id', item.id)
        setBankItems(prev => prev.map(b => b.id === item.id ? { ...b, candidate_id: data.id } : b))
        setAddedIds(prev => new Set([...prev, data.id]))
      }
    } catch (e) { console.error(e) }
    finally { setPromotingId(null) }
  }

  function exportBank() {
    if (!savedItems.length) return
    const csv = ['Nombre,Puesto,Empresa,URL,Plataforma,EnPipeline,Notas', ...savedItems.map(b =>
      [b.full_name||b.title||'', b.current_title||'', b.current_company||'', b.url||'', b.platform||'', b.candidate_id ? 'Si' : 'No', b.snippet||''].map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',')
    )].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `banco_sourcing_${vacancy?.title?.replace(/\s/g,'_')}.csv`; a.click()
  }

  // ── Sourcing automático ──────────────────────────────────
  // Llama a la Netlify function que busca (Google CSE), excluye aseguradoras,
  // puntúa cada perfil vs la vacante y devuelve solo los buenos, rankeados.
  async function runAutoSource() {
    setAutoLoading(true)
    setAutoError(null)
    setAutoRan(true)
    try {
      const res = await fetch('/api/auto-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancy: {
            title: vacancy.title, location: vacancy.location, department: vacancy.department,
            company_name: vacancy.company_name, description: vacancy.description,
            challenges: vacancy.challenges, competencies: vacancy.competencies || [],
          },
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

  // Bloquear/descartar un candidato: lo persiste en el banco como 'descartado'
  // para que NO vuelva a aparecer en futuras búsquedas de esta vacante.
  async function blockResult(result) {
    setDiscardingUrl(result.url)
    try {
      const row = { ...resultToBankRow(result), source: 'descartado' }
      const { data } = await supabase.from('sourcing_bank')
        .upsert(row, { onConflict: 'vacancy_id,url', ignoreDuplicates: true }).select().single()
      // Aunque ignoreDuplicates no devuelva fila, lo agregamos localmente para ocultarlo ya
      setBankItems(prev => prev.some(b => b.url === result.url) ? prev : [(data || row), ...prev])
      setBlockedGlobal(prev => new Set([...prev, result.url])) // bloqueo global inmediato
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
      if (bankUrls.has(p.url)) { setImportMsg({ type: 'err', text: 'Ese perfil ya está en el banco de esta vacante.' }); return }
      if (excludeSector && matchExcludedCompany(p.current_company, p.current_title, p.snippet, p.full_name)) {
        setImportMsg({ type: 'err', text: 'Ese perfil es del sector asegurador/inversiones (exclusión activa).' }); return
      }
      const row = {
        organization_id: profile.organization_id, vacancy_id: vacancyId,
        title: p.full_name, url: p.url, display_url: p.location ? `linkedin.com · ${p.location}` : 'linkedin.com',
        snippet: p.snippet || null, platform: 'linkedin',
        full_name: p.full_name, current_title: p.current_title, current_company: p.current_company,
        source: 'linkedin', created_by: profile.id,
      }
      const { data: saved } = await supabase.from('sourcing_bank').insert(row).select().single()
      if (saved) setBankItems(prev => [saved, ...prev])
      setImportUrl('')
      setImportMsg({ type: 'ok', text: `Importado: ${p.full_name}${p.current_title ? ' · ' + p.current_title : ''}${data.partial ? ' (datos limitados)' : ''}` })
    } catch (e) {
      setImportMsg({ type: 'err', text: 'No se pudo conectar con el importador.' })
    } finally { setImporting(false) }
  }

  // Carga las invitaciones enviadas por LinkedIn (Unipile) para el tablero.
  const [connectingAccount, setConnectingAccount] = useState(false)
  // Genera el link de Unipile y lo abre para conectar/cambiar la cuenta de LinkedIn.
  async function connectLinkedInAccount() {
    setConnectingAccount(true)
    try {
      const res = await fetch('/api/linkedin-connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_url: window.location.href }),
      })
      const data = await res.json()
      if (data.ok && data.url) window.open(data.url, '_blank', 'noopener')
      else alert(data.hint || 'No se pudo generar el link de conexión.')
    } catch (e) { alert('No se pudo conectar con el servicio.') }
    finally { setConnectingAccount(false) }
  }

  async function loadActivity() {
    setActivityLoading(true)
    try {
      const res = await fetch('/api/linkedin-activity')
      const data = await res.json()
      if (res.ok && data.ok) setActivity({ invitations: data.invitations || [], connections: data.connections || [], conversations: data.conversations || [], counts: data.counts || {} })
    } catch (e) { /* silencioso */ }
    finally { setActivityLoading(false) }
  }
  useEffect(() => { loadActivity() }, [])

  // Nuestro outreach registrado en el CRM (toda la organización, cualquier vacante)
  async function loadOurOutreach() {
    const orgId = profile?.organization_id
    if (!orgId) return
    const { data } = await supabase.from('sourcing_bank')
      .select('url, full_name, contact_status, contact_channel, contacted_at, contact_message, provider_id')
      .eq('organization_id', orgId).not('contact_status', 'is', null)
      .order('contacted_at', { ascending: false })
    setOurOutreach(data || [])
  }
  useEffect(() => { loadOurOutreach() }, [profile?.organization_id])

  const slugOfUrl = (url = '') => { const m = String(url).match(/\/in\/([^/?#]+)/i); return m ? decodeURIComponent(m[1]).toLowerCase() : '' }
  // Estado por candidato: usamos NUESTRO registro (invitado) + Unipile (conectado)
  const connectedSlugs = new Set(activity.connections.map(c => (c.public_id || '').toLowerCase()).filter(Boolean))
  const invitedSlugs = new Set(ourOutreach.map(o => slugOfUrl(o.url)).filter(Boolean))
  const contactStatus = (url) => { const s = slugOfUrl(url); return connectedSlugs.has(s) ? 'connected' : invitedSlugs.has(s) ? 'invited' : null }

  // Genera un mensaje de outreach personalizado con IA para un candidato.
  async function generateDraft(cand, channel) {
    setDraftLoading(true); setDraft(null); setDraftCopied(false)
    try {
      const res = await fetch('/api/outreach-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: {
            full_name: cand.full_name, current_title: cand.current_title, current_company: cand.current_company,
            location: cand.location, snippet: cand.snippet,
          },
          vacancy: { title: vacancy.title, company_name: vacancy.company_name, location: vacancy.location, description: vacancy.description },
          channel, recruiter: profile?.full_name ? `${profile.full_name} · Enlace 468` : 'Enlace 468',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setDraft({ error: data.hint || data.error || 'No se pudo generar.' }); return }
      setDraft({ subject: data.subject, body: data.body, channel })
    } catch (e) { setDraft({ error: 'No se pudo conectar con el generador.' }) }
    finally { setDraftLoading(false) }
  }

  function copyDraft() {
    if (!draft?.body) return
    const txt = (draft.subject ? `Asunto: ${draft.subject}\n\n` : '') + draft.body
    navigator.clipboard?.writeText(txt)
    setDraftCopied(true); setTimeout(() => setDraftCopied(false), 2000)
  }

  // Envía la conexión/InMail por LinkedIn vía Unipile (acción real, 1 clic).
  async function sendLinkedIn(cand, action) {
    if (!cand?.linkedin_url) { setSendResult({ type: 'err', text: 'Este candidato no tiene URL de LinkedIn.' }); return }
    if (!draft?.body) { setSendResult({ type: 'err', text: 'Genera un mensaje primero.' }); return }
    const label = action === 'inmail' ? 'InMail' : 'solicitud de conexión'
    if (!window.confirm(`¿Enviar ${label} a ${cand.full_name || 'este candidato'} por LinkedIn?\n\n"${draft.body.slice(0, 180)}"`)) return
    setSending(true); setSendResult(null)
    try {
      const res = await fetch('/api/linkedin-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cand.linkedin_url, message: draft.body, subject: draft.subject, action }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setSendResult({ type: 'err', text: data.hint || data.error || 'No se pudo enviar.' }); return }
      if (data.alreadyConnected) { setSendResult({ type: 'ok', text: `${data.name} ya es tu contacto — mándale mensaje directo.` }); return }
      setSendResult({ type: 'ok', text: `✓ ${label} enviada a ${data.name || cand.full_name} por LinkedIn.` })
      // Registra el contacto en el banco (upsert) → tablero + no se re-contacta
      try {
        const row = {
          organization_id: profile.organization_id, vacancy_id: vacancyId,
          url: cand.linkedin_url, title: cand.full_name || data.name, full_name: cand.full_name || data.name,
          current_title: cand.current_title || null, current_company: cand.current_company || null,
          display_url: 'linkedin.com', snippet: cand.snippet || null, platform: 'linkedin', source: 'sourced',
          created_by: profile.id,
          contact_status: action === 'inmail' ? 'inmail_sent' : 'invited',
          contact_channel: draft.channel, contacted_at: new Date().toISOString(),
          contact_message: draft.body, provider_id: data.providerId || null,
          invitation_id: data.result?.invitation_id || null,
        }
        await supabase.from('sourcing_bank').upsert(row, { onConflict: 'vacancy_id,url' })
        loadOurOutreach()
      } catch (e) { console.error('registro outreach:', e) }
      loadActivity() // refresca el estado de LinkedIn
    } catch (e) { setSendResult({ type: 'err', text: 'No se pudo conectar con LinkedIn.' }) }
    finally { setSending(false) }
  }

  const hasCards = googleResults.length > 0

  return (
    <FeatureGate action="use_outreach">
    <div className="space-y-4">
      {/* Search bar */}
      <div className="glass rounded-xl p-5">
        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
              placeholder={`${vacancy.title} ${vacancy.location || 'México'}`}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-primary-light/40 outline-none text-white placeholder-gray-500 text-sm" />
          </div>
          <button onClick={() => doSearch()} disabled={!searchQuery.trim()}
            className="px-5 py-2.5 bg-primary-light text-white rounded-lg hover:bg-primary-light/90 text-sm font-medium disabled:opacity-40 flex items-center gap-2">
            <Search size={14} /> Buscar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            { label: 'Por titulo', q: `${vacancy.title} ${vacancy.location || 'México'}` },
            { label: 'Por industria', q: `${vacancy.department || 'financiero'} ${vacancy.location || 'México'}` },
            { label: 'Por empresa', q: `${vacancy.company_name || ''} ${vacancy.location || 'México'}` },
            ...(vacancy.competencies || []).slice(0, 2).map(c => ({ label: c.name, q: `${c.name} ${vacancy.location || 'México'}` })),
          ].map(t => (
            <button key={t.label} onClick={() => { setSearchQuery(t.q); doSearch(t.q) }}
              className="text-[11px] px-2.5 py-1 rounded bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all">
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {Object.entries(platforms).map(([id, p]) => (
            <button key={id} onClick={() => {
              setPlatform(id)
              if (searchQuery.trim()) {
                const prefix = platforms[id].prefix
                const base = prefix ? `${prefix} ${searchQuery}` : searchQuery
                setActiveSearch(`${base} ${NEGATIVE_QUERY}`.trim())
                handleLocalSearch(searchQuery)
              }
            }}
              className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all border ${
                platform === id ? p.color + ' bg-white/[0.05]' : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Sourcing automático */}
        <div className="mt-3 pt-3 flex flex-wrap items-center gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={runAutoSource} disabled={autoLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}>
            {autoLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {autoLoading ? 'Buscando y rankeando…' : 'Sourcing automático'}
          </button>
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <SlidersHorizontal size={13} className="text-gray-500" />
            <span>Score mínimo</span>
            <input type="range" min="30" max="90" step="5" value={autoMinScore}
              onChange={e => setAutoMinScore(Number(e.target.value))}
              className="w-24 accent-[#00A99D]" />
            <span className="font-semibold text-white w-6">{autoMinScore}</span>
          </div>
          {/* Toggle: excluir sector asegurador/inversiones (ON para Prudential) */}
          <button type="button" onClick={() => setExcludeSector(v => !v)}
            className="flex items-center gap-2 text-[11px] text-gray-300 hover:text-white transition-colors"
            title="Prende para NO traer gente de aseguradoras/inversiones (Prudential). Apaga cuando SÍ quieres del sector.">
            <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${excludeSector ? 'bg-[#00A99D]' : 'bg-white/15'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${excludeSector ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            Excluir aseguradoras/inversiones
          </button>
        </div>
        <p className="mt-2.5 text-[10px] text-gray-500 leading-relaxed">
          {excludeSector
            ? <>Excluyendo del sourcing: {EXCLUDED_LABELS_SHORT} y otras aseguradoras / casas de inversión.</>
            : <span className="text-amber-400/80">⚠ Exclusión de sector APAGADA — se incluirán perfiles de aseguradoras/inversiones.</span>}
        </p>

        {/* Importar por URL de LinkedIn (agregar gente de tu red al CRM) */}
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" value={importUrl} onChange={e => setImportUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') importByUrl() }}
                placeholder="Pega la URL de un perfil de LinkedIn para agregarlo al banco…"
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-primary-light/40 outline-none text-white placeholder-gray-500 text-xs" />
            </div>
            <button onClick={importByUrl} disabled={importing || !importUrl.trim()}
              className="px-4 py-2 bg-white/[0.06] text-white rounded-lg hover:bg-white/[0.1] text-xs font-medium disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
              {importing ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Importar
            </button>
          </div>
          {importMsg && (
            <p className={`mt-2 text-[11px] ${importMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{importMsg.text}</p>
          )}
        </div>
      </div>

      {/* Tablero de outreach — invitaciones enviadas por LinkedIn */}
      <div className="glass rounded-xl p-5">
        <button onClick={() => setActivityOpen(o => !o)} className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(10,102,194,0.15)' }}>
              <Send size={14} style={{ color: '#0a66c2' }} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Outreach en LinkedIn</p>
              <p className="text-[11px] text-gray-500">
                {activityLoading ? 'Cargando…' : `${ourOutreach.length} contactados · ${ourOutreach.filter(o => connectedSlugs.has(slugOfUrl(o.url))).length} aceptaron`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span onClick={e => { e.stopPropagation(); connectLinkedInAccount() }} className="text-[11px] text-primary-light hover:text-blue-300 cursor-pointer flex items-center gap-1" title="Conectar/cambiar la cuenta de LinkedIn que envía">
              {connectingAccount ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />} Cambiar cuenta de LinkedIn
            </span>
            <span onClick={e => { e.stopPropagation(); loadActivity() }} className="text-[11px] text-gray-400 hover:text-white cursor-pointer flex items-center gap-1">
              {activityLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Actualizar
            </span>
            <span className="text-gray-500 text-xs">{activityOpen ? '▲' : '▼'}</span>
          </div>
        </button>
        {activityOpen && (() => {
          const convByProvider = new Map(activity.conversations.filter(c => c.unread > 0).map(c => [c.provider_id, c]))
          const enriched = ourOutreach.map(o => {
            const slug = slugOfUrl(o.url)
            return { ...o, slug, connected: connectedSlugs.has(slug), replied: !!(o.provider_id && convByProvider.has(o.provider_id)) }
          })
          const pendientes = enriched.filter(e => !e.connected && !e.replied)
          const aceptados = enriched.filter(e => e.connected)
          const respondieron = enriched.filter(e => e.replied)
          const fecha = d => d ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
          const row = (o, right, sub) => (
            <div key={o.url} className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.05] flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary-light text-xs font-bold flex-shrink-0">{(o.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <a href={o.url} target="_blank" rel="noopener" className="text-sm font-semibold text-white hover:text-primary-light truncate">{o.full_name || 'LinkedIn'}</a>
                  {right}
                </div>
                {sub}
              </div>
            </div>
          )
          return (
            <div className="mt-3 space-y-4">
              {ourOutreach.length === 0 && <p className="text-xs text-gray-500 py-1">Aún no has contactado a nadie desde el CRM. Genera un mensaje y dale "Enviar conexión".</p>}
              {respondieron.length > 0 && (
                <div>
                  <p className="text-[10px] text-blue-300 uppercase tracking-wider mb-2">💬 Respondieron ({respondieron.length})</p>
                  <div className="space-y-2">{respondieron.map(o => row(o,
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 flex-shrink-0">Respondió</span>,
                    <p className="text-[10px] text-gray-600 mt-1">Contactado {fecha(o.contacted_at)}</p>))}</div>
                </div>
              )}
              {aceptados.length > 0 && (
                <div>
                  <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-2">✅ Aceptaron ({aceptados.length})</p>
                  <div className="space-y-2">{aceptados.map(o => row(o,
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Conectado</span>,
                    <p className="text-[10px] text-gray-600 mt-1">Contactado {fecha(o.contacted_at)}</p>))}</div>
                </div>
              )}
              <div>
                <p className="text-[10px] text-amber-300 uppercase tracking-wider mb-2">⏳ Pendientes de aceptar ({pendientes.length})</p>
                <div className="space-y-2">
                  {pendientes.length === 0 && <p className="text-xs text-gray-600">Ninguna pendiente.</p>}
                  {pendientes.map(o => row(o,
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 flex-shrink-0">{o.contact_status === 'inmail_sent' ? 'InMail' : 'Pendiente'}</span>,
                    <>{o.contact_message && <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{o.contact_message}</p>}
                      <p className="text-[10px] text-gray-600 mt-1">{fecha(o.contacted_at)}</p></>))}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Resultados del sourcing automático — rankeados por match */}
      {autoRan && (
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,169,157,0.15)' }}>
                <Sparkles size={14} style={{ color: '#00A99D' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Prospectos rankeados</p>
                {autoCounts ? (
                  <p className="text-[11px] text-gray-500">
                    {autoCounts.returned} nuevos · {autoCounts.known || 0} ya en banco · {autoCounts.excluded} aseguradoras · {autoCounts.belowThreshold} bajo umbral
                    {autoCounts.quotaHit ? ' · ⚠ cuota diaria alcanzada' : ''}
                  </p>
                ) : <p className="text-[11px] text-gray-500">Score ≥ {autoMinScore}</p>}
              </div>
            </div>
            {autoResults.length > 0 && (
              <button onClick={saveAllAuto} disabled={savingAll || autoUnsaved === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 disabled:opacity-40 transition-all">
                {savingAll ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {autoUnsaved === 0 ? 'Todo guardado' : `Guardar todos (${autoUnsaved})`}
              </button>
            )}
          </div>

          {autoLoading && <div className="text-center py-8"><Loader2 size={22} className="animate-spin mx-auto" style={{ color: '#00A99D' }} /></div>}
          {autoError && !autoLoading && <p className="text-xs text-red-400 py-3">{autoError}</p>}
          {!autoLoading && !autoError && autoResults.length === 0 && (
            <p className="text-xs text-gray-500 py-3">Sin prospectos por encima del umbral. Baja el score mínimo y reintenta.</p>
          )}

          <div className="space-y-2">
            {(() => {
              // Dedup: oculta los ya guardados o bloqueados (no reaparecen)
              const visible = autoResults.filter(r => r.score >= autoMinScore && !bankUrls.has(r.url) && !blockedGlobal.has(r.url))
              if (!autoLoading && autoResults.length > 0 && visible.length === 0) {
                return <p className="text-xs text-gray-500 py-2">Todos los prospectos de esta búsqueda ya están guardados o bloqueados.</p>
              }
              return visible.map((r, i) => {
              const badge = r.score >= 75 ? '#00A99D' : r.score >= 60 ? '#f59e0b' : '#9ca3af'
              return (
                <div key={i} className="rounded-xl p-4 border transition-all bg-white/[0.02] border-white/[0.05] hover:border-white/[0.12]">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center flex-shrink-0 w-10">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: badge }}>
                        {r.score}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a href={r.url} target="_blank" rel="noopener" className="text-sm font-semibold text-white hover:text-primary-light transition-colors line-clamp-1">{r.full_name || r.title}</a>
                        {contactStatus(r.url) === 'connected'
                          ? <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>✓ Conectado</span>
                          : contactStatus(r.url) === 'invited' && <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(10,102,194,0.2)', color: '#5aa0e6' }}>✓ Invitado</span>}
                      </div>
                      {(r.current_title || r.current_company) && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{[r.current_title, r.current_company].filter(Boolean).join(' · ')}</p>
                      )}
                      {r.strengths?.length > 0 && (
                        <p className="text-[11px] mt-1" style={{ color: 'rgba(0,169,157,0.85)' }}>✓ {r.strengths.join(' · ')}</p>
                      )}
                      {r.gaps?.length > 0 && (
                        <p className="text-[11px] text-gray-500 mt-0.5">− {r.gaps.join(' · ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      <button onClick={() => saveToBank(r)} disabled={savingUrl === r.url}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-all disabled:opacity-40" title="Guardar en el banco">
                        {savingUrl === r.url ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                      </button>
                      <button onClick={() => blockResult(r)} disabled={discardingUrl === r.url}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40" title="Bloquear — no volverá a aparecer en esta vacante">
                        {discardingUrl === r.url ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                      </button>
                      <a href={r.url} target="_blank" rel="noopener" className="p-1.5 rounded-lg text-gray-600 hover:text-primary-light hover:bg-primary-light/10 transition-all">
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              )
              })
            })()}
          </div>
        </div>
      )}

      {/* Banco de sourcing — persistent per-vacancy bank */}
      {savedItems.length > 0 && (
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400/15 flex items-center justify-center">
                <Archive size={14} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Banco de sourcing</p>
                <p className="text-[11px] text-gray-500">{savedItems.length} guardados · {savedItems.filter(b => b.candidate_id).length} en pipeline</p>
              </div>
            </div>
            <button onClick={exportBank} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/[0.04] rounded-lg hover:bg-white/[0.08]">
              <Download size={12} /> CSV
            </button>
          </div>
          <div className="space-y-2">
            {savedItems.map(b => {
              const inPipeline = !!b.candidate_id
              return (
                <div key={b.id} className={`rounded-xl p-4 border transition-all ${inPipeline ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.02] border-white/[0.06] hover:border-amber-400/20'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Star size={14} className="text-amber-400 fill-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a href={b.url} target="_blank" rel="noopener" className="text-sm font-semibold text-white hover:text-primary-light transition-colors line-clamp-1">{b.full_name || b.title}</a>
                        {contactStatus(b.url) === 'connected'
                          ? <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>✓ Conectado</span>
                          : contactStatus(b.url) === 'invited' && <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(10,102,194,0.2)', color: '#5aa0e6' }}>✓ Invitado</span>}
                      </div>
                      {(b.current_title || b.current_company) && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{[b.current_title, b.current_company].filter(Boolean).join(' · ')}</p>
                      )}
                      <p className="text-[11px] text-emerald-400/70 truncate mt-0.5">{b.display_url || b.url}</p>
                      {b.snippet && <p className="text-xs text-gray-400 line-clamp-2 mt-1.5 leading-relaxed">{b.snippet}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      {inPipeline ? (
                        <span className="px-2 py-1 text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle size={13} /> Pipeline</span>
                      ) : (
                        <button onClick={() => promoteToPipeline(b)} disabled={promotingId === b.id}
                          className="px-2.5 py-1 text-[11px] bg-primary-light/15 text-primary-light rounded font-medium hover:bg-primary-light/25 disabled:opacity-40 flex items-center gap-1" title="Agregar al pipeline">
                          {promotingId === b.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Pipeline
                        </button>
                      )}
                      <a href={b.url} target="_blank" rel="noopener" className="p-1.5 rounded-lg text-gray-600 hover:text-primary-light hover:bg-primary-light/10 transition-all">
                        <ExternalLink size={14} />
                      </a>
                      <button onClick={() => removeFromBank(b.id)} disabled={removingId === b.id}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40" title="Quitar del banco">
                        {removingId === b.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cards from Google results — visible when captured */}
      {hasCards && (
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400"><span className="font-semibold text-white">{googleResults.length}</span> resultados web</p>
            <div className="flex items-center gap-3">
              <a href={`https://www.google.com/search?q=${encodeURIComponent(activeSearch)}`} target="_blank" rel="noopener"
                className="text-[10px] text-primary-light hover:text-blue-300 flex items-center gap-1">
                <ExternalLink size={9} /> Abrir en Google
              </a>
              <button onClick={saveAllToBank} disabled={savingAll || unsavedCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 disabled:opacity-40 transition-all"
                title="Guardar todas las cards en el banco de esta vacante">
                {savingAll ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {unsavedCount === 0 ? 'Todo guardado' : `Guardar todos (${unsavedCount})`}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {googleResults.map((r, i) => {
              const isSaved = bankUrls.has(r.url)
              return (
                <div key={i} className={`rounded-xl p-4 border transition-all group ${isSaved ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.02] border-white/[0.05] hover:border-primary-light/20 hover:bg-white/[0.04]'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Globe size={14} className="text-primary-light" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <a href={r.url} target="_blank" rel="noopener" className="text-sm font-semibold text-white hover:text-primary-light transition-colors line-clamp-1 block">{r.title}</a>
                      <p className="text-[11px] text-emerald-400/70 truncate mt-0.5">{r.displayUrl}</p>
                      {r.snippet && <p className="text-xs text-gray-400 line-clamp-2 mt-1.5 leading-relaxed">{r.snippet}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      {isSaved ? (
                        <span className="p-1.5 text-emerald-400" title="En el banco"><CheckCircle size={16} /></span>
                      ) : (
                        <button onClick={() => saveToBank(r)} disabled={savingUrl === r.url}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-all disabled:opacity-40" title="Guardar en el banco">
                          {savingUrl === r.url ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                        </button>
                      )}
                      <a href={r.url} target="_blank" rel="noopener" className="p-1.5 rounded-lg text-gray-600 hover:text-primary-light hover:bg-primary-light/10 transition-all">
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {hasMore && (
            <button onClick={loadMore} disabled={loadingMore} className="w-full mt-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              {loadingMore ? <><Loader2 size={14} className="animate-spin" /> Cargando…</> : <><Plus size={14} /> Mostrar mas resultados</>}
            </button>
          )}
        </div>
      )}

      {/* CSE widget — visible when no cards yet, hidden behind when cards captured */}
      {activeSearch && (
        <div className="glass rounded-xl overflow-hidden" style={hasCards ? { position: 'fixed', left: '-9999px', width: '800px' } : {}}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-[11px] text-gray-500">Resultados web</p>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(activeSearch)}`} target="_blank" rel="noopener"
              className="text-[10px] text-primary-light hover:text-blue-300 flex items-center gap-1">
              <ExternalLink size={9} /> Abrir en Google
            </a>
          </div>
          <div id="gcs-box" className="p-3" style={{ minHeight: '200px' }} />
        </div>
      )}

      {/* Keep gcs-box in DOM when no search */}
      {!activeSearch && <div id="gcs-box" style={{ display: 'none' }} />}

      {/* Empty state */}
      {!activeSearch && !searching && localResults.length === 0 && savedItems.length === 0 && (
        <div className="text-center py-10 glass rounded-xl">
          <Search size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500 text-sm">Busca candidatos por puesto, industria o ubicacion.</p>
        </div>
      )}

      {/* Local results */}
      {searching && <div className="text-center py-4"><Loader2 size={18} className="animate-spin mx-auto text-primary-light" /></div>}
      {localResults.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400"><span className="font-semibold text-white">{localResults.length}</span> en tu banco</p>
            <button onClick={exportResults} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/[0.04] rounded-lg hover:bg-white/[0.08]">
              <Download size={12} /> CSV
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {localResults.map((c, i) => {
              const key = c._existing_id || c.linkedin_url || c.full_name
              const isAdded = addedIds.has(key)
              return (
                <div key={i} onClick={() => setSelectedCandidate(c)}
                  className={`rounded-xl p-4 transition-all border cursor-pointer ${isAdded ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.02] border-white/[0.05] hover:border-primary-light/20 hover:bg-white/[0.03]'}`}>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary-light flex-shrink-0 text-xs font-bold">
                      {c.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{c.full_name}</h3>
                      {c.current_title && <p className="text-xs text-gray-400 truncate">{c.current_title}</p>}
                      {c.current_company && <p className="text-[11px] text-gray-500 truncate">{c.current_company}</p>}
                    </div>
                  </div>
                  {c.snippet && <p className="text-[11px] text-gray-400 line-clamp-2 mb-2">{c.snippet}</p>}
                  <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-[11px] text-primary-light hover:text-blue-300"><ExternalLink size={10} className="inline mr-0.5" />Perfil</a>}
                    <div className="flex-1" />
                    {isAdded ? (
                      <span className="text-[11px] text-emerald-400"><CheckCircle size={12} className="inline mr-0.5" />Pipeline</span>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); c._existing_id ? addExisting(c._existing_id) : addToBank(c) }} disabled={addingId === key}
                        className="text-[11px] px-2.5 py-1 bg-primary-light/15 text-primary-light rounded font-medium hover:bg-primary-light/25 disabled:opacity-40">
                        <Plus size={10} className="inline" /> Pipeline
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setActiveTab('pipeline')} className="flex items-center gap-2 px-4 py-2 bg-primary-light text-white rounded-lg text-sm font-medium hover:bg-primary-light/90">
          Ver pipeline <Users size={14} />
        </button>
      </div>

      {/* Candidate modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCandidate(null)}>
          <div className="bg-[#111827] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-white/[0.08]" onClick={e => e.stopPropagation()}>
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
              {selectedCandidate.snippet && <div><p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Notas</p><p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedCandidate.snippet}</p></div>}

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
              <div className="flex-1" />
              <button onClick={() => setSelectedCandidate(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-white">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  )
}
