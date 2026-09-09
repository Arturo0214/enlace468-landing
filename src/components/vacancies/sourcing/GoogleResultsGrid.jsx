import { Search, Globe, ExternalLink, Plus, Loader2, CheckCircle, Star, Save } from 'lucide-react'

// Cards capturadas del widget CSE de Google + el propio widget (#gcs-box).
//
// ⚠️ CRÍTICO: el div #gcs-box del widget CSE de Google DEBE permanecer montado
// en el DOM en TODO momento (con búsqueda activa se muestra u oculta fuera de
// pantalla; sin búsqueda queda con display:none). El script de Google renderiza
// dentro de ese div y useSourcingSearch le cuelga un MutationObserver para
// capturar los resultados — si el div desaparece, la búsqueda deja de
// funcionar. Por eso este componente se renderiza SIEMPRE (los condicionales
// van adentro) y no debe desmontarse mientras la pestaña Sourcing esté abierta.
export default function GoogleResultsGrid({ search, bank }) {
  const { googleResults, activeSearch, searching, localResults, hasMore, loadingMore, exhausted, loadMore } = search
  const { hasUrl, savedItems, savingAll, unsavedCount, savingUrl, saveToBank, saveAllToBank } = bank
  const hasCards = googleResults.length > 0
  return (
    <>
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
              const isSaved = hasUrl(r.url)
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
          {!hasMore && exhausted && (
            <p className="w-full mt-3 py-2.5 text-center text-xs text-gray-500">
              No hay más resultados para esta búsqueda. Prueba términos más generales (ej. solo el puesto y la ciudad).
            </p>
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
    </>
  )
}
