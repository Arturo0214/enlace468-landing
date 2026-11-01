import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Check, Clock, AlertTriangle, CalendarDays,
  X, Flag, Loader2, CheckCircle2, PlayCircle, RotateCcw,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import {
  entregaUrgencia, urgenciaStyle, esActiva, fmtFecha,
  ENTREGA_ESTADOS, ENTREGA_PRIORIDADES, startOfToday,
} from '../../lib/entregas'

const PRIORIDAD_OPTS = [
  { value: 'high', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Baja' },
]

const emptyForm = () => ({ id: null, title: '', description: '', due_date: '', priority: 'normal', owner_id: '' })

export default function EntregasView() {
  const { profile } = useAuth()
  const toast = useToast()
  const esSuper = profile?.role === 'super_admin'

  const [admins, setAdmins] = useState([])
  const [entregas, setEntregas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroOwner, setFiltroOwner] = useState('todos') // 'todos' | profile.id
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [showEntregadas, setShowEntregadas] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [adminsRes, entregasRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role')
          .in('role', ['admin', 'super_admin']).order('full_name'),
        supabase.from('admin_entregas')
          .select('*, owner:profiles!admin_entregas_owner_id_fkey(full_name)')
          .order('due_date', { ascending: true }),
      ])
      setAdmins(adminsRes.data || [])
      setEntregas(entregasRes.data || [])
    } catch (e) {
      toast.error('No se pudieron cargar las entregas: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const adminName = (id) => admins.find(a => a.id === id)?.full_name || 'Admin'
  const firstName = (n) => (n || '').split(' ')[0]

  function openNueva() {
    setForm({ ...emptyForm(), owner_id: profile?.id || '' })
    setShowForm(true)
  }
  function openEditar(e) {
    setForm({
      id: e.id, title: e.title, description: e.description || '',
      due_date: e.due_date ? e.due_date.slice(0, 10) : '',
      priority: e.priority || 'normal', owner_id: e.owner_id,
    })
    setShowForm(true)
  }

  async function guardar() {
    if (!form.title.trim()) return toast.error('Ponle un título a la entrega')
    if (!form.due_date) return toast.error('Falta la fecha de entrega')
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date,
        priority: form.priority,
        owner_id: form.owner_id || profile.id,
      }
      if (form.id) {
        const { error } = await supabase.from('admin_entregas').update(payload).eq('id', form.id)
        if (error) throw error
        toast.success('Entrega actualizada')
      } else {
        const { error } = await supabase.from('admin_entregas').insert({
          ...payload,
          organization_id: profile.organization_id,
          created_by: profile.id,
        })
        if (error) throw error
        toast.success('Entrega agregada a tu calendario')
      }
      setShowForm(false)
      await load()
    } catch (e) {
      toast.error('Error al guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function cambiarEstado(e, status) {
    try {
      const patch = { status, completed_at: status === 'entregado' ? new Date().toISOString() : null }
      const { error } = await supabase.from('admin_entregas').update(patch).eq('id', e.id)
      if (error) throw error
      setEntregas(prev => prev.map(x => x.id === e.id ? { ...x, ...patch } : x))
    } catch (err) {
      toast.error('No se pudo actualizar: ' + err.message)
    }
  }

  async function borrar(e) {
    if (!window.confirm(`¿Borrar la entrega "${e.title}"?`)) return
    try {
      const { error } = await supabase.from('admin_entregas').delete().eq('id', e.id)
      if (error) throw error
      setEntregas(prev => prev.filter(x => x.id !== e.id))
      toast.success('Entrega borrada')
    } catch (err) {
      toast.error('No se pudo borrar: ' + err.message)
    }
  }

  const hoy = startOfToday()

  const filtradas = useMemo(() => {
    const base = filtroOwner === 'todos' ? entregas : entregas.filter(e => e.owner_id === filtroOwner)
    return base.map(e => ({ ...e, _u: entregaUrgencia(e, hoy) }))
  }, [entregas, filtroOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  const activas = filtradas.filter(e => esActiva(e)).sort((a, b) => a._u.sort - b._u.sort)
  const cerradas = filtradas.filter(e => !esActiva(e)).sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))

  const kpis = useMemo(() => {
    const act = filtradas.filter(esActiva)
    return {
      urgentes: act.filter(e => e._u.key === 'urgente').length,
      hoy: act.filter(e => e._u.key === 'hoy').length,
      semana: act.filter(e => e._u.key === 'pronto').length,
      pendientes: act.length,
    }
  }, [filtradas])

  const puedeEditar = (e) => esSuper || e.owner_id === profile?.id

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Entregas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Pendientes administrativos del equipo · se vinculan a tu calendario</p>
        </div>
        <button onClick={openNueva}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-medium transition-colors">
          <Plus size={16} /> Nueva entrega
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi icon={AlertTriangle} label="Urgentes (vencidas)" value={kpis.urgentes} tone="red" />
        <Kpi icon={Clock} label="Vencen hoy" value={kpis.hoy} tone="gold" />
        <Kpi icon={CalendarDays} label="Próximas (3 días)" value={kpis.semana} tone="blue" />
        <Kpi icon={CheckCircle2} label="Pendientes totales" value={kpis.pendientes} tone="muted" />
      </div>

      {/* Filtro por admin */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <FilterChip active={filtroOwner === 'todos'} onClick={() => setFiltroOwner('todos')}>Todos</FilterChip>
        {admins.map(a => (
          <FilterChip key={a.id} active={filtroOwner === a.id} onClick={() => setFiltroOwner(a.id)}>
            {firstName(a.full_name)}{a.id === profile?.id ? ' (yo)' : ''}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="animate-spin mx-auto text-primary" size={28} /></div>
      ) : (
        <>
          {activas.length === 0 && cerradas.length === 0 ? (
            <div className="glass rounded-2xl text-center py-16">
              <CalendarDays size={36} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400">No hay entregas aquí todavía.</p>
              <button onClick={openNueva} className="mt-4 text-sm text-accent hover:text-accent-light">+ Agregar la primera</button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activas.map(e => (
                <EntregaCard key={e.id} e={e} ownerName={e.owner?.full_name || adminName(e.owner_id)}
                  esMia={e.owner_id === profile?.id} puedeEditar={puedeEditar(e)}
                  onEstado={cambiarEstado} onEdit={openEditar} onDelete={borrar} />
              ))}

              {cerradas.length > 0 && (
                <div className="pt-4">
                  <button onClick={() => setShowEntregadas(v => !v)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-300 flex items-center gap-1.5">
                    {showEntregadas ? '▾' : '▸'} Entregadas y cerradas ({cerradas.length})
                  </button>
                  {showEntregadas && (
                    <div className="space-y-2.5 mt-3">
                      {cerradas.map(e => (
                        <EntregaCard key={e.id} e={e} ownerName={e.owner?.full_name || adminName(e.owner_id)}
                          esMia={e.owner_id === profile?.id} puedeEditar={puedeEditar(e)}
                          onEstado={cambiarEstado} onEdit={openEditar} onDelete={borrar} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showForm && (
        <FormModal
          form={form} setForm={setForm} admins={admins} esSuper={esSuper}
          miId={profile?.id} saving={saving}
          onClose={() => setShowForm(false)} onSave={guardar} firstName={firstName}
        />
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, tone }) {
  const tones = {
    red: 'text-red-400', gold: 'text-gold-light', blue: 'text-primary-light', muted: 'text-gray-300',
  }
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className={tones[tone]} />
        <span className="text-[11px] text-gray-400 leading-tight">{label}</span>
      </div>
      <div className={`text-2xl font-display font-bold ${value > 0 && tone === 'red' ? 'text-red-400' : 'text-white'}`}>{value}</div>
    </div>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
      }`}>
      {children}
    </button>
  )
}

function EntregaCard({ e, ownerName, esMia, puedeEditar, onEstado, onEdit, onDelete }) {
  const u = e._u
  const s = urgenciaStyle(u)
  const cerrada = e.status === 'entregado' || e.status === 'cancelado'

  return (
    <div className={`glass rounded-xl border ${s.card} overflow-hidden flex`}>
      <div className={`w-1 flex-shrink-0 ${s.bar} ${s.pulse ? 'animate-pulse' : ''}`} />
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {e.priority === 'high' && <Flag size={13} className="text-red-400 flex-shrink-0" />}
              <h3 className={`font-medium text-white ${cerrada ? 'line-through text-gray-400' : ''}`}>{e.title}</h3>
            </div>
            {e.description && <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{e.description}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${s.badge}`}>{u.label}</span>
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <CalendarDays size={11} /> {fmtFecha(e.due_date)}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${esMia ? 'bg-accent/15 text-accent' : 'bg-white/5 text-gray-400'}`}>
                {ownerName}{esMia ? ' · tú' : ''}
              </span>
              {cerrada && (
                <span className="text-[11px] text-gray-500">{ENTREGA_ESTADOS[e.status]?.label}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {puedeEditar && !cerrada && e.status === 'pendiente' && (
              <IconBtn title="Marcar en progreso" onClick={() => onEstado(e, 'en_progreso')}><PlayCircle size={16} /></IconBtn>
            )}
            {puedeEditar && !cerrada && (
              <IconBtn title="Marcar entregada" tone="green" onClick={() => onEstado(e, 'entregado')}><Check size={16} /></IconBtn>
            )}
            {puedeEditar && cerrada && (
              <IconBtn title="Reabrir" onClick={() => onEstado(e, 'pendiente')}><RotateCcw size={15} /></IconBtn>
            )}
            {puedeEditar && (
              <IconBtn title="Editar" onClick={() => onEdit(e)}><Pencil size={15} /></IconBtn>
            )}
            {puedeEditar && (
              <IconBtn title="Borrar" tone="red" onClick={() => onDelete(e)}><Trash2 size={15} /></IconBtn>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function IconBtn({ children, title, tone, onClick }) {
  const tones = {
    green: 'hover:bg-green-500/15 hover:text-green-400',
    red: 'hover:bg-red-500/15 hover:text-red-400',
    default: 'hover:bg-white/10 hover:text-white',
  }
  return (
    <button title={title} onClick={onClick}
      className={`p-1.5 rounded-lg text-gray-400 transition-colors ${tones[tone] || tones.default}`}>
      {children}
    </button>
  )
}

function FormModal({ form, setForm, admins, esSuper, miId, saving, onClose, onSave, firstName }) {
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
