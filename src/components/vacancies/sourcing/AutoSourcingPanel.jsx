import { Loader2, Plus, Sparkles, SlidersHorizontal, Link2 } from 'lucide-react'
import { EXCLUDED_LABELS_SHORT } from '../../../lib/excludedCompanies'

// Sourcing automático server-side: términos ganadores, botón de corrida,
// slider de score, toggles (excluir sector / solo emprendedores), sourcing
// nocturno (cron) con auto-promoción, e importación de perfil por URL.
// Vive dentro de la misma card "glass" que SourcingSearchBar.
export default function AutoSourcingPanel({ auto, bank, excludeSector, setExcludeSector, onlyEntrepreneurs, setOnlyEntrepreneurs }) {
  const {
    autoTerms, setAutoTerms, autoLoading, autoMinScore, setAutoMinScore,
    autoNightly, autoPromoteMin, setAutoPromoteMin, savingNightly,
    runAutoSource, toggleNightly, savePromoteMin,
  } = auto
  const { importUrl, setImportUrl, importing, importMsg, importByUrl } = bank
  return (
    <>
      {/* Sourcing automático */}
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <label className="block text-[11px] text-gray-400 mb-1.5">
          Términos que SÍ responden (cómo se describe esa gente en LinkedIn, separados por coma — se guardan en la vacante)
        </label>
        <input type="text" value={autoTerms} onChange={e => setAutoTerms(e.target.value)}
          placeholder='Ej. "Ejecutivo de ventas, Coordinador Comercial, Ejecutivo Comercial"'
          className="w-full mb-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-[#00A99D]/50 outline-none text-white placeholder-gray-600 text-sm" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
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
        {/* Toggle: solo emprendedores/dueños de negocio (convierten mejor — Ingrid) */}
        <button type="button" onClick={() => setOnlyEntrepreneurs(v => !v)}
          className="flex items-center gap-2 text-[11px] text-gray-300 hover:text-white transition-colors"
          title="Solo perfiles con señales de negocio propio (fundador, emprendedor, dueño). Convierten mejor: no les da miedo emprender.">
          <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${onlyEntrepreneurs ? 'bg-[#00A99D]' : 'bg-white/15'}`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${onlyEntrepreneurs ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </span>
          Solo emprendedores
        </button>
      </div>
      <p className="mt-2.5 text-[10px] text-gray-500 leading-relaxed">
        {excludeSector
          ? <>Excluyendo del sourcing: {EXCLUDED_LABELS_SHORT} y otras aseguradoras / casas de inversión.</>
          : <span className="text-amber-400/80">⚠ Exclusión de sector APAGADA — se incluirán perfiles de aseguradoras/inversiones.</span>}
      </p>

      {/* Sourcing nocturno automático (cron L-V 4-6am CDMX) */}
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={toggleNightly} disabled={savingNightly}
            className="flex items-center gap-2 text-[11px] text-gray-300 hover:text-white transition-colors disabled:opacity-60"
            title="El robot busca solo, de madrugada (L-V 4, 5 y 6am CDMX) y deja los candidatos rankeados en 'Candidatos de hoy' del dashboard.">
            <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${autoNightly ? 'bg-[#00A99D]' : 'bg-white/15'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${autoNightly ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            {savingNightly ? <Loader2 size={12} className="animate-spin" /> : null}
            Sourcing nocturno automático
          </button>
          {autoNightly && (
            <label className="flex items-center gap-2 text-[11px] text-gray-400">
              Auto-promover si score ≥
              <input type="number" min="0" max="100" value={autoPromoteMin}
                onChange={e => setAutoPromoteMin(e.target.value)}
                onBlur={e => savePromoteMin(e.target.value)}
                placeholder="—"
                className="w-16 px-2 py-1 rounded-lg bg-white/5 border border-white/10 focus:border-[#00A99D]/50 outline-none text-white text-xs" />
              <span className="text-gray-600">(vacío = no auto-promover)</span>
            </label>
          )}
        </div>
        {autoNightly && (
          <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
            Corre L-V a las 4, 5 y 6am (CDMX). Los nuevos aparecen rankeados en el banco y en "Candidatos de hoy"; el digest por correo sale a las 7am.
          </p>
        )}
      </div>

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
    </>
  )
}
