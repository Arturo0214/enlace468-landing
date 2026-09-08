import { Search, Loader2, Link2, Send } from 'lucide-react'

// Tablero de outreach en LinkedIn: invitaciones/conexiones vía Unipile +
// nuestro registro en el CRM, agrupado en Respondieron / Aceptaron / Pendientes.
export default function OutreachBoard({ outreach }) {
  const {
    activity, activityLoading, activityOpen, setActivityOpen, ourOutreach,
    connectedSlugs, slugOfUrl, connectingAccount, connectLinkedInAccount, loadActivity,
  } = outreach
  return (
    <div className="glass rounded-xl p-5">
      <button onClick={() => setActivityOpen(o => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(10,102,194,0.15)' }}>
            <Send size={14} style={{ color: '#0a66c2' }} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Outreach en LinkedIn</p>
            <p className="text-[11px] text-gray-500">
              {activityLoading ? 'Cargando…' : `${ourOutreach.length} contactados · ${ourOutreach.filter(o => connectedSlugs.has(slugOfUrl(o.url))).length} aceptaron`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span onClick={e => { e.stopPropagation(); connectLinkedInAccount() }} className="text-[11px] text-primary-light hover:text-blue-300 cursor-pointer flex items-center gap-1" title="Conectar/cambiar la cuenta de LinkedIn que envía">
            {connectingAccount ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />} Cambiar cuenta de LinkedIn
          </span>
          <span onClick={e => { e.stopPropagation(); loadActivity() }} className="text-[11px] text-gray-400 hover:text-white cursor-pointer flex items-center gap-1">
            {activityLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Actualizar
          </span>
          <span className="text-gray-500 text-xs">{activityOpen ? '▲' : '▼'}</span>
        </div>
      </button>
      {activityOpen && (() => {
        const convByProvider = new Map(activity.conversations.filter(c => c.unread > 0).map(c => [c.provider_id, c]))
        const enriched = ourOutreach.map(o => {
          const slug = slugOfUrl(o.url)
          return { ...o, slug, connected: connectedSlugs.has(slug), replied: !!(o.provider_id && convByProvider.has(o.provider_id)) }
        })
        const pendientes = enriched.filter(e => !e.connected && !e.replied)
        const aceptados = enriched.filter(e => e.connected)
        const respondieron = enriched.filter(e => e.replied)
        const fecha = d => d ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
        const row = (o, right, sub) => (
          <div key={o.url} className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.05] flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary-light text-xs font-bold flex-shrink-0">{(o.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <a href={o.url} target="_blank" rel="noopener" className="text-sm font-semibold text-white hover:text-primary-light truncate">{o.full_name || 'LinkedIn'}</a>
                {right}
              </div>
              {sub}
            </div>
          </div>
        )
        return (
          <div className="mt-3 space-y-4">
            {ourOutreach.length === 0 && <p className="text-xs text-gray-500 py-1">Aún no has contactado a nadie desde el CRM. Genera un mensaje y dale "Enviar conexión".</p>}
            {respondieron.length > 0 && (
              <div>
                <p className="text-[10px] text-blue-300 uppercase tracking-wider mb-2">💬 Respondieron ({respondieron.length})</p>
                <div className="space-y-2">{respondieron.map(o => row(o,
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 flex-shrink-0">Respondió</span>,
                  <p className="text-[10px] text-gray-600 mt-1">Contactado {fecha(o.contacted_at)}</p>))}</div>
              </div>
            )}
            {aceptados.length > 0 && (
              <div>
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-2">✅ Aceptaron ({aceptados.length})</p>
                <div className="space-y-2">{aceptados.map(o => row(o,
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Conectado</span>,
                  <p className="text-[10px] text-gray-600 mt-1">Contactado {fecha(o.contacted_at)}</p>))}</div>
              </div>
            )}
            <div>
              <p className="text-[10px] text-amber-300 uppercase tracking-wider mb-2">⏳ Pendientes de aceptar ({pendientes.length})</p>
              <div className="space-y-2">
                {pendientes.length === 0 && <p className="text-xs text-gray-600">Ninguna pendiente.</p>}
                {pendientes.map(o => row(o,
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 flex-shrink-0">{o.contact_status === 'inmail_sent' ? 'InMail' : 'Pendiente'}</span>,
                  <>{o.contact_message && <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{o.contact_message}</p>}
                    <p className="text-[10px] text-gray-600 mt-1">{fecha(o.contacted_at)}</p></>))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
