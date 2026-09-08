import { Draggable } from '@hello-pangea/dnd'
import { User, Star, Trash2 } from 'lucide-react'
import { originBadge, scoreColor } from './stages'

// Tarjeta arrastrable del tablero principal: avatar, badges de origen/SLA/
// score, semáforo de respuesta (verde respondió / ámbar pendiente / rojo sin
// respuesta) y listones de oferta/contratado.
export default function PipelineCandidateCard({ vc, index, stage, getLabel, slaBadge, onOpen, onDelete }) {
  return (
    <Draggable draggableId={vc.id} index={index}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
          onClick={() => !snapshot.isDragging && onOpen(vc)}
          style={{
            ...provided.draggableProps.style,
            ...(stage.id === 'offer'
              ? { borderColor: 'rgba(34,197,94,0.5)', background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(16,185,129,0.03))', boxShadow: '0 0 0 1px rgba(34,197,94,0.2), 0 4px 12px rgba(34,197,94,0.08)' }
              : vc._interactions?.inbound > 0
              ? { borderColor: 'rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.08)', boxShadow: '0 0 0 1px rgba(34,197,94,0.15)' }
              : vc._interactions?.pending
              ? { borderColor: 'rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.08)', boxShadow: '0 0 0 1px rgba(245,158,11,0.15)' }
              : vc._interactions?.noResponse
              ? { borderColor: 'rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.08)', boxShadow: '0 0 0 1px rgba(239,68,68,0.15)' }
              : {}),
          }}
          className={`glass rounded-lg p-3 cursor-grab hover:border-primary/20 transition-all relative overflow-hidden group ${snapshot.isDragging ? 'shadow-lg shadow-primary/10 rotate-2' : ''}`}>
          {/* Red ribbon for offer */}
          {stage.id === 'offer' && (
            <div className="absolute -top-1 -right-1 w-12 h-12 overflow-hidden z-10">
              <div className="absolute top-[6px] right-[-14px] w-16 text-center text-[7px] font-bold text-white uppercase tracking-wider py-[2px]" style={{ background: 'linear-gradient(90deg, #DC2626, #EF4444)', transform: 'rotate(45deg)', boxShadow: '0 2px 4px rgba(220,38,38,0.3)' }}>
                {getLabel('offer')}
              </div>
            </div>
          )}
          {/* Green ribbon for hired */}
          {stage.id === 'hired' && (
            <div className="absolute -top-1 -right-1 w-14 h-14 overflow-hidden z-10">
              <div className="absolute top-[8px] right-[-12px] w-[72px] text-center text-[7px] font-bold text-white uppercase tracking-wider py-[2px]" style={{ background: 'linear-gradient(90deg, #059669, #10B981)', transform: 'rotate(45deg)', boxShadow: '0 2px 4px rgba(5,150,105,0.3)' }}>
                {getLabel('hired')}
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-gray-300 flex-shrink-0">
              <User size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{vc.candidates?.full_name}</div>
              {vc.candidates?.current_title && <div className="text-xs text-gray-400 truncate">{vc.candidates.current_title}</div>}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {(() => { const o = originBadge(vc.candidates?.source); return o ? <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${o.cls}`}>{o.label}</span> : null })()}
            {(() => { const s = slaBadge(vc); return s ? <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${s.cls}`} title={s.title}>SLA {s.days}d</span> : null })()}
            {vc.match_score != null && (
              <>
                <Star size={12} className="text-gold" />
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${scoreColor(vc.match_score)}`}>{Math.round(vc.match_score)}%</span>
              </>
            )}
            <div className="flex-1" />
            <button
              onClick={e => { e.stopPropagation(); onDelete(vc) }}
              className="text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded p-0.5 transition-all opacity-0 group-hover:opacity-100"
              title="Eliminar del pipeline">
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  )
}
