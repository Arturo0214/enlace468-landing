import { ExternalLink, Plus, Loader2, CheckCircle, Download } from 'lucide-react'

// Resultados de la búsqueda local en la tabla `candidates` (el banco propio):
// grid de cards clickeables que abren el modal del candidato + export CSV.
export default function LocalResultsList({ search, addedIds, addingId, setSelectedCandidate }) {
  const { searching, localResults, exportResults, addToBank, addExisting } = search
  return (
    <>
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
    </>
  )
}
