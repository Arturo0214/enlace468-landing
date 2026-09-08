import { ExternalLink, Plus, Loader2, CheckCircle, Download, Star, Archive, Trash2, Workflow, Mail } from 'lucide-react'
import { verifyBadge, hasVerifyProblem, verifyTooltip } from '../../../lib/verifyBadge'

// Banco de sourcing persistente por vacante: cards guardadas con badges de
// score/verificación/contacto y acciones (promover a pipeline, secuencia,
// abrir perfil, quitar) + export CSV.
export default function SourcingBankList({ bank, outreach, setEnrollTarget }) {
  const { savedItems, exportBank, promoteToPipeline, promotingId, removeFromBank, removingId } = bank
  const { contactStatus } = outreach
  if (savedItems.length === 0) return null
  return (
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
                    {b.score != null && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${Number(b.score) >= 70 ? 'bg-emerald-500/20 text-emerald-300' : Number(b.score) >= 55 ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-gray-400'}`}
                        title={[...(b.score_details?.strengths || []), ...(b.score_details?.gaps || []).map(g => `⚠ ${g}`)].join(' · ') || undefined}>
                        {Math.round(Number(b.score))}
                      </span>
                    )}
                    {contactStatus(b.url) === 'connected'
                      ? <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>✓ Conectado</span>
                      : contactStatus(b.url) === 'invited' && <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(10,102,194,0.2)', color: '#5aa0e6' }}>✓ Invitado</span>}
                    {hasVerifyProblem(b.verify_status) && (() => {
                      const vb = verifyBadge(b.verify_status)
                      return vb && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: vb.bg, color: vb.fg }}
                          title={verifyTooltip(b.verify_status, b.verify_details)}>
                          {vb.icon} {vb.label}
                        </span>
                      )
                    })()}
                  </div>
                  {(b.current_title || b.current_company) && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{[b.current_title, b.current_company].filter(Boolean).join(' · ')}</p>
                  )}
                  {b.email && (
                    <a href={`mailto:${b.email}`} className="flex items-center gap-1 text-xs text-teal-300/80 hover:text-teal-300 truncate mt-0.5 w-fit"
                      title="Correo cosechado al aceptar tu conexión en LinkedIn">
                      <Mail size={11} className="flex-shrink-0" /> {b.email}
                    </a>
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
                  <button onClick={() => setEnrollTarget({ type: 'bank', id: b.id, name: b.full_name || b.title })}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-teal-400 hover:bg-teal-400/10 transition-all"
                    title="Inscribir en secuencia de outreach">
                    <Workflow size={14} />
                  </button>
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
  )
}
