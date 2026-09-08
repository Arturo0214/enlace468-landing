import { X, Mail, Heart, CheckCircle, AlertTriangle, Copy, Send, Loader2 } from 'lucide-react'

// Modal de email de agradecimiento a candidatos rechazados: envío desde
// plataforma (/api/send-email vía Resend) con fallback mailto:. Estado y
// acciones vienen del hook useThankYouEmails (prop `thankYou`).
export default function ThankYouEmailModal({ thankYou, candidates, onClose }) {
  const {
    thankYouSubject, setThankYouSubject,
    thankYouBody, setThankYouBody,
    keepInBank, setKeepInBank,
    sendingEmails, emailsSent, sendResult, sendError,
    sendThankYouEmails, openThankYouMailto,
  } = thankYou
        const rejected = candidates.filter(c => c.stage === 'rejected')
        const withEmail = rejected.filter(c => c.candidates?.email)
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => onClose()}>
            <div className="bg-theme-surface rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-white/10" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between p-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Heart size={18} className="text-rose-400" />
                    <h2 className="font-display font-bold text-lg text-white">Gracias por participar</h2>
                  </div>
                  <p className="text-xs text-gray-400">Envía un correo de agradecimiento a los candidatos que no avanzaron</p>
                </div>
                <button onClick={() => onClose()} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
              </div>

              <div className="p-6 space-y-5">
                {/* Recipients */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Destinatarios ({withEmail.length} con email / {rejected.length} rechazados)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rejected.map(vc => {
                      const c = vc.candidates || {}
                      const hasEmail = !!c.email
                      return (
                        <span key={vc.id} className={`text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 ${hasEmail ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                          {hasEmail ? <Mail size={9} /> : <X size={9} />}
                          {c.full_name?.split(' ').slice(0, 2).join(' ')}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Asunto</label>
                  <input type="text" value={thankYouSubject} onChange={e => setThankYouSubject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white text-sm" />
                </div>

                {/* Body */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Mensaje <span className="text-gray-600 normal-case">(usa {"{{nombre}}"} para personalizar)</span></label>
                  <textarea value={thankYouBody} onChange={e => setThankYouBody(e.target.value)} rows={12}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white text-sm resize-none leading-relaxed" />
                </div>

                {/* Keep in bank toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={keepInBank} onChange={e => setKeepInBank(e.target.checked)}
                    className="w-4 h-4 rounded accent-accent" />
                  <div>
                    <span className="text-sm text-white">Conservar perfiles en banco de talento</span>
                    <p className="text-[11px] text-gray-500">El correo incluirá opción para que el candidato solicite eliminación de sus datos</p>
                  </div>
                </label>

                {/* Resultado del envío desde plataforma */}
                {sendResult && sendResult.sent > 0 && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <p className="text-sm text-emerald-300">
                      {sendResult.sent} enviado{sendResult.sent === 1 ? '' : 's'} desde la plataforma.
                      {sendResult.failed > 0 && ` ${sendResult.failed} fallaron — revisa los emails e intenta de nuevo.`}
                      {' '}Las interacciones fueron registradas.
                    </p>
                  </div>
                )}

                {/* Sin RESEND_API_KEY: aviso claro + fallback mailto */}
                {sendResult && sendResult.sent === 0 && sendResult.skipped > 0 && (
                  <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                      <p className="text-sm text-amber-300">Configura RESEND_API_KEY para enviar desde la plataforma.</p>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5 ml-6">Mientras tanto puedes usar "Abrir en mi correo" para mandarlos desde tu cliente de email.</p>
                  </div>
                )}

                {/* Error de red / auth / servidor */}
                {sendError && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                    <p className="text-sm text-red-300">{sendError}</p>
                  </div>
                )}

                {/* Fallback mailto abierto */}
                {emailsSent && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <p className="text-sm text-emerald-300">Se abrió tu cliente de correo con {withEmail.length} destinatarios. Las interacciones fueron registradas.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6" style={{ borderTop: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    const text = thankYouBody.replace(/\{\{nombre\}\}/g, '[Nombre]')
                    navigator.clipboard.writeText(text)
                  }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
                    <Copy size={12} /> Copiar mensaje
                  </button>
                  <button onClick={openThankYouMailto} disabled={sendingEmails || withEmail.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-all"
                    title="Abre tu cliente de correo con los destinatarios en BCC">
                    <Mail size={12} /> Abrir en mi correo
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => onClose()} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
                  <button onClick={sendThankYouEmails} disabled={sendingEmails || withEmail.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 shadow-lg shadow-rose-500/15 transition-all">
                    {sendingEmails ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {sendingEmails ? 'Enviando...' : `Enviar a ${withEmail.length} candidato${withEmail.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
}
