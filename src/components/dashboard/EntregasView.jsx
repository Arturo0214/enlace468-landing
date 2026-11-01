import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Check, X, Flag, Loader2, PlayCircle, RotateCcw,
  Search, RefreshCw, CalendarDays, List, ClipboardX, ChevronRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import {
  entregaUrgencia, urgenciaStyle, esActiva, fmtFecha,
  ENTREGA_ESTADOS, startOfToday, ENTREGAS_EMAILS, isEntregasMember,
} from '../../lib/entregas'

const PRIORIDAD_OPTS = [
  { value: 'high', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Baja' },
]

const ESTADO_PILL = {
  pendiente: { label: 'Pendiente', cls: 'bg-primary-light/15 text-primary-light border-primary-light/25' },
  en_progreso: { label: 'En progreso', cls: 'bg-gold/15 text-gold-light border-gold/30' },
  entregado: { label: 'Entregada', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  cancelado: { label: 'Cancelada', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

const emptyForm = () => ({ id: null, title: '', description: '', due_date: '', priority: 'normal', owner_id: '' })

const firstName = (n) => (n || '').split(' ')[0]

// Texto relativo corto para la columna de fecha
function relTexto(dias) {
  if (dias === null || dias === undefined) return ''
  if (dias < 0) return `hace ${-dias}d`
  if (dias === 0) return 'hoy'
  return `en ${dias}d`
}

export default function EntregasView() {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const esSuper = profile?.role === 'super_admin'

  const [admins, setAdmins] = useState([])
  const [entregas, setEntregas] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [q, setQ] = useState('')
  const [filtroOwner, setFiltroOwner] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('activos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load(silent = false) {
    if (silent) setRefreshing(true); else setLoading(true)
    try {
      const [adminsRes, entregasRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role')
          .in('email', ENTREGAS_EMAILS).order('full_name'),
        supabase.from('admin_entregas')
          .select('*, owner:profiles!admin_entregas_owner_id_fkey(full_name)')
          .order('due_date', { ascending: true }),
      ])
      if (entregasRes.error) throw entregasRes.error
      setAdmins(adminsRes.data || [])
      setEntregas(entregasRes.data || [])
    } catch (e) {
      toast.error('No se pudieron cargar las entregas: ' + e.message)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  const adminName = (id) => admins.find(a => a.id === id)?.full_name || 'Admin'

  function openNueva() { setForm({ ...emptyForm(), owner_id: profile?.id || '' }); setShowForm(true) }
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
          ...payload, organization_id: profile.organization_id, created_by: profile.id,
        })
        if (error) throw error
        toast.success('Entrega agregada a tu calendario')
      }
      setShowForm(false)
      await load(true)
    } catch (e) {
      toast.error('Error al guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function cambiarEstado(e, status) {
    const patch = { status, completed_at: status === 'entregado' ? new Date().toISOString() : null }
    setEntregas(prev => prev.map(x => x.id === e.id ? { ...x, ...patch } : x)) // optimista
    try {
      const { error } = await supabase.from('admin_entregas').update(patch).eq('id', e.id)
      if (error) throw error
    } catch (err) {
      toast.error('No se pudo actualizar: ' + err.message)
      load(true)
    }
  }

  async function borrar(e) {
    if (!window.confirm(`¿Borrar la entrega "${e.title}"?`)) return
    const prev = entregas
    setEntregas(p => p.filter(x => x.id !== e.id)) // optimista
    try {
      const { error } = await supabase.from('admin_entregas').delete().eq('id', e.id)
      if (error) throw error
      toast.success('Entrega borrada')
    } catch (err) {
      toast.error('No se pudo borrar: ' + err.message)
      setEntregas(prev)
    }
  }

  const hoy = startOfToday()
  const puedeEditar = (e) => esSuper || e.owner_id === profile?.id

  // Enriquecer + filtrar por persona / búsqueda / rango de fecha
  const enriquecidas = useMemo(() => entregas.map(e => ({ ...e, _u: entregaUrgencia(e, hoy) })), [entregas]) // eslint-disable-line react-hooks/exhaustive-deps

  const universo = useMemo(() => {
    const term = q.trim().toLowerCase()
    return enriquecidas.filter(e => {
      if (filtroOwner !== 'todos' && e.owner_id !== filtroOwner) return false
      if (desde && e.due_date < desde) return false
      if (hasta && e.due_date > hasta) return false
      if (term) {
        const hay = `${e.title} ${e.description || ''} ${e.owner?.full_name || ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [enriquecidas, filtroOwner, q, desde, hasta])

  // KPIs (sobre el universo filtrado por persona/búsqueda/rango)
  const kpis = useMemo(() => {
    const act = universo.filter(esActiva)
    const bucket = (pred) => act.filter(pred)
    const names = (arr) => [...new Set(arr.map(e => firstName(e.owner?.full_name)))].filter(Boolean).slice(0, 3).join(' · ')
    const atrasadas = bucket(e => e._u.key === 'urgente')
    const hoyB = bucket(e => e._u.key === 'hoy')
    const manana = bucket(e => e._u.dias === 1)
    const pasado = bucket(e => e._u.dias === 2)
    const prox7 = bucket(e => e._u.dias >= 3 && e._u.dias <= 7)
    const enProg = bucket(e => e.status === 'en_progreso')
    const entregadas = universo.filter(e => e.status === 'entregado')
    return [
      { key: 'vencidas', label: 'Atrasadas', n: atrasadas.length, sub: names(atrasadas), tone: 'red' },
      { key: 'hoy', label: 'Hoy', n: hoyB.length, sub: names(hoyB), tone: 'gold' },
      { key: 'manana', label: 'Mañana', n: manana.length, sub: names(manana), tone: 'gold' },
      { key: 'pasado', label: 'Pasado mañana', n: pasado.length, sub: names(pasado), tone: 'muted' },
      { key: 'prox7', label: 'Próx. 7 días', n: prox7.length, sub: names(prox7), tone: 'blue' },
      { key: 'en_progreso', label: 'En progreso', n: enProg.length, sub: names(enProg), tone: 'muted' },
      { key: 'entregadas', label: 'Entregadas', n: entregadas.length, sub: names(entregadas), tone: 'green' },
    ]
  }, [universo])

  // Aplicar chip de estado para la tabla
  const filas = useMemo(() => {
    const f = universo.filter(e => {
      switch (filtroEstado) {
        case 'todos': return true
        case 'activos': return esActiva(e)
        case 'vencidas': return esActiva(e) && e._u.key === 'urgente'
        case 'hoy': return esActiva(e) && e._u.key === 'hoy'
        case 'manana': return esActiva(e) && e._u.dias === 1
        case 'pasado': return esActiva(e) && e._u.dias === 2
        case 'prox7': return esActiva(e) && e._u.dias >= 3 && e._u.dias <= 7
        case 'en_progreso': return e.status === 'en_progreso'
        case 'entregadas': return e.status === 'entregado'
        default: return esActiva(e)
      }
    })
    // vencidas primero; entregadas por fecha de cierre desc
    return f.sort((a, b) => {
      if (esActiva(a) !== esActiva(b)) return esActiva(a) ? -1 : 1
      if (esActiva(a)) return a._u.sort - b._u.sort
      return (b.completed_at || '').localeCompare(a.completed_at || '')
    })
  }, [universo, filtroEstado])

  const CHIPS = [
    { key: 'activos', label: 'Activas' },
    { key: 'vencidas', label: 'Atrasadas' },
    { key: 'hoy', label: 'Hoy' },
    { key: 'prox7', label: 'Próx. 7 días' },
    { key: 'en_progreso', label: 'En progreso' },
    { key: 'entregadas', label: 'Entregadas' },
    { key: 'todos', label: 'Todas' },
  ]

  if (profile && !isEntregasMember(profile)) {
    return (
      <div className="glass rounded-2xl text-center py-20">
        <ClipboardX size={40} className="mx-auto text-gray-600 mb-3" />
        <h2 className="text-lg font-display font-semibold text-white">Sección privada</h2>
        <p className="text-sm text-gray-400 mt-1">Las Entregas son solo para Flavio, Ingrid y Arturo.</p>
      </div>
    )
  }

  return (
    <div>
      <style>{ENTREGAS_CSS}</style>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Entregas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Pendientes administrativos del equipo — se vinculan a tu calendario.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="ent-seg">
            <button className="ent-seg-btn ent-seg-on"><List size={14} /> Lista</button>
            <button className="ent-seg-btn" onClick={() => navigate('/dashboard/calendar')}><CalendarDays size={14} /> Calendario de entregas</button>
          </div>
          <button onClick={openNueva} className="ent-btn-primary"><Plus size={15} /> Entrega</button>
          <button onClick={() => load(true)} title="Actualizar" className="ent-icon-btn">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPIs semáforo */}
      <div className="ent-kpis mb-4">
        {kpis.map(k => (
          <button key={k.key} onClick={() => setFiltroEstado(k.key)}
            className={`ent-kpi ${filtroEstado === k.key ? 'ent-kpi-on' : ''}`}>
            <div className="ent-kpi-label">{k.label}</div>
            <div className={`ent-kpi-n ent-n-${k.tone}`}>{k.n}</div>
            <div className="ent-kpi-sub">{k.sub || '—'}</div>
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="ent-search mb-3">
        <Search size={15} className="text-gray-500" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar entrega, responsable, detalle…" />
        {q && <button onClick={() => setQ('')} className="text-gray-500 hover:text-white"><X size={14} /></button>}
      </div>

      {/* Filtros: persona + estado + rango */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Chip active={filtroOwner === 'todos'} onClick={() => setFiltroOwner('todos')}>Todos</Chip>
        {admins.map(a => (
          <Chip key={a.id} active={filtroOwner === a.id} onClick={() => setFiltroOwner(a.id)}>
            {firstName(a.full_name)}{a.id === profile?.id ? ' (yo)' : ''}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        {CHIPS.map(c => (
          <Chip key={c.key} active={filtroEstado === c.key} onClick={() => setFiltroEstado(c.key)} subtle>{c.label}</Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-gray-400">
        <span>Entrega del</span>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="ent-date" />
        <span>al</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="ent-date" />
        {(desde || hasta) && <button onClick={() => { setDesde(''); setHasta('') }} className="text-gray-500 hover:text-white underline">limpiar</button>}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-16"><Loader2 className="animate-spin mx-auto text-primary" size={28} /></div>
      ) : filas.length === 0 ? (
        <div className="glass rounded-2xl text-center py-16">
          <CalendarDays size={36} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">No hay entregas con estos filtros.</p>
          <button onClick={openNueva} className="mt-4 text-sm text-accent hover:text-accent-light">+ Agregar entrega</button>
        </div>
      ) : (
        <div className="ent-tbl-wrap">
          <table className="ent-tbl">
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Responsable</th>
                <th>Estatus</th>
                <th>Fecha de entrega</th>
                <th className="text-right pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(e => {
                const u = e._u
                const s = urgenciaStyle(u)
                const cerrada = e.status === 'entregado' || e.status === 'cancelado'
                const pill = ESTADO_PILL[e.status] || ESTADO_PILL.pendiente
                const relCls = u.dias < 0 ? 'text-red-400' : u.dias === 0 ? 'text-gold-light' : 'text-gray-400'
                return (
                  <tr key={e.id} className="ent-row">
                    <td>
                      <div className="flex items-stretch gap-3">
                        <span className={`ent-bar ${s.bar} ${s.pulse ? 'animate-pulse' : ''}`} />
                        <div className="min-w-0 py-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {e.priority === 'high' && <Flag size={12} className="text-red-400 flex-shrink-0" />}
                            {esActiva(e) && (u.key === 'urgente' || u.key === 'hoy') && (
                              <span className={`ent-chip ${s.badge}`}>{u.key === 'urgente' ? 'URGENTE' : 'HOY'}</span>
                            )}
                            <span className={`font-medium text-white truncate ${cerrada ? 'line-through text-gray-500' : ''}`}>{e.title}</span>
                          </div>
                          {e.description && <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[42ch]">{e.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`ent-owner ${e.owner_id === profile?.id ? 'ent-owner-me' : ''}`}>
                        {firstName(e.owner?.full_name || adminName(e.owner_id))}{e.owner_id === profile?.id ? ' · tú' : ''}
                      </span>
                    </td>
                    <td><span className={`ent-status ${pill.cls}`}>{pill.label}</span></td>
                    <td>
                      <div className="text-sm text-white">{fmtFecha(e.due_date)}</div>
                      <div className={`text-[11px] ${relCls}`}>{esActiva(e) ? (u.key === 'urgente' ? `vencida ${relTexto(u.dias)}` : relTexto(u.dias)) : ENTREGA_ESTADOS[e.status]?.label}</div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1 pr-2">
                        {puedeEditar(e) && !cerrada && e.status === 'pendiente' && (
                          <IconBtn title="En progreso" onClick={() => cambiarEstado(e, 'en_progreso')}><PlayCircle size={16} /></IconBtn>
                        )}
                        {puedeEditar(e) && !cerrada && (
                          <IconBtn title="Marcar entregada" tone="green" onClick={() => cambiarEstado(e, 'entregado')}><Check size={16} /></IconBtn>
                        )}
                        {puedeEditar(e) && cerrada && (
                          <IconBtn title="Reabrir" onClick={() => cambiarEstado(e, 'pendiente')}><RotateCcw size={15} /></IconBtn>
                        )}
                        {puedeEditar(e) && <IconBtn title="Editar" onClick={() => openEditar(e)}><Pencil size={15} /></IconBtn>}
                        {puedeEditar(e) && <IconBtn title="Borrar" tone="red" onClick={() => borrar(e)}><Trash2 size={15} /></IconBtn>}
                        {!puedeEditar(e) && <ChevronRight size={16} className="text-gray-600" />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <FormModal form={form} setForm={setForm} admins={admins} esSuper={esSuper}
          miId={profile?.id} saving={saving} onClose={() => setShowForm(false)} onSave={guardar} />
      )}
    </div>
  )
}

function Chip({ active, onClick, children, subtle }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? (subtle ? 'bg-primary-light/20 text-primary-light' : 'bg-primary text-white')
               : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
      }`}>
      {children}
    </button>
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

function FormModal({ form, setForm, admins, esSuper, miId, saving, onClose, onSave }) {
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

const ENTREGAS_CSS = `
.ent-seg { display:flex; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:3px; gap:2px; }
.ent-seg-btn { display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:7px; font-size:12.5px; font-weight:500; color:#9CA3AF; transition:all .15s; white-space:nowrap; }
.ent-seg-btn:hover { color:#fff; }
.ent-seg-on { background:rgba(74,111,201,0.18); color:#8FA9E8; }
.ent-btn-primary { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; color:#fff; background:#4A6FC9; transition:background .15s; }
.ent-btn-primary:hover { background:#3d5fb0; }
.ent-icon-btn { padding:9px; border-radius:10px; color:#9CA3AF; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); }
.ent-icon-btn:hover { color:#fff; }

.ent-kpis { display:grid; grid-template-columns:repeat(7,1fr); gap:10px; }
@media (max-width:1100px){ .ent-kpis { grid-template-columns:repeat(4,1fr); } }
@media (max-width:640px){ .ent-kpis { grid-template-columns:repeat(2,1fr); } }
.ent-kpi { text-align:left; padding:12px 14px; border-radius:14px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06); transition:all .15s; }
.ent-kpi:hover { background:rgba(255,255,255,0.045); border-color:rgba(255,255,255,0.12); }
.ent-kpi-on { border-color:rgba(74,111,201,0.5); background:rgba(74,111,201,0.08); }
.ent-kpi-label { font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:#6B7280; font-weight:600; }
.ent-kpi-n { font-size:27px; line-height:1.1; font-weight:800; margin-top:2px; font-family:'DM Serif Display',Georgia,serif; }
.ent-n-red { color:#F87171; } .ent-n-gold { color:#F59E0B; } .ent-n-blue { color:#8FA9E8; } .ent-n-green { color:#34D399; } .ent-n-muted { color:#E5E7EB; }
.ent-kpi-sub { font-size:10.5px; color:#6B7280; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.ent-search { display:flex; align-items:center; gap:10px; padding:11px 15px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); }
.ent-search input { flex:1; background:transparent; border:none; outline:none; color:#F8FAFC; font-size:14px; }
.ent-search input::placeholder { color:#6B7280; }
.ent-date { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:5px 9px; color:#E5E7EB; color-scheme:dark; font-size:12px; }

.ent-tbl-wrap { border:1px solid rgba(255,255,255,0.07); border-radius:16px; overflow:hidden; background:rgba(255,255,255,0.015); }
.ent-tbl { width:100%; border-collapse:collapse; }
.ent-tbl thead th { text-align:left; font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; color:#6B7280; font-weight:600; padding:11px 12px; border-bottom:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.02); }
.ent-row td { padding:11px 12px; border-bottom:1px solid rgba(255,255,255,0.045); vertical-align:middle; }
.ent-row:last-child td { border-bottom:none; }
.ent-row:hover { background:rgba(255,255,255,0.025); }
.ent-bar { width:3px; border-radius:3px; flex-shrink:0; align-self:stretch; min-height:34px; }
.ent-chip { font-size:9.5px; font-weight:700; letter-spacing:.04em; padding:2px 7px; border-radius:999px; border-width:1px; border-style:solid; }
.ent-status { font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; border-width:1px; border-style:solid; white-space:nowrap; }
.ent-owner { font-size:12px; font-weight:500; color:#9CA3AF; padding:3px 9px; border-radius:999px; background:rgba(255,255,255,0.05); white-space:nowrap; }
.ent-owner-me { background:rgba(0,169,157,0.14); color:#2DD4BF; }
`
