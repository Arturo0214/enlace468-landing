import { useEffect, useState } from 'react'
import { ClipboardList, ChevronDown, Loader2, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useToast } from '../../../lib/toast'
import {
  PIPELINE_DETAIL_GROUPS,
  loadDetail,
  saveDetail,
  detailBadges,
  toInputValue,
  normalizeFieldValue,
} from '../../../lib/pipelineDetail'

// Ficha operativa (proceso) — FASE D del plan de Ingrid (§1 de
// docs/CONTEXTO-COPILOTO-Y-RUTEO-2026-09.md). Formulario colapsable que llena
// candidate_pipeline_detail (psicométrico, orientación, docs, CNSF, inducción).
// El copiloto (src/lib/copilot.js) LEE estos campos para sus alertas; aquí es
// donde se capturan.
//
// Es una sección AISLADA del modal: hace su propia carga/escritura a BD (upsert
// tolerante a que la fila no exista aún) y no toca la lógica del modal ni la de
// disposición.
//
// Props:
//   vacancyCandidate — el vacancy_candidate seleccionado (necesita .id, .stage)
//   profile          — opcional; si no viene se toma de useAuth (organization_id)
export default function PipelineDetailForm({ vacancyCandidate, profile: profileProp }) {
  const { profile: profileCtx } = useAuth()
  const profile = profileProp || profileCtx
  const toast = useToast()

  const vcId = vacancyCandidate?.id || null
  const stage = vacancyCandidate?.stage || null
  const orgId = profile?.organization_id || null

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)      // fila de BD (o null si no existe)
  const [draft, setDraft] = useState({})          // ediciones pendientes { key: rawInputValue }
  const [savingGroup, setSavingGroup] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  // Candidato cuya ficha ya pedimos (o ya cargamos). Sirve de llave de
  // invalidación con el patrón "adjust state during render": si cambia el
  // candidato reseteamos el estado sin efectos en cascada. Al abrir se fija a
  // vcId aquí mismo (en render), no en el efecto, para no disparar la regla
  // react-hooks/set-state-in-effect.
  const [loadedForId, setLoadedForId] = useState(null)

  // Cambió el candidato → invalida lo cargado.
  if (vcId && loadedForId && loadedForId !== vcId) {
    setLoadedForId(null)
    setDetail(null)
    setDraft({})
    setSavedAt(null)
  }

  // Se abrió el panel para un candidato aún no cargado → marca "cargando" y
  // fija la llave, todo en render. El efecto de abajo hace sólo la lectura async.
  const shouldLoad = open && vcId && loadedForId !== vcId
  if (shouldLoad) {
    setLoadedForId(vcId)
    setLoading(true)
  }

  // Lectura async de la ficha (sólo I/O + resolución; sin setState síncrono).
  useEffect(() => {
    if (!open || loadedForId !== vcId || !vcId) return
    let alive = true
    loadDetail(supabase, vcId).then(({ data, error }) => {
      if (!alive) return
      if (error) toast.error('No se pudo cargar la ficha: ' + error.message)
      setDetail(data)
      setLoading(false)
    })
    return () => { alive = false }
  }, [open, vcId, loadedForId, toast])

  // Valor actual de un campo: el borrador si se editó, si no el de BD.
  function currentValue(field) {
    if (Object.prototype.hasOwnProperty.call(draft, field.key)) return draft[field.key]
    return toInputValue(field.type, detail?.[field.key])
  }

  function setField(field, raw) {
    setDraft(d => ({ ...d, [field.key]: raw }))
  }

  // ¿Un grupo tiene ediciones pendientes?
  function groupDirty(group) {
    return group.fields.some(f => Object.prototype.hasOwnProperty.call(draft, f.key))
  }

  async function saveGroup(group) {
    if (!vcId) return
    if (!orgId) { toast.error('Sin organización activa — no se puede guardar la ficha.'); return }
    const patch = {}
    for (const f of group.fields) {
      if (Object.prototype.hasOwnProperty.call(draft, f.key)) {
        patch[f.key] = normalizeFieldValue(f.type, draft[f.key])
      }
    }
    if (!Object.keys(patch).length) return

    setSavingGroup(group.id)
    const { data, error } = await saveDetail(supabase, {
      vacancyCandidateId: vcId,
      organizationId: orgId,
      patch,
    })
    setSavingGroup(null)
    if (error) { toast.error('No se pudo guardar: ' + error.message); return }

    // Refleja lo guardado y limpia el borrador de este grupo.
    if (data) setDetail(data)
    setDraft(d => {
      const next = { ...d }
      for (const f of group.fields) delete next[f.key]
      return next
    })
    setSavedAt(new Date())
    toast.success(`Ficha guardada — ${group.label}`)
  }

  const badges = detailBadges(detail, stage)

  return (
    <div>
      {/* Cabecera colapsable */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 py-1 group"
      >
        <span className="text-[10px] text-gray-600 uppercase tracking-wider flex items-center gap-1">
          <ClipboardList size={10} /> Ficha operativa (proceso)
        </span>
        <span className="flex items-center gap-1.5">
          {/* Badges de estado alineados con las alertas del copiloto */}
          {badges.map(b => (
            <span
              key={b.id}
              className={`text-[9px] px-1.5 py-0.5 rounded-full border ${badgeClass(b.tone)}`}
            >
              {b.label}
            </span>
          ))}
          <ChevronDown
            size={14}
            className={`text-gray-500 transition-transform group-hover:text-gray-300 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-3">
              <Loader2 size={12} className="animate-spin" /> Cargando ficha…
            </div>
          ) : (
            <>
              {!detail && (
                <p className="text-[10px] text-gray-600 flex items-center gap-1">
                  <CalendarClock size={10} /> Sin proceso registrado aún — se creará al guardar.
                </p>
              )}
              {PIPELINE_DETAIL_GROUPS.map(group => (
                <div
                  key={group.id}
                  className="rounded-xl p-3 bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-semibold text-gray-300">{group.label}</p>
                  </div>
                  {group.hint && <p className="text-[9px] text-gray-600 leading-tight mb-2">{group.hint}</p>}

                  <div className="grid grid-cols-2 gap-2">
                    {group.fields.map(field => (
                      <FieldInput
                        key={field.key}
                        field={field}
                        value={currentValue(field)}
                        onChange={raw => setField(field, raw)}
                      />
                    ))}
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveGroup(group)}
                      disabled={savingGroup === group.id || !groupDirty(group)}
                      className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium text-white disabled:opacity-40"
                      style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}
                    >
                      {savingGroup === group.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      Guardar {group.label.toLowerCase()}
                    </button>
                    {groupDirty(group) && (
                      <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
                        <AlertTriangle size={9} /> Cambios sin guardar
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {savedAt && (
                <p className="text-[11px] text-emerald-400">
                  Guardado {savedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Input por tipo de campo. `value` ya viene formateado (toInputValue) para
// date/datetime; para select/text es el string crudo.
function FieldInput({ field, value, onChange }) {
  const labelEl = (
    <span className="text-[9px] text-gray-500 uppercase tracking-wide block mb-1">{field.label}</span>
  )
  const inputBase =
    'w-full text-[11px] text-gray-300 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 placeholder:text-gray-600 focus:outline-none focus:border-primary-light/40'

  if (field.type === 'select') {
    return (
      <label className="block">
        {labelEl}
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={inputBase}>
          <option value="">—</option>
          {field.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    )
  }

  if (field.type === 'bool') {
    return (
      <label className="block">
        {labelEl}
        <button
          type="button"
          onClick={() => onChange(value === true || value === 'true' ? 'false' : 'true')}
          className={`w-full text-[11px] px-2 py-1.5 rounded-lg border transition-colors ${
            value === true || value === 'true'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-white/5 border-white/10 text-gray-500'
          }`}
        >
          {value === true || value === 'true' ? 'Sí' : 'No'}
        </button>
      </label>
    )
  }

  const inputType = field.type === 'datetime' ? 'datetime-local' : field.type === 'date' ? 'date' : 'text'
  return (
    <label className="block">
      {labelEl}
      <input
        type={inputType}
        value={value || ''}
        placeholder={field.placeholder || ''}
        onChange={e => onChange(e.target.value)}
        className={inputBase}
      />
    </label>
  )
}

function badgeClass(tone) {
  switch (tone) {
    case 'red': return 'bg-red-500/10 text-red-400 border-red-500/25'
    case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
    case 'amber':
    default: return 'bg-amber-500/10 text-amber-300 border-amber-500/25'
  }
}
