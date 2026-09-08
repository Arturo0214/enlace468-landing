import { Plus, User, Star, X, Loader2, CheckCircle, FileText, UserPlus, Lock, Crown } from 'lucide-react'
import { usePlan } from '../../../lib/planContext'

// Modal "Agregar candidato" — dos paneles: alta manual de recomendado (con
// CV) y sugerencias del banco de talento (gated por plan). Estado y acciones
// vienen del hook useAddCandidate (prop `add`).
export default function AddCandidateModal({ add, onClose }) {
  const { canDo } = usePlan()
  const hasBankAccess = canDo('access_candidate_bank')
  const {
    bankCandidates, searchTerm, setSearchTerm,
    newCandidate, setNewCandidate,
    addingNew, cvFile, setCvFile, cvUploading,
    addNewRecommended, addCandidate,
  } = add
  return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => onClose()}>
          <div className="bg-theme-surface rounded-2xl w-full max-w-4xl max-h-[80vh] border border-white/10 flex overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* LEFT: Agregar recomendado */}
            <div className="w-1/2 flex flex-col" style={{ borderRight: '1px solid var(--border-default)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2">
                  <UserPlus size={16} className="text-accent" />
                  <h3 className="font-display font-semibold text-white text-sm">Agregar recomendado</h3>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Agrega un candidato nuevo manualmente</p>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Nombre completo *</label>
                  <input type="text" value={newCandidate.full_name} onChange={e => setNewCandidate(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Nombre del candidato" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Puesto actual</label>
                    <input type="text" value={newCandidate.current_title} onChange={e => setNewCandidate(p => ({ ...p, current_title: e.target.value }))}
                      placeholder="Título" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Empresa</label>
                    <input type="text" value={newCandidate.current_company} onChange={e => setNewCandidate(p => ({ ...p, current_company: e.target.value }))}
                      placeholder="Empresa" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">LinkedIn URL</label>
                  <input type="url" value={newCandidate.linkedin_url} onChange={e => setNewCandidate(p => ({ ...p, linkedin_url: e.target.value }))}
                    placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Email</label>
                    <input type="email" value={newCandidate.email} onChange={e => setNewCandidate(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@ejemplo.com" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Teléfono</label>
                    <input type="tel" value={newCandidate.phone} onChange={e => setNewCandidate(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+52 55 1234 5678" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                  </div>
                </div>
                {/* CV Upload */}
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">CV (PDF, Word)</label>
                  <label className="flex items-center gap-3 px-3 py-3 rounded-lg border-2 border-dashed border-white/10 hover:border-primary/30 cursor-pointer transition-colors">
                    <FileText size={18} className={cvFile ? 'text-accent' : 'text-gray-600'} />
                    <div className="flex-1 min-w-0">
                      {cvFile ? (
                        <div>
                          <p className="text-xs text-white font-medium truncate">{cvFile.name}</p>
                          <p className="text-[10px] text-gray-500">{(cvFile.size / 1024).toFixed(0)} KB</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Click para seleccionar archivo</p>
                      )}
                    </div>
                    {cvFile && (
                      <button type="button" onClick={e => { e.preventDefault(); setCvFile(null) }} className="text-gray-500 hover:text-red-400 p-0.5">
                        <X size={14} />
                      </button>
                    )}
                    <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => setCvFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
              <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                <button onClick={addNewRecommended} disabled={!newCandidate.full_name.trim() || addingNew || cvUploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent to-accent-light text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
                  {addingNew || cvUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {cvUploading ? 'Subiendo CV...' : 'Agregar recomendado'}
                </button>
              </div>
            </div>

            {/* RIGHT: Top candidatos del banco (requires upgrade) */}
            <div className="w-1/2 flex flex-col">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-gold" />
                  <h3 className="font-display font-semibold text-white text-sm">Candidatos relevantes del banco</h3>
                  {!hasBankAccess && <span className="text-[9px] px-2 py-0.5 rounded-full bg-gold/15 text-gold font-bold uppercase tracking-wider">Premium</span>}
                </div>
                {hasBankAccess && (
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o puesto..."
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm" />
                )}
              </div>

              {hasBankAccess ? (
                <>
                  <div className="flex-1 overflow-y-auto p-2">
                    {bankCandidates
                      .filter(c => {
                        const q = searchTerm.toLowerCase()
                        return c.full_name.toLowerCase().includes(q) || (c.current_title || '').toLowerCase().includes(q) || (c.current_company || '').toLowerCase().includes(q)
                      })
                      .sort((a, b) => (b.years_experience || 0) - (a.years_experience || 0))
                      .map(c => (
                      <button key={c.id} onClick={() => addCandidate(c.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-left transition-colors group">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-gray-300 flex-shrink-0 text-xs font-bold">
                          {c.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{c.full_name}</div>
                          <div className="text-xs text-gray-400 truncate">{c.current_title || 'Sin título'}{c.current_company ? ` · ${c.current_company}` : ''}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {c.years_experience && <span className="text-[10px] text-gray-500">{c.years_experience} años exp.</span>}
                            {c._matchCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">{c._matchCount} keywords</span>}
                          </div>
                        </div>
                        <Plus size={14} className="text-gray-600 group-hover:text-accent flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                    {bankCandidates.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                      <div className="text-center py-10">
                        <User size={24} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500">No hay candidatos en el banco que hagan match con esta vacante</p>
                        <p className="text-[11px] text-gray-600 mt-1">Usa el panel izquierdo para agregar un recomendado</p>
                      </div>
                    )}
                  </div>
                  <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                    <button onClick={() => onClose()} className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors">Cerrar</button>
                  </div>
                </>
              ) : (
                /* Upgrade CTA */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/20 to-amber-500/10 flex items-center justify-center mb-5">
                    <Lock size={28} className="text-gold" />
                  </div>
                  <h4 className="font-display font-bold text-white text-lg mb-2">Banco de Talento Inteligente</h4>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed max-w-xs">
                    Accede a tu banco de candidatos con match score, filtros avanzados y recomendaciones de IA para cada vacante.
                  </p>
                  <div className="space-y-2 mb-6 w-full max-w-xs">
                    {['Candidatos rankeados por match', 'Filtro por skills e industria', 'Historial de interacciones', 'Recomendaciones por vacante'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-gray-300">
                        <CheckCircle size={12} className="text-gold flex-shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                  <a href="/#precios" onClick={() => onClose()}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-gold to-amber-500 text-white font-bold text-sm shadow-lg shadow-gold/20 hover:shadow-gold/40 hover:-translate-y-0.5 transition-all">
                    <Crown size={16} /> Desbloquear con Enterprise
                  </a>
                  <p className="text-[10px] text-gray-600 mt-3">Disponible en Enterprise Starter, Growth y Partner</p>
                </div>
              )}
            </div>
          </div>
        </div>
  )
}
