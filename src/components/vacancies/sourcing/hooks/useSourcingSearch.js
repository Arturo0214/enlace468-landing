import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import { matchExcludedCompany, NEGATIVE_QUERY } from '../../../../lib/excludedCompanies'
import { isForeignProfile } from '../../../../lib/sourcingScore'

const CSE_ID = '234e26a7d970d4e6f'

const platforms = {
  linkedin: { label: 'LinkedIn', prefix: 'site:linkedin.com/in', color: 'border-blue-500/30 text-blue-400' },
  occ: { label: 'OCC', prefix: 'site:occ.com.mx', color: 'border-emerald-500/30 text-emerald-400' },
  indeed: { label: 'Indeed', prefix: 'site:mx.indeed.com', color: 'border-indigo-500/30 text-indigo-400' },
  computrabajo: { label: 'CompuTrabajo', prefix: 'site:computrabajo.com.mx', color: 'border-orange-500/30 text-orange-400' },
  all: { label: 'Todos', prefix: '', color: 'border-white/20 text-white' },
}

// Estado y lógica de la búsqueda manual: widget CSE de Google (script, CSS
// oscuro, MutationObserver que captura resultados), paginación ("Ver más" con
// fallback al scraper server-side en LinkedIn), búsqueda local en `candidates`
// y acciones de agregar al pipeline desde resultados locales.
export default function useSourcingSearch({ vacancy, vacancyId, profile, platform, excludeSector, setAddedIds, setAddingId }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [localResults, setLocalResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [googleResults, setGoogleResults] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false) // ya no hay más resultados para esta búsqueda
  const cseRendered = useRef(false)
  const observerRef = useRef(null)
  const debounceRef = useRef(null)
  const isLoadingMore = useRef(false)
  const seenUrls = useRef(new Set())
  const loadMoreTimeout = useRef(null)
  const scrapedMore = useRef(false) // ya se jaló el lote extra del scraper (LinkedIn)
  const platformRef = useRef(platform) // el observer se crea una vez → ref para no leer un platform viejo
  useEffect(() => { platformRef.current = platform }, [platform])

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
          if (noRes) {
            // No borres lo ya mostrado si estamos paginando: un "sin resultados"
            // transitorio de Google al cambiar de página dejaba la lista en blanco.
            if (!isLoadingMore.current) setGoogleResults([])
            else { isLoadingMore.current = false; setLoadingMore(false); setHasMore(false) }
            return
          }

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
            // Bloquea perfiles ubicados fuera de México (subdominio pe./cl./ar… o texto)
            .filter(r => !isForeignProfile(r.url, r.title, r.snippet, r.displayUrl))

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

          // "Ver más": ofrecerlo si Google tiene más páginas nativas (2-10, hasta
          // ~100 resultados, confiable y sin proxy). En LinkedIn/Todos, cuando ya
          // no hay más páginas de Google, se ofrece el scraper server-side.
          const pages = container.querySelectorAll('.gsc-cursor-page')
          const idx = Array.from(pages).findIndex(p => p.classList.contains('gsc-cursor-current-page'))
          const moreGooglePages = idx >= 0 && idx + 1 < pages.length
          const plat = platformRef.current
          if (plat === 'linkedin' || plat === 'all') {
            setHasMore(moreGooglePages || !scrapedMore.current)
          } else {
            setHasMore(moreGooglePages)
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
    setExhausted(false)
    seenUrls.current = new Set()
    scrapedMore.current = false
    const tryExec = setInterval(() => {
      const el = window.google?.search?.cse?.element?.getElement('sourcing')
      if (el) { clearInterval(tryExec); el.execute(activeSearch) }
    }, 200)
    const timeout = setTimeout(() => clearInterval(tryExec), 15000)
    return () => { clearInterval(tryExec); clearTimeout(timeout) }
  }, [activeSearch])

  // Auto-acumular: Google trae 10 por página; en vez de esperar a que el usuario
  // pique "Ver más", jalamos páginas siguientes SOLAS hasta juntar ~AUTO_TARGET
  // resultados de arranque. Se detiene al llegar a la meta, si ya no hay más
  // páginas, o si está agotado. El usuario puede seguir con "Ver más" tras la meta.
  const AUTO_TARGET = 40
  useEffect(() => {
    if (!activeSearch) return
    if (loadingMore || isLoadingMore.current) return
    if (googleResults.length === 0 || googleResults.length >= AUTO_TARGET) return
    if (!hasMore || exhausted) return
    const t = setTimeout(() => loadMore(), 500)
    return () => clearTimeout(t)
  }, [googleResults, hasMore, loadingMore, exhausted, activeSearch])

  // "Ver más" para LinkedIn: el widget CSE solo trae ~10 y su paginación es
  // frágil. Traemos más desde el scraper server-side (hasta ~40 confiables).
  async function loadMoreLinkedIn() {
    setLoadingMore(true)
    let added = 0
    try {
      // Timeout duro: si el scraper (o el proxy) tarda, no dejamos "Cargando…"
      // girando indefinidamente.
      const res = await fetch('/api/auto-source', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancy: { title: searchQuery, location: vacancy.location || '', competencies: [] },
          platform: 'linkedin', minScore: 0, maxResults: 100, excludeSector,
        }),
        signal: AbortSignal.timeout(22000),
      })
      const data = await res.json()
      const mapped = (data.results || []).map(r => ({
        title: [r.full_name, r.current_title].filter(Boolean).join(' - ') || r.full_name,
        url: r.url, displayUrl: r.displayUrl || 'linkedin.com', snippet: r.snippet || '',
      })).filter(r => r.url && !seenUrls.current.has(r.url))
      if (mapped.length) {
        mapped.forEach(r => seenUrls.current.add(r.url))
        setGoogleResults(prev => [...prev, ...mapped])
        added = mapped.length
      }
    } catch (e) { console.error('loadMore scraper:', e) }
    finally {
      scrapedMore.current = true
      setHasMore(false) // el scraper ya trae el lote completo
      if (!added) setExhausted(true) // avisa que ya no hay más (en vez de desaparecer sin más)
      setLoadingMore(false)
    }
  }

  function loadMore() {
    // 1) Avanza la paginación NATIVA de Google (páginas 2-10 → hasta ~100
    //    resultados, confiable y sin proxy). Aplica a TODAS las plataformas,
    //    incluida LinkedIn: es lo que destraba el "solo salen 10".
    const container = document.getElementById('gcs-box')
    if (container) {
      const pages = Array.from(container.querySelectorAll('.gsc-cursor-page'))
      const idx = pages.findIndex(p => p.classList.contains('gsc-cursor-current-page'))
      const next = idx >= 0 ? pages[idx + 1] : pages.find(p => !p.classList.contains('gsc-cursor-current-page'))
      if (next) {
        isLoadingMore.current = true
        setLoadingMore(true)
        // Fallback: si en 6s no llegan resultados nuevos de Google, no dejamos el
        // spinner colgado. En LinkedIn/Todos intentamos el scraper; si no, agotado.
        clearTimeout(loadMoreTimeout.current)
        loadMoreTimeout.current = setTimeout(() => {
          if (!isLoadingMore.current) return // ya llegaron resultados, todo bien
          isLoadingMore.current = false
          setLoadingMore(false)
          if ((platform === 'linkedin' || platform === 'all') && !scrapedMore.current) {
            loadMoreLinkedIn()
          } else {
            setHasMore(false); setExhausted(true)
          }
        }, 6000)
        // Las páginas del cursor CSE responden a un click real de anchor
        next.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
        return
      }
    }
    // 2) Agotadas las páginas de Google: en LinkedIn/Todos jala el lote extra del
    //    scraper server-side (requiere proxy; si no hay, simplemente no agrega).
    if ((platform === 'linkedin' || platform === 'all') && !scrapedMore.current) {
      loadMoreLinkedIn()
      return
    }
    setHasMore(false)
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

  return {
    // estado
    platforms, searchQuery, setSearchQuery, activeSearch, setActiveSearch,
    localResults, searching,
    googleResults, hasMore, loadingMore, exhausted,
    // acciones
    doSearch, handleLocalSearch, loadMore, addToBank, addExisting, exportResults,
  }
}
