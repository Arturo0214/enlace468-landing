// Secuencias de outreach multi-touch (FASE 5) — CRUD estilo Gem/Lever.
// Define secuencias (nombre, vacante opcional, activa, stop_on_reply) y sus
// pasos (día, canal, plantilla o IA, condición). El envío real lo hace
// cron-sequence-runner con cuotas anti-ban; aquí SOLO se configura.
import { useEffect, useState } from 'react'
import { Workflow, Plus, Loader2, Trash2, Pencil, X, Save, Sparkles, Clock, CheckCircle, PauseCircle, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import FeatureGate from '../ui/FeatureGate'
import ConfirmDialog from '../ui/ConfirmDialog'

const CHANNELS = [
  { id: 'linkedin_connect', label: 'Conexión LinkedIn', hint: 'nota ≤200 caracteres' },
  { id: 'linkedin_message', label: 'Mensaje LinkedIn', hint: 'solo contactos de 1er grado' },
  { id: 'linkedin_inmail', label: 'InMail LinkedIn', hint: 'requiere Premium/Sales Nav' },
  { id: 'email', label: 'Email', hint: 'vía Resend' },
  { id: 'whatsapp_manual', label: 'WhatsApp (manual)', hint: 'queda pendiente para envío a mano' },
]
const CONDITIONS = [
  { id: 'always', label: 'Siempre' },
  { id: 'if_connected', label: 'Solo si ya conectó' },
  { id: 'if_not_connected', label: 'Solo si NO ha conectado' },
]

// Plantilla sugerida — día 0 conexión (nota IA), día 3 follow-up (IA), día 7 email (IA).
const RAP_TEMPLATE = {
  name: 'Secuencia RAP básica',
  stop_on_reply: true,
  steps: [
    { step_order: 1, day_offset: 0, channel: 'linkedin_connect', ai_generate: true, condition: 'always', template_subject: '', template_body: 'Hola {{nombre}}, vi tu experiencia como {{puesto}} y me gustaría conectar para platicarte de una oportunidad. Saludos.' },
    { step_order: 2, day_offset: 3, channel: 'linkedin_message', ai_generate: true, condition: 'if_connected', template_subject: '', template_body: 'Hola {{nombre}}, gracias por conectar. Te escribo por la vacante de {{vacante}} — por tu perfil creo que puede interesarte. ¿Te late platicar unos minutos esta semana?' },
    { step_order: 3, day_offset: 7, channel: 'email', ai_generate: true, condition: 'always', template_subject: 'Oportunidad: {{vacante}}', template_body: 'Hola {{nombre}},\n\nTe contacté por LinkedIn hace unos días por la vacante de {{vacante}}. Tu experiencia como {{puesto}} encaja muy bien con lo que buscamos.\n\n¿Tendrías 15 minutos esta semana para platicar?\n\nSaludos.' },
  ],
}

const emptyStep = (order) => ({ step_order: order, day_offset: order === 1 ? 0 : 3 * (order - 1), channel: 'linkedin_connect', ai_generate: false, condition: 'always', template_subject: '', template_body: '' })

export default function SequenceBuilder() {
  const { profile } = useAuth()
  const [sequences, setSequences] = useState([])
  const [vacancies, setVacancies] = useState([])
  const [enrollStats, setEnrollStats] = useState({}) // sequence_id → { active, replied, completed }
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // { id?, name, vacancy_id, is_active, stop_on_reply, steps: [] }
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // secuencia a confirmar
  const [error, setError] = useState(null)

  const orgId = profile?.organization_id

  async function fetchAll() {
    const [{ data: seqs }, { data: vacs }, { data: enrs }] = await Promise.all([
      supabase.from('outreach_sequences').select('*, sequence_steps(*)')
        .eq('organization_id', orgId).order('created_at', { ascending: false }),
      supabase.from('vacancies').select('id, title').eq('organization_id', orgId)
        .eq('status', 'open').order('title'),
      supabase.from('sequence_enrollments').select('sequence_id, status')
        .eq('organization_id', orgId).limit(1000),
    ])
    const stats = {}
    for (const e of enrs || []) {
      stats[e.sequence_id] = stats[e.sequence_id] || { active: 0, replied: 0, completed: 0, otros: 0 }
      if (e.status === 'active') stats[e.sequence_id].active++
      else if (e.status === 'replied') stats[e.sequence_id].replied++
      else if (e.status === 'completed') stats[e.sequence_id].completed++
      else stats[e.sequence_id].otros++
    }
    return { seqs, vacs, stats }
  }

  function applyData({ seqs, vacs, stats }) {
    setSequences((seqs || []).map(s => ({ ...s, sequence_steps: (s.sequence_steps || []).sort((a, b) => a.step_order - b.step_order) })))
    setVacancies(vacs || [])
    setEnrollStats(stats)
    setLoading(false)
  }

  async function load() {
    if (!orgId) return
    applyData(await fetchAll())
  }

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      const data = await fetchAll()
      if (!cancelled) applyData(data)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  function newSequence(template) {
    setError(null)
    setEditing(template
      ? { name: template.name, vacancy_id: '', is_active: true, stop_on_reply: template.stop_on_reply, steps: template.steps.map(s => ({ ...s })) }
      : { name: '', vacancy_id: '', is_active: true, stop_on_reply: true, steps: [emptyStep(1)] })
  }

  function editSequence(seq) {
    setError(null)
    setEditing({
      id: seq.id, name: seq.name, vacancy_id: seq.vacancy_id || '', is_active: seq.is_active, stop_on_reply: seq.stop_on_reply,
      steps: (seq.sequence_steps || []).map(s => ({ ...s })),
    })
  }

  function patchStep(i, patch) {
    setEditing(ed => ({ ...ed, steps: ed.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  }

  function removeStep(i) {
    setEditing(ed => ({ ...ed, steps: ed.steps.filter((_, j) => j !== i).map((s, j) => ({ ...s, step_order: j + 1 })) }))
  }

  async function saveSequence() {
    if (!editing?.name?.trim()) { setError('Ponle nombre a la secuencia.'); return }
    if (!editing.steps.length) { setError('Agrega al menos un paso.'); return }
    for (const s of editing.steps) {
      if (!s.ai_generate && !String(s.template_body || '').trim()) { setError(`El paso ${s.step_order} necesita plantilla o activar IA.`); return }
    }
    setSaving(true); setError(null)
    try {
      let seqId = editing.id
      const head = {
        name: editing.name.trim(), vacancy_id: editing.vacancy_id || null,
        is_active: editing.is_active, stop_on_reply: editing.stop_on_reply,
      }
      if (seqId) {
        const { error: err } = await supabase.from('outreach_sequences').update(head).eq('id', seqId)
        if (err) throw err
        // Reemplaza los pasos (scheduled_messages.step_id es ON DELETE SET NULL → seguro)
        const { error: delErr } = await supabase.from('sequence_steps').delete().eq('sequence_id', seqId)
        if (delErr) throw delErr
      } else {
        const { data, error: err } = await supabase.from('outreach_sequences')
          .insert({ ...head, organization_id: orgId, created_by: profile.id }).select().single()
        if (err) throw err
        seqId = data.id
      }
      const rows = editing.steps.map((s, i) => ({
        sequence_id: seqId, step_order: i + 1, day_offset: Number(s.day_offset) || 0,
        channel: s.channel, template_subject: s.template_subject || null, template_body: s.template_body || null,
        ai_generate: !!s.ai_generate, condition: s.condition || 'always',
      }))
      const { error: stepErr } = await supabase.from('sequence_steps').insert(rows)
      if (stepErr) throw stepErr
      setEditing(null)
      load()
    } catch (e) {
      setError(e.message || 'No se pudo guardar.')
    } finally { setSaving(false) }
  }

  function deleteSequence(seq) {
    setPendingDelete(seq)
  }

  async function confirmDeleteSequence() {
    const seq = pendingDelete
    if (!seq) return
    setDeletingId(seq.id)
    await supabase.from('outreach_sequences').delete().eq('id', seq.id) // cascade a steps/enrollments/outbox
    setDeletingId(null)
    setPendingDelete(null)
    load()
  }

  async function toggleActive(seq) {
    await supabase.from('outreach_sequences').update({ is_active: !seq.is_active }).eq('id', seq.id)
    load()
  }

  return (
    <FeatureGate action="use_outreach">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,169,157,0.15)' }}>
              <Workflow size={17} style={{ color: '#00A99D' }} />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold text-white">Secuencias de outreach</h1>
              <p className="text-xs text-gray-500">Multi-touch automático · cuota anti-ban LinkedIn · se detiene al responder</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => newSequence(RAP_TEMPLATE)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
              style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}>
              <Sparkles size={13} /> Secuencia RAP básica
            </button>
            <button onClick={() => newSequence(null)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-light text-white rounded-lg text-xs font-medium hover:bg-primary-light/90">
              <Plus size={13} /> Nueva secuencia
            </button>
          </div>
        </div>

        {loading ? (
          <div className="glass rounded-xl p-10 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : sequences.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center">
            <Workflow size={28} className="mx-auto text-gray-600 mb-3" />
            <p className="text-sm text-gray-400 mb-1">Aún no hay secuencias</p>
            <p className="text-xs text-gray-600 mb-4">Crea una desde cero o precarga la "Secuencia RAP básica" (día 0 conexión → día 3 follow-up → día 7 email).</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sequences.map(seq => {
              const st = enrollStats[seq.id]
              const vac = vacancies.find(v => v.id === seq.vacancy_id)
              return (
                <div key={seq.id} className="glass rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{seq.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {vac ? `Vacante: ${vac.title}` : seq.vacancy_id ? 'Vacante ligada' : 'Genérica (cualquier vacante)'}
                        {seq.stop_on_reply && ' · se detiene al responder'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggleActive(seq)}
                        className={`text-[10px] px-2 py-1 rounded-full font-medium ${seq.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-gray-400'}`}
                        title={seq.is_active ? 'Activa — clic para pausar' : 'Pausada — clic para activar'}>
                        {seq.is_active ? <><CheckCircle size={10} className="inline mr-0.5" />Activa</> : <><PauseCircle size={10} className="inline mr-0.5" />Pausada</>}
                      </button>
                      <button onClick={() => editSequence(seq)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06]" title="Editar"><Pencil size={13} /></button>
                      <button onClick={() => deleteSequence(seq)} disabled={deletingId === seq.id} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-40" title="Eliminar">
                        {deletingId === seq.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-2">
                    {(seq.sequence_steps || []).map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-[11px] text-gray-400 bg-white/[0.02] rounded-lg px-2.5 py-1.5">
                        <span className="flex items-center gap-1 text-gray-500 flex-shrink-0"><Clock size={10} /> Día {s.day_offset}</span>
                        <span className="text-white/80">{CHANNELS.find(c => c.id === s.channel)?.label || s.channel}</span>
                        {s.ai_generate && <span className="flex items-center gap-0.5" style={{ color: '#00A99D' }}><Sparkles size={9} /> IA</span>}
                        {s.condition !== 'always' && <span className="text-amber-400/80">{CONDITIONS.find(c => c.id === s.condition)?.label}</span>}
                      </div>
                    ))}
                  </div>
                  {st && (
                    <p className="text-[10px] text-gray-600 flex items-center gap-1">
                      <Users size={10} /> {st.active} en curso · {st.replied} respondieron · {st.completed} completadas
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Editor modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
            <div className="bg-[#111827] rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto border border-white/[0.08]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm font-semibold text-white">{editing.id ? 'Editar secuencia' : 'Nueva secuencia'}</p>
                <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-white p-1"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider">Nombre</label>
                    <input value={editing.name} onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                      placeholder="Ej. RAP básica"
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-primary-light/40 outline-none text-white text-sm placeholder-gray-600" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider">Vacante (opcional)</label>
                    <select value={editing.vacancy_id} onChange={e => setEditing(ed => ({ ...ed, vacancy_id: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] outline-none text-white text-sm">
                      <option value="">Genérica (usa la vacante del candidato)</option>
                      {vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={editing.is_active} onChange={e => setEditing(ed => ({ ...ed, is_active: e.target.checked }))} className="accent-teal-500" />
                    Activa
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer" title="Al detectar respuesta del candidato, la secuencia se detiene y se cancelan los mensajes en cola">
                    <input type="checkbox" checked={editing.stop_on_reply} onChange={e => setEditing(ed => ({ ...ed, stop_on_reply: e.target.checked }))} className="accent-teal-500" />
                    Detener al responder
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pasos</p>
                    <button onClick={() => setEditing(ed => ({ ...ed, steps: [...ed.steps, emptyStep(ed.steps.length + 1)] }))}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.06] text-gray-300 hover:text-white hover:bg-white/[0.1]">
                      <Plus size={10} className="inline" /> Agregar paso
                    </button>
                  </div>
                  <div className="space-y-3">
                    {editing.steps.map((s, i) => (
                      <div key={i} className="rounded-xl p-3.5 bg-white/[0.02] border border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                          <span className="text-[11px] font-bold text-white bg-white/[0.08] rounded px-2 py-0.5">Paso {i + 1}</span>
                          <label className="flex items-center gap-1 text-[11px] text-gray-400">
                            Día
                            <input type="number" min="0" value={s.day_offset}
                              onChange={e => patchStep(i, { day_offset: e.target.value })}
                              className="w-14 px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] outline-none text-white text-[11px]" />
                          </label>
                          <select value={s.channel} onChange={e => patchStep(i, { channel: e.target.value })}
                            className="px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] outline-none text-white text-[11px]"
                            title={CHANNELS.find(c => c.id === s.channel)?.hint}>
                            {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                          <select value={s.condition} onChange={e => patchStep(i, { condition: e.target.value })}
                            className="px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] outline-none text-white text-[11px]">
                            {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                          <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: s.ai_generate ? '#00A99D' : '#9ca3af' }}
                            title="Genera el mensaje con IA personalizado al candidato (si falla, usa la plantilla)">
                            <input type="checkbox" checked={!!s.ai_generate} onChange={e => patchStep(i, { ai_generate: e.target.checked })} className="accent-teal-500" />
                            <Sparkles size={10} /> IA
                          </label>
                          <div className="flex-1" />
                          <button onClick={() => removeStep(i)} className="p-1 rounded text-gray-600 hover:text-red-400" title="Quitar paso"><Trash2 size={12} /></button>
                        </div>
                        {s.channel === 'email' && (
                          <input value={s.template_subject || ''} onChange={e => patchStep(i, { template_subject: e.target.value })}
                            placeholder="Asunto (ej. Oportunidad: {{vacante}})"
                            className="mb-2 w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] outline-none text-white text-xs placeholder-gray-600" />
                        )}
                        <textarea value={s.template_body || ''} onChange={e => patchStep(i, { template_body: e.target.value })}
                          rows={3}
                          placeholder={s.ai_generate ? 'Plantilla de respaldo si la IA falla (opcional) — {{nombre}} {{vacante}} {{puesto}}' : 'Plantilla del mensaje — usa {{nombre}} {{vacante}} {{puesto}}'}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] outline-none text-white text-xs placeholder-gray-600 resize-y" />
                      </div>
                    ))}
                  </div>
                </div>

                {error && <p className="text-[11px] text-red-400">{error}</p>}
              </div>
              <div className="flex items-center justify-end gap-2 p-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-white">Cancelar</button>
                <button onClick={saveSequence} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-light text-white rounded-lg text-sm font-medium hover:bg-primary-light/90 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!pendingDelete}
          danger
          title={pendingDelete ? `¿Eliminar la secuencia "${pendingDelete.name}"?` : ''}
          message="Se detienen sus inscripciones y mensajes en cola."
          confirmLabel="Eliminar"
          loading={!!deletingId}
          onConfirm={confirmDeleteSequence}
          onCancel={() => { if (!deletingId) setPendingDelete(null) }}
        />
      </div>
    </FeatureGate>
  )
}
