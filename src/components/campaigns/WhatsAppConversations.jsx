import { useState } from 'react'
import { Search, Phone, CheckCheck, MapPin, XCircle, ChevronLeft, CalendarCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import conversations from './conversationsData'

const statusConfig = {
  scheduled: { label: 'Entrevista agendada', color: 'emerald' },
  talking: { label: 'En conversacion', color: 'blue' },
  rejected: { label: 'No califica', color: 'red' },
  no_response: { label: 'Sin respuesta', color: 'gray' },
}

const colorMap = {
  emerald: { bg: '#dcfce7', text: '#16a34a', dot: '#25d366' },
  blue: { bg: '#dbeafe', text: '#2563eb', dot: '#3b82f6' },
  red: { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
  gray: { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' },
}

export default function WhatsAppConversations() {
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = conversations.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const conv = selected ? conversations.find(c => c.id === selected) : null
  const getColors = (status) => colorMap[statusConfig[status]?.color || 'gray']

  return (
    <div className="flex rounded-2xl overflow-hidden shadow-lg" style={{ height: '680px', background: '#fff', border: '1px solid #e0e0e0' }}>
      {/* Sidebar */}
      <div className={`flex flex-col ${selected ? 'hidden md:flex' : 'flex'}`} style={{ width: '340px', background: '#fff', borderRight: '1px solid #e0e0e0' }}>
        <div className="p-3" style={{ borderBottom: '1px solid #e0e0e0', background: '#f0f2f5' }}>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-semibold" style={{ color: '#111b21' }}>Conversaciones WhatsApp</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#25d366', color: '#fff' }}>{conversations.length} chats</span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#54656f' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar candidato..."
              style={{ background: '#fff', border: '1px solid #e0e0e0', color: '#111b21' }}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none placeholder-gray-400" />
          </div>
          <div className="flex gap-1 mt-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'scheduled', label: 'Agendados' },
              { id: 'talking', label: 'Activos' },
              { id: 'rejected', label: 'Rechazados' },
              { id: 'no_response', label: 'Sin resp.' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{ background: filter === f.id ? '#25d366' : '#e9edef', color: filter === f.id ? '#fff' : '#54656f' }}
                className="text-[10px] px-2 py-1 rounded font-medium transition-colors hover:opacity-80">
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => {
            const colors = getColors(c.status)
            return (
              <button key={c.id} onClick={() => setSelected(c.id)}
                style={{ background: selected === c.id ? '#f0f2f5' : '#fff', borderBottom: '1px solid #f0f2f5' }}
                className="w-full flex items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-gray-50">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#25d366', color: '#fff' }}>{c.avatar}</div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: colors.dot }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium truncate" style={{ color: '#111b21' }}>{c.name}</span>
                    <span className="text-[11px] flex-shrink-0 ml-2" style={{ color: c.unread ? '#25d366' : '#667781' }}>{c.time}</span>
                  </div>
                  <p className="text-[12px] truncate mt-0.5" style={{ color: '#667781' }}>{c.lastMsg}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: colors.bg, color: colors.text }}>
                      {statusConfig[c.status]?.label}
                    </span>
                    <span className="text-[10px] flex items-center gap-0.5" style={{ color: '#667781' }}><MapPin size={8} />{c.location.split(',')[0]}</span>
                  </div>
                </div>
                {c.unread > 0 && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1" style={{ background: '#25d366', color: '#fff' }}>{c.unread}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${selected ? 'flex' : 'hidden md:flex'}`} style={{ background: '#efeae2' }}>
        {conv ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#f0f2f5', borderBottom: '1px solid #e0e0e0' }}>
              <button onClick={() => setSelected(null)} className="md:hidden mr-1" style={{ color: '#54656f' }}><ChevronLeft size={18} /></button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#25d366', color: '#fff' }}>{conv.avatar}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#111b21' }}>{conv.name}</p>
                <p className="text-[10px]" style={{ color: '#667781' }}>{conv.phone} · {conv.location}</p>
              </div>
              {(() => { const colors = getColors(conv.status); return (
                <div className="flex items-center gap-1.5" style={{ background: colors.bg, color: colors.text, padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600 }}>
                  {conv.status === 'scheduled' && <CalendarCheck size={10} />}
                  {conv.status === 'rejected' && <XCircle size={10} />}
                  {statusConfig[conv.status]?.label}
                </div>
              )})()}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ background: '#efeae2' }}>
              <div className="text-center mb-4">
                <span className="text-[10px] px-3 py-1 rounded-full shadow-sm" style={{ background: '#fff', color: '#54656f' }}>Hoy</span>
              </div>
              {conv.messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={`flex ${msg.from === 'lead' ? 'justify-start' : 'justify-end'}`}>
                  <div className="max-w-[75%] px-3 py-2 rounded-xl text-[13px] leading-relaxed shadow-sm"
                    style={msg.from === 'lead'
                      ? { background: '#fff', color: '#111b21', borderTopLeftRadius: '4px' }
                      : { background: '#d9fdd3', color: '#111b21', borderTopRightRadius: '4px' }}>
                    {msg.from === 'agent' && <p style={{ color: '#25d366', fontSize: '9px', fontWeight: 600, marginBottom: '2px' }}>Sofia · Agente IA</p>}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <p style={{ fontSize: '9px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', color: '#667781' }}>
                      {msg.time}
                      {msg.from === 'agent' && <CheckCheck size={10} style={{ color: '#53bdeb' }} />}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="px-4 py-3" style={{ background: '#f0f2f5', borderTop: '1px solid #e0e0e0' }}>
              <div className="flex items-center gap-2">
                <input disabled placeholder="Respuesta automatica del agente Sofia..." style={{ background: '#fff', border: '1px solid #e0e0e0', color: '#667781' }} className="flex-1 px-3 py-2 rounded-xl text-xs outline-none cursor-not-allowed" />
                <div className="px-3 py-2 rounded-xl text-[10px] font-medium" style={{ background: '#25d366', color: '#fff' }}>Agente IA</div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ background: '#f0f2f5' }}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#dcfce7' }}>
                <Phone size={24} style={{ color: '#25d366' }} />
              </div>
              <h3 className="text-lg font-medium mb-1" style={{ color: '#111b21' }}>Conversaciones WhatsApp</h3>
              <p className="text-xs max-w-xs" style={{ color: '#667781' }}>Selecciona una conversacion para ver el historial de calificacion del agente Sofia</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
