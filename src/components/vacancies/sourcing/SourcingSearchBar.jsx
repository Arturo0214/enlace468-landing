import { Search, Globe } from 'lucide-react'
import { NEGATIVE_QUERY } from '../../../lib/excludedCompanies'

// Búsqueda manual: input principal, atajos de búsqueda por título/industria/
// empresa/competencias y selector de plataforma (LinkedIn/OCC/Indeed/…).
// Se renderiza DENTRO de la misma card "glass" que AutoSourcingPanel (el
// orquestador arma la card para conservar el DOM original).
export default function SourcingSearchBar({ vacancy, platform, setPlatform, search }) {
  const { platforms, searchQuery, setSearchQuery, setActiveSearch, doSearch, handleLocalSearch } = search
  return (
    <>
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
    </>
  )
}
