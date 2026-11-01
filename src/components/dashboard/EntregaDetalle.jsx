import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Flag, Pencil, Check, PlayCircle, RotateCcw, Trash2, Loader2,
  Upload, FileText, ImageIcon, Download, X, Send, Paperclip, CalendarDays, MessageSquare,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import {
  entregaUrgencia, urgenciaStyle, esActiva, fmtFecha, fmtFechaHora, fmtBytes,
  ENTREGA_ESTADOS, ENTREGAS_EMAILS, isEntregasMember,
} from '../../lib/entregas'
import EntregaFormModal from './entregas/EntregaFormModal'

const BUCKET = 'documents'
const firstName = (n) => (n || '').split(' ')[0]
const esImagen = (t) => (t || '').startsWith('image/')

const ESTADO_PILL = {
  pendiente: { label: 'Pendiente', cls: 'bg-primary-light/15 text-primary-light border-primary-light/25' },
  en_progreso: { label: 'En progreso', cls: 'bg-gold/15 text-gold-light border-gold/30' },
  entregado: { label: 'Entregada', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  cancelado: { label: 'Cancelada', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

export default function EntregaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  const esSuper = profile?.role === 'super_admin'
  const fileRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [entrega, setEntrega] = useState(null)
  const [admins, setAdmins] = useState([])
  const [evidencias, setEvidencias] = useState([])
  const [notas, setNotas] = useState([])
  const [nota, setNota] = useState('')
  const [enviandoNota, setEnviandoNota] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setLoading(true)
    try {
      const [eRes, aRes, evRes, nRes] = await Promise.all([
        supabase.from('admin_entregas').select('*, owner:profiles!admin_entregas_owner_id_fkey(full_name)').eq('id', id).single(),
        supabase.from('profiles').select('id, full_name, email').in('email', ENTREGAS_EMAILS).order('full_name'),
        supabase.from('admin_entrega_evidencias').select('*, uploader:profiles!admin_entrega_evidencias_uploaded_by_fkey(full_name)').eq('entrega_id', id).order('created_at', { ascending: false }),
        supabase.from('admin_entrega_notas').select('*, autor:profiles!admin_entrega_notas_autor_id_fkey(full_name)').eq('entrega_id', id).order('created_at', { ascending: true }),
      ])
      if (eRes.error) throw eRes.error
      setEntrega(eRes.data)
      setAdmins(aRes.data || [])
      setEvidencias(evRes.data || [])
      setNotas(nRes.data || [])
    } catch (e) {
      toast.error('No se pudo cargar la entrega: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const puedeEditar = entrega && (esSuper || entrega.owner_id === profile?.id)

  async function cambiarEstado(status) {
    const patch = { status, completed_at: status === 'entregado' ? new Date().toISOString() : null }
    setEntrega(prev => ({ ...prev, ...patch }))
    const { error } = await supabase.from('admin_entregas').update(patch).eq('id', id)
    if (error) { toast.error('No se pudo actualizar: ' + error.message); cargar() }
  }

  // ---------- EVIDENCIAS ----------
  async function subirArchivos(files) {
    if (!files?.length) return
    setSubiendo(true)
    try {
      for (const file of files) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_')
        const path = `entregas/${id}/${Date.now()}_${safe}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
        const { data, error } = await supabase.from('admin_entrega_evidencias').insert({
          entrega_id: id, file_url: urlData.publicUrl, file_path: path,
          file_name: file.name, file_type: file.type || null, size_bytes: file.size,
          uploaded_by: profile.id,
        }).select('*, uploader:profiles!admin_entrega_evidencias_uploaded_by_fkey(full_name)').single()
        if (error) throw error
        setEvidencias(prev => [data, ...prev])
      }
      toast.success('Evidencia subida')
    } catch (e) {
      toast.error('Error al subir: ' + e.message)
    } finally {
      setSubiendo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function borrarEvidencia(ev) {
    if (!window.confirm(`¿Borrar "${ev.file_name}"?`)) return
    const prev = evidencias
    setEvidencias(p => p.filter(x => x.id !== ev.id))
    try {
      const { error } = await supabase.from('admin_entrega_evidencias').delete().eq('id', ev.id)
      if (error) throw error
      await supabase.storage.from(BUCKET).remove([ev.file_path]).catch(() => {})
    } catch (e) {
      toast.error('No se pudo borrar: ' + e.message)
      setEvidencias(prev)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    subirArchivos([...(e.dataTransfer?.files || [])])
  }

  // ---------- NOTAS ----------
  async function agregarNota() {
    const texto = nota.trim()
    if (!texto) return
    setEnviandoNota(true)
    try {
      const { data, error } = await supabase.from('admin_entrega_notas').insert({
        entrega_id: id, texto, autor_id: profile.id,
      }).select('*, autor:profiles!admin_entrega_notas_autor_id_fkey(full_name)').single()
      if (error) throw error
      setNotas(prev => [...prev, data])
      setNota('')
    } catch (e) {
      toast.error('No se pudo agregar la nota: ' + e.message)
    } finally {
      setEnviandoNota(false)
    }
  }

  async function borrarNota(n) {
    const prev = notas
    setNotas(p => p.filter(x => x.id !== n.id))
    const { error } = await supabase.from('admin_entrega_notas').delete().eq('id', n.id)
    if (error) { toast.error('No se pudo borrar: ' + error.message); setNotas(prev) }
  }

  // ---------- EDITAR ----------
  function openEditar() {
    setForm({
      id: entrega.id, title: entrega.title, description: entrega.description || '',
      due_date: entrega.due_date ? entrega.due_date.slice(0, 10) : '',
      priority: entrega.priority || 'normal', owner_id: entrega.owner_id,
    })
    setShowForm(true)
  }
  async function guardar() {
    if (!form.title.trim()) return toast.error('Ponle un título')
    if (!form.due_date) return toast.error('Falta la fecha de entrega')
    setSaving(true)
    try {
      const { error } = await supabase.from('admin_entregas').update({
        title: form.title.trim(), description: form.description.trim() || null,
        due_date: form.due_date, priority: form.priority, owner_id: form.owner_id,
      }).eq('id', id)
      if (error) throw error
      toast.success('Entrega actualizada')
      setShowForm(false)
      cargar()
    } catch (e) {
      toast.error('Error al guardar: ' + e.message)
    } finally { setSaving(false) }
  }

  if (loading) return <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" size={28} /></div>
  if (profile && !isEntregasMember(profile)) {
    return <div className="glass rounded-2xl text-center py-20"><p className="text-gray-400">Sección privada.</p></div>
  }
  if (!entrega) return (
    <div className="glass rounded-2xl text-center py-20">
      <p className="text-gray-400">Entrega no encontrada.</p>
      <button onClick={() => navigate('/dashboard/entregas')} className="mt-4 text-sm text-accent">← Volver a Entregas</button>
    </div>
  )

  const u = entregaUrgencia(entrega)
  const s = urgenciaStyle(u)
  const cerrada = entrega.status === 'entregado' || entrega.status === 'cancelado'
  const pill = ESTADO_PILL[entrega.status] || ESTADO_PILL.pendiente

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate('/dashboard/entregas')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
        <ArrowLeft size={16} /> Entregas
      </button>

      {/* Encabezado */}
      <div className="glass-strong rounded-2xl overflow-hidden mb-5 flex">
        <div className={`w-1.5 ${s.bar} ${s.pulse ? 'animate-pulse' : ''}`} />
        <div className="flex-1 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {entrega.priority === 'high' && <Flag size={15} className="text-red-400" />}
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${s.badge}`}>{u.label}</span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${pill.cls}`}>{pill.label}</span>
              </div>
              <h1 className={`text-2xl font-display font-bold text-white ${cerrada ? 'line-through text-gray-400' : ''}`}>{entrega.title}</h1>
              {entrega.description && <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap max-w-2xl">{entrega.description}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1.5"><CalendarDays size={13} /> {fmtFecha(entrega.due_date)}</span>
                <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent">{firstName(entrega.owner?.full_name)}{entrega.owner_id === profile?.id ? ' · tú' : ''}</span>
              </div>
            </div>

            {puedeEditar && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {!cerrada && entrega.status === 'pendiente' && (
                  <button onClick={() => cambiarEstado('en_progreso')} className="det-act"><PlayCircle size={15} /> En progreso</button>
                )}
                {!cerrada && (
                  <button onClick={() => cambiarEstado('entregado')} className="det-act det-act-green"><Check size={15} /> Entregada</button>
                )}
                {cerrada && (
                  <button onClick={() => cambiarEstado('pendiente')} className="det-act"><RotateCcw size={14} /> Reabrir</button>
                )}
                <button onClick={openEditar} className="det-icon" title="Editar"><Pencil size={15} /></button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* EVIDENCIAS */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-white flex items-center gap-2"><Paperclip size={17} className="text-accent" /> Evidencias <span className="text-gray-500 text-sm font-normal">({evidencias.length})</span></h2>
            <button onClick={() => fileRef.current?.click()} disabled={subiendo}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/80 hover:bg-primary text-white disabled:opacity-50">
              {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => subirArchivos([...e.target.files])} />
          </div>

          <div onDragOver={e => e.preventDefault()} onDrop={onDrop}
            className="border-2 border-dashed border-white/10 rounded-xl p-5 text-center mb-4 hover:border-accent/30 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}>
            <Upload size={22} className="mx-auto text-gray-500 mb-1.5" />
            <p className="text-xs text-gray-400">Arrastra archivos aquí o haz clic para subir</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Imágenes, PDF, Word, Excel…</p>
          </div>

          {evidencias.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-4">Aún no hay evidencias.</p>
          ) : (
            <div className="space-y-2">
              {evidencias.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                  {esImagen(ev.file_type) ? (
                    <a href={ev.file_url} target="_blank" rel="noopener" className="flex-shrink-0">
                      <img src={ev.file_url} alt={ev.file_name} className="w-11 h-11 rounded object-cover" />
                    </a>
                  ) : (
                    <div className="w-11 h-11 rounded bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-primary-light" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{ev.file_name}</div>
                    <div className="text-[11px] text-gray-500">{fmtBytes(ev.size_bytes)} · {firstName(ev.uploader?.full_name)} · {fmtFechaHora(ev.created_at)}</div>
                  </div>
                  <a href={ev.file_url} target="_blank" rel="noopener" download title="Descargar" className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"><Download size={15} /></a>
                  {(esSuper || ev.uploaded_by === profile?.id) && (
                    <button onClick={() => borrarEvidencia(ev)} title="Borrar" className="p-1.5 rounded-lg text-gray-400 hover:bg-red-500/15 hover:text-red-400"><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NOTAS */}
        <div className="glass rounded-2xl p-5 flex flex-col">
          <h2 className="font-display font-semibold text-white flex items-center gap-2 mb-4"><MessageSquare size={17} className="text-accent" /> Notas <span className="text-gray-500 text-sm font-normal">({notas.length})</span></h2>

          <div className="flex-1 space-y-3 mb-4 min-h-[120px]">
            {notas.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-4">Sin notas todavía.</p>
            ) : notas.map(n => (
              <div key={n.id} className="bg-white/[0.03] rounded-lg p-3 border border-white/5 group">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-accent">{firstName(n.autor?.full_name) || 'Admin'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">{fmtFechaHora(n.created_at)}</span>
                    {(esSuper || n.autor_id === profile?.id) && (
                      <button onClick={() => borrarNota(n)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"><X size={13} /></button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.texto}</p>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) agregarNota() }}
              placeholder="Escribe una nota… (⌘/Ctrl+Enter)"
              className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm resize-none" />
            <button onClick={agregarNota} disabled={enviandoNota || !nota.trim()}
              className="p-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white disabled:opacity-40">
              {enviandoNota ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>

      {showForm && form && (
        <EntregaFormModal form={form} setForm={setForm} admins={admins} esSuper={esSuper}
          miId={profile?.id} saving={saving} onClose={() => setShowForm(false)} onSave={guardar} />
      )}

      <style>{`
        .det-act { display:flex; align-items:center; gap:6px; padding:7px 12px; border-radius:9px; font-size:12.5px; font-weight:600; color:#E5E7EB; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); }
        .det-act:hover { background:rgba(255,255,255,0.09); }
        .det-act-green { color:#34D399; background:rgba(16,185,129,0.12); border-color:rgba(16,185,129,0.25); }
        .det-act-green:hover { background:rgba(16,185,129,0.2); }
        .det-icon { padding:8px; border-radius:9px; color:#9CA3AF; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); }
        .det-icon:hover { color:#fff; }
      `}</style>
    </div>
  )
}
