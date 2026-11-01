import { X, Loader2 } from 'lucide-react'

const PRIORIDAD_OPTS = [
  { value: 'high', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Baja' },
]
const firstName = (n) => (n || '').split(' ')[0]

export default function EntregaFormModal({ form, setForm, admins, esSuper, miId, saving, onClose, onSave }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inputClass = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
  const labelClass = "block text-sm font-medium text-gray-400 mb-1"
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="glass-strong rounded-2xl w-full max-w-lg p-6" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-white text-lg">{form.id ? 'Editar entrega' : 'Nueva entrega'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Título *</label>
            <input className={inputClass} value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Ej. Enviar reporte ejecutivo a cliente" autoFocus />
          </div>
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea className={inputClass} rows={3} value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Detalle de la entrega (opcional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Fecha de entrega *</label>
              <input type="date" className={inputClass} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Prioridad</label>
              <select className={inputClass} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORIDAD_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Responsable</label>
            <select className={inputClass} value={form.owner_id} onChange={e => set('owner_id', e.target.value)}
              disabled={!esSuper && !!form.id}>
              {admins.map(a => (
                <option key={a.id} value={a.id}>{firstName(a.full_name)}{a.id === miId ? ' (yo)' : ''}</option>
              ))}
            </select>
            {!esSuper && <p className="text-[11px] text-gray-500 mt-1">Puedes crear entregas para ti o delegarlas a otro admin.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {form.id ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
