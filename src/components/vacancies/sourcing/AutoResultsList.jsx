import { ExternalLink, Loader2, Star, Save, Sparkles, Ban } from 'lucide-react'

// Resultados del sourcing automático, rankeados por score de match.
// Se ocultan los ya guardados en el banco o bloqueados globalmente.
export default function AutoResultsList({ auto, bank, outreach }) {
  const {
    autoRan, autoResults, autoLoading, autoError, autoCounts, autoMinScore,
    autoUnsaved, saveAllAuto,
  } = auto
  const { bankUrls, blockedGlobal, savingAll, savingUrl, discardingUrl, saveToBank, blockResult } = bank
  const { contactStatus } = outreach
  if (!autoRan) return null
  return (
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
                    {r.entrepreneur && <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>🚀 Emprendedor</span>}
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
  )
}
