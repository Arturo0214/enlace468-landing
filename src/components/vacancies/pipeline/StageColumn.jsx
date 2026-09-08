import { Droppable } from '@hello-pangea/dnd'
import { Heart } from 'lucide-react'
import PipelineCandidateCard from './PipelineCandidateCard'

// Columna droppable del tablero principal. En la columna "rejected" muestra
// el botón "Gracias por participar" (correo masivo de agradecimiento).
export default function StageColumn({ stage, items, getLabel, slaBadge, onOpenCandidate, onDeleteCandidate, onOpenThankYou }) {
  return (
    <Droppable droppableId={stage.id}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.droppableProps}
          className={`flex-shrink-0 w-56 rounded-xl p-3 border-t-2 flex flex-col ${stage.color} ${snapshot.isDraggingOver ? 'bg-primary/10' : stage.bg}`}
          style={{ border: '1px solid var(--border-default)', borderTopWidth: '2px' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{stage.label}</h3>
            <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{items.length}</span>
          </div>
          {stage.id === 'rejected' && items.length > 0 && (
            <button onClick={onOpenThankYou}
              className="w-full mb-2 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-medium transition-all"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#FCA5A5' }}>
              <Heart size={12} /> Gracias por participar
            </button>
          )}
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {items.map((vc, index) => (
              <PipelineCandidateCard key={vc.id} vc={vc} index={index} stage={stage}
                getLabel={getLabel} slaBadge={slaBadge} onOpen={onOpenCandidate} onDelete={onDeleteCandidate} />
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  )
}
