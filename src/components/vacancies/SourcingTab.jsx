import { useState, useEffect, useRef } from 'react'
import { Search, Globe, ExternalLink, Plus, Loader2, CheckCircle, Download, Users, X, Mail, Phone, MapPin, Tag, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import FeatureGate from '../ui/FeatureGate'

const CSE_ID = '234e26a7d970d4e6f'

export default function SourcingTab({ vacancy, profile, vacancyId, addedIds, setAddedIds, addingId, setAddingId, setActiveTab }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [localResults, setLocalResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [platform, setPlatform] = useState('linkedin')
  const [savedWebUrls, setSavedWebUrls] = useState(new Set())
  const [savingUrl, setSavingUrl] = useState(null)
  const [googleResults, setGoogleResults] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const cseRendered = useRef(false)
  const observerRef = useRef(null)
  const debounceRef = useRef(null)
  const isLoadingMore = useRef(false)

  const platforms = {
    linkedin: { label: 'LinkedIn', prefix: 'site:linkedin.com/in', color: 'border-blue-500/30 text-blue-400' },
    occ: { label: 'OCC', prefix: 'site:occ.com.mx', color: 'border-emerald-500/30 text-emerald-400' },
    indeed: { label: 'Indeed', prefix: 'site:mx.indeed.com', color: 'border-indigo-500/30 text-indigo-400' },
    computrabajo: { label: 'CompuTrabajo', prefix: 'site:computrabajo.com.mx', color: 'border-orange-500/30 text-orange-400' },
    all: { label: 'Todos', prefix: '', color: 'border-white/20 text-white' },
  }

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

          if (parsed.length) {
            if (isLoadingMore.current) {
              setGoogleResults(prev => [...prev, ...parsed])
              isLoadingMore.current = false
            } else {
              setGoogleResults(parsed)
            }
          }

          const pages = container.querySelectorAll('.gsc-cursor-page')
          const idx = Array.from(pages).findIndex(p => p.classList.contains('gsc-cursor-current-page'))
          setHasMore(idx >= 0 && idx + 1 < pages.length)
        }, 500)
      })
      observerRef.current.observe(container, { childList: true, subtree: true })
    }, 300)
  }

  // Execute search
  useEffect(() => {
    if (!activeSearch) { setGoogleResults([]); setHasMore(false); return }
    setGoogleResults([])
    isLoadingMore.current = false
    const tryExec = setInterval(() => {
      const el = window.google?.search?.cse?.element?.getElement('sourcing')
      if (el) { clearInterval(tryExec); el.execute(activeSearch) }
    }, 200)
    const timeout = setTimeout(() => clearInterval(tryExec), 15000)
    return () => { clearInterval(tryExec); clearTimeout(timeout) }
  }, [activeSearch])

  function loadMore() {
    const container = document.getElementById('gcs-box')
    if (!container) return
    const pages = container.querySelectorAll('.gsc-cursor-page')
    const idx = Array.from(pages).findIndex(p => p.classList.contains('gsc-cursor-current-page'))
    if (idx >= 0 && idx + 1 < pages.length) {
      isLoadingMore.current = true
      pages[idx + 1].click()
    }
  }

  function doSearch(q) {
    const query = q || searchQuery
    if (!query.trim()) return
    const p = platforms[platform]
    const fullQuery = p.prefix ? `${p.prefix} ${query}` : query
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
        setLocalResults((data || []).map(c => ({
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

  async function saveWebResult(result) {
    setSavingUrl(result.url)
    try {
      let name = result.title || '', title = null, company = null
      const isLinkedin = result.url?.includes('linkedin.com')
      if (isLinkedin) {
        const match = name.match(/^(.+?)\s*[-–]\s*(.+?)\s*[-–]\s*(.+?)(?:\s*\|.*)?$/)
        if (match) { name = match[1].trim(); title = match[2].trim(); company = match[3].trim() }
        else { name = name.replace(/\s*\|.*$/, '').trim() }
      }
      const { data } = await supabase.from('candidates').insert({
        organization_id: profile.organization_id, full_name: name || result.title,
        current_title: title, current_company: company,
        linkedin_url: isLinkedin ? result.url : null,
        source: 'web-sourced', notes: result.snippet || null, tags: ['web-sourced'],
      }).select().single()
      if (data) {
        await supabase.from('vacancy_candidates').insert({ vacancy_id: vacancyId, candidate_id: data.id, stage: 'sourced', assigned_to: profile.id })
        setAddedIds(prev => new Set([...prev, data.id]))
      }
      setSavedWebUrls(prev => new Set([...prev, result.url]))
    } catch (e) { console.error(e) }
    finally { setSavingUrl(null) }
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
                const fullQuery = prefix ? `${prefix} ${searchQuery}` : searchQuery
                setActiveSearch(fullQuery)
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
      </div>

      {/* Cards from Google results — visible when captured */}
      {hasCards && (
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400"><span className="font-semibold text-white">{googleResults.length}</span> resultados web</p>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(activeSearch)}`} target="_blank" rel="noopener"
              className="text-[10px] text-primary-light hover:text-blue-300 flex items-center gap-1">
              <ExternalLink size={9} /> Abrir en Google
            </a>
          </div>
          <div className="space-y-2">
            {googleResults.map((r, i) => {
              const isSaved = savedWebUrls.has(r.url)
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
                        <span className="p-1.5 text-emerald-400"><CheckCircle size={16} /></span>
                      ) : (
                        <button onClick={() => saveWebResult(r)} disabled={savingUrl === r.url}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-all disabled:opacity-40" title="Guardar candidato">
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
            <button onClick={loadMore} className="w-full mt-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all flex items-center justify-center gap-2">
              <Plus size={14} /> Mostrar mas resultados
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
      {!activeSearch && !searching && localResults.length === 0 && (
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
