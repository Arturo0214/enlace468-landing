import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { logActivity } from '../../lib/auditLog'
import ComplianceBanner from '../ui/ComplianceBanner'

const inputClass = "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm"
const labelClass = "block text-sm font-medium text-gray-400 mb-1"

const purposeOptions = [
  { value: 'recruitment', label: 'Reclutamiento y seleccion' },
  { value: 'talent_pool', label: 'Conformacion de banco de talento' },
  { value: 'internal_mobility', label: 'Movilidad interna' },
  { value: 'succession_planning', label: 'Planificacion de sucesion' },
]

export default function CandidateForm({ onClose, onSaved, initial }) {
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: initial?.full_name || '', email: initial?.email || '', phone: initial?.phone || '',
    linkedin_url: initial?.linkedin_url || '', location: initial?.location || '',
    current_title: initial?.current_title || '', current_company: initial?.current_company || '',
    years_experience: initial?.years_experience || '', salary_expectation: initial?.salary_expectation || '',
    source: initial?.source || '', tags: initial?.tags?.join(', ') || '', notes: initial?.notes || '',
    // Compliance fields
    data_obtained_at: initial?.data_obtained_at || new Date().toISOString().split('T')[0],
    data_purpose: initial?.data_purpose || 'recruitment',
    consent_contact: initial?.consent_contact ?? false,
    consent_talent_pool: initial?.consent_talent_pool ?? false,
  })

  function update(f, v) { setForm(prev => ({ ...prev, [f]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.full_name.trim()) return
    setSaving(true)
    try {
      const payload = {
        organization_id: profile.organization_id, full_name: form.full_name.trim(),
        email: form.email || null, phone: form.phone || null, linkedin_url: form.linkedin_url || null,
        location: form.location || null, current_title: form.current_title || null,
        current_company: form.current_company || null,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
        salary_expectation: form.salary_expectation ? Number(form.salary_expectation) : null,
        source: form.source || null, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        notes: form.notes || null,
        data_obtained_at: form.data_obtained_at || null,
        data_purpose: form.data_purpose,
        consent_contact: form.consent_contact,
        consent_talent_pool: form.consent_talent_pool,
      }
      let entityId = initial?.id
      if (initial?.id) {
        await supabase.from('candidates').update(payload).eq('id', initial.id)
      } else {
        const { data } = await supabase.from('candidates').insert(payload).select('id').single()
        entityId = data?.id
      }
      if (entityId) {
        await logActivity('candidate', entityId, initial ? 'Candidato actualizado' : 'Candidato creado', {
          consent_contact: form.consent_contact,
          consent_talent_pool: form.consent_talent_pool,
        })
      }
      onSaved()
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-strong rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="font-display font-semibold text-white">{initial ? 'Editar candidato' : 'Nuevo candidato'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div><label className={labelClass}>Nombre completo *</label><input type="text" value={form.full_name} onChange={e => update('full_name', e.target.value)} required className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Email</label><input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Telefono</label><input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClass} /></div>
          </div>
          <div><label className={labelClass}>LinkedIn URL</label><input type="url" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/..." className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Puesto actual</label><input type="text" value={form.current_title} onChange={e => update('current_title', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Empresa actual</label><input type="text" value={form.current_company} onChange={e => update('current_company', e.target.value)} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelClass}>Ubicacion</label><input type="text" value={form.location} onChange={e => update('location', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Anos exp.</label><input type="number" value={form.years_experience} onChange={e => update('years_experience', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Expectativa $</label><input type="number" value={form.salary_expectation} onChange={e => update('salary_expectation', e.target.value)} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Fuente</label>
              <select value={form.source} onChange={e => update('source', e.target.value)} className={inputClass}>
                <option value="">Seleccionar...</option>
                <option value="linkedin">LinkedIn</option><option value="occ">OCC</option>
                <option value="referral">Referido</option><option value="direct">Directo</option><option value="other">Otro</option>
              </select>
            </div>
            <div><label className={labelClass}>Tags (coma)</label><input type="text" value={form.tags} onChange={e => update('tags', e.target.value)} placeholder="ventas, senior" className={inputClass} /></div>
          </div>
          <div><label className={labelClass}>Notas</label><textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} className={inputClass + ' resize-none'} /></div>

          {/* ── Compliance Section ────────────────────────────── */}
          <div className="pt-2">
            <ComplianceBanner type="consent">
              Datos requeridos para el cumplimiento de proteccion de datos personales.
            </ComplianceBanner>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Fecha de obtencion</label>
              <input type="date" value={form.data_obtained_at} onChange={e => update('data_obtained_at', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Finalidad</label>
              <select value={form.data_purpose} onChange={e => update('data_purpose', e.target.value)} className={inputClass}>
                {purposeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.consent_contact}
                onChange={e => update('consent_contact', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Autorizacion para contacto</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.consent_talent_pool}
                onChange={e => update('consent_talent_pool', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Autorizacion para banco de talento futuro</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button type="submit" disabled={saving || !form.full_name.trim()} className="px-4 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90">
              {saving ? 'Guardando...' : initial ? 'Actualizar' : 'Crear candidato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
