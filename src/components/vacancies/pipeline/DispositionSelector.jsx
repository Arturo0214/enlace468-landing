import { useState } from 'react'
import { CheckCircle2, Sparkles, Briefcase, Package, Clock, XCircle, Loader2, Wand2, ArrowRight } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { useToast } from '../../../lib/toast'
import { DISPOSITIONS, getDisposition, suggestDisposition } from '../../../lib/disposition'

// Iconos por disposición (el módulo puro guarda el NOMBRE del icono, no el
// componente — para no acoplar lucide al lib testeable).
const ICONS = { CheckCircle2, Sparkles, Briefcase, Package, Clock, XCircle }

// Punto de control E del diagrama de Ingrid, expandido (FASE C / §3 del plan):
// un candidato no-apto para FC se rutea a Tu Marca Vende, otro rol, otro
// producto o nurture — en vez de morir en 'rejected'. Guarda en
// vacancy_candidates (disposition, disposition_reason, disposition_at,
// disposition_by, routed_to) y deja rastro en candidate_interactions.
//
// Props:
//   vc          — el vacancy_candidate seleccionado (con .candidates fusionado)
//   onSaved(patch) — callback opcional para que el padre refresque su estado
export default function DispositionSelector({ vc, onSaved }) {
  const { profile } = useAuth()
  const toast = useToast()

  const current = vc?.disposition || 'fc_track'
  const [selected, setSelected] = useState(current)
  const [reason, setReason] = useState(vc?.disposition_reason || '')
  const [routedTo, setRoutedTo] = useState(vc?.routed_to || '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  // Sugerencia automática (reglas puras). Se calcula con lo que hay del
  // candidato aplanado (vc + vc.candidates).
  const candForSuggest = { ...(vc?.candidates || {}), match_score: vc?.match_score, ...vc }
  const suggestion = suggestDisposition(candForSuggest)
  const suggestionDef = getDisposition(suggestion.value)

  const selectedDef = getDisposition(selected)
  const dirty = selected !== current
    || (reason.trim() !== (vc?.disposition_reason || '').trim())
    || (selectedDef.routes && routedTo.trim() !== (vc?.routed_to || '').trim())

  function applySuggestion() {
    setSelected(suggestion.value)
    if (!reason.trim()) setReason(suggestion.reason)
  }

  async function save() {
    if (!vc?.id) return
    setSaving(true)
    const now = new Date().toISOString()
    const cleanReason = reason.trim() || null
    const cleanRouted = selectedDef.routes ? (routedTo.trim() || null) : null
    const patch = {
      disposition: selected,
      disposition_reason: cleanReason,
      disposition_at: now,
      disposition_by: profile?.id || null,
      routed_to: cleanRouted,
    }

    const { error } = await supabase.from('vacancy_candidates').update(patch).eq('id', vc.id)
    if (error) {
      toast.error('No se pudo guardar la disposición: ' + error.message)
      setSaving(false)
      return
    }

    // Rastro en el timeline del candidato (type='disposition'). La columna
    // type es text libre (sin CHECK), así que este valor es válido.
    const label = selectedDef.label
    const routedNote = cleanRouted ? ` → ${cleanRouted}` : ''
    await supabase.from('candidate_interactions').insert({
      vacancy_candidate_id: vc.id,
      type: 'disposition',
      content: `Disposición: ${label}${routedNote}${cleanReason ? ` — ${cleanReason}` : ''}`,
      direction: 'outbound',
      performed_by: profile?.id || null,
    })

    // Log de actividad para el feed de la org (best-effort).
    if (profile?.organization_id) {
      await supabase.from('activity_log').insert({
        organization_id: profile.organization_id,
        entity_type: 'vacancy_candidate',
        entity_id: vc.id,
        action: `${vc.candidates?.full_name || 'Candidato'} → disposición: ${label}`,
        details: { disposition: selected, reason: cleanReason, routed_to: cleanRouted },
        performed_by: profile.id,
      }).then(() => {}, () => {})
    }

    setSavedAt(new Date())
    setSaving(false)
    toast.success(`Disposición guardada: ${label}`)
    onSaved?.(patch)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider flex items-center gap-1">
          <ArrowRight size={10} /> Disposición / Ruteo
        </p>
        {/* Chip de sugerencia automática */}
        <button
          type="button"
          onClick={applySuggestion}
          title={suggestion.reason}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Wand2 size={9} className="text-primary-light" />
          Sugerido: <span className={suggestionDef.color.text}>{suggestionDef.label}</span>
        </button>
      </div>

      {/* Grid de salidas */}
      <div className="grid grid-cols-2 gap-1.5">
        {DISPOSITIONS.map(d => {
          const Icon = ICONS[d.icon] || CheckCircle2
          const active = selected === d.value
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => setSelected(d.value)}
              title={d.description}
              className={`flex items-start gap-2 text-left px-2.5 py-2 rounded-lg border transition-colors ${
                active
                  ? `${d.color.bg} ${d.color.border}`
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
              }`}
            >
              <Icon size={13} className={`mt-0.5 flex-shrink-0 ${active ? d.color.text : 'text-gray-500'}`} />
              <div className="min-w-0">
                <div className={`text-[11px] font-medium ${active ? d.color.text : 'text-gray-300'}`}>{d.label}</div>
                <div className="text-[9px] text-gray-600 leading-tight line-clamp-2">{d.description}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Destino (routed_to) para las salidas que rutean */}
      {selectedDef.routes && (
        <div className="mt-2">
          <input
            type="text"
            value={routedTo}
            onChange={e => setRoutedTo(e.target.value)}
            placeholder={selected === 'otro_rol' ? 'Vacante / pool comercial destino…' : 'Producto destino (Academy, curso…)'}
            className="w-full text-[11px] text-gray-300 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 placeholder:text-gray-600 focus:outline-none focus:border-primary-light/40"
          />
        </div>
      )}

      {/* CTA especial para Tu Marca Vende */}
      {selected === 'tu_marca_vende' && (
        <div className="mt-2 flex items-start gap-2 text-[10px] rounded-lg px-2.5 py-2 bg-cyan-500/[0.07] border border-cyan-400/20 text-cyan-200">
          <Sparkles size={11} className="mt-0.5 flex-shrink-0 text-cyan-300" />
          <span>
            → Enviar al funnel <a href="/tu-marca-vende" target="_blank" rel="noopener" className="underline font-medium">Tu Marca Vende</a> (CV + LinkedIn $499).
            Al guardar se registra la oferta en el timeline del candidato.
          </span>
        </div>
      )}

      {/* Razón */}
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={2}
        placeholder="Razón de la disposición (por qué se rutea así)…"
        className="mt-2 w-full text-xs text-gray-300 bg-white/5 border border-white/10 rounded-lg p-2.5 resize-y placeholder:text-gray-600 focus:outline-none focus:border-primary-light/40"
      />

      {/* Guardar */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
          Guardar disposición
        </button>
        {savedAt && (
          <span className="text-[11px] text-emerald-400">
            Guardado {savedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}
