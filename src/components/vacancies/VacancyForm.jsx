import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import FeatureGate from '../ui/FeatureGate'

const steps = [
  { id: 'basic', title: 'Info basica' },
  { id: 'details', title: 'Descripcion' },
  { id: 'competencies', title: 'Competencias' },
  { id: 'review', title: 'Revision' },
]

const modalityOptions = [
  { value: 'remote', label: 'Remoto' },
  { value: 'onsite', label: 'Presencial' },
  { value: 'hybrid', label: 'Hibrido' },
]

const priorityOptions = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
const labelClass = "block text-sm font-medium text-gray-400 mb-1"

export default function VacancyForm() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', company_name: '', department: '', location: '', modality: 'onsite',
    salary_min: '', salary_max: '', description: '', challenges: '', team_info: '',
    competencies: [{ name: '', weight: 0, description: '' }], priority: 'medium', target_date: '',
  })

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })) }
  function updateCompetency(i, field, value) {
    setForm(prev => { const c = [...prev.competencies]; c[i] = { ...c[i], [field]: value }; return { ...prev, competencies: c } })
  }
  function addCompetency() { setForm(prev => ({ ...prev, competencies: [...prev.competencies, { name: '', weight: 0, description: '' }] })) }
  function removeCompetency(i) { setForm(prev => ({ ...prev, competencies: prev.competencies.filter((_, j) => j !== i) })) }

  async function handleSubmit() {
    setSaving(true)
    try {
      const { data, error } = await supabase.from('vacancies').insert({
        organization_id: profile.organization_id, created_by: profile.id,
        title: form.title, company_name: form.company_name || null, department: form.department || null,
        location: form.location || null, modality: form.modality,
        salary_min: form.salary_min ? Number(form.salary_min) : null, salary_max: form.salary_max ? Number(form.salary_max) : null,
        description: form.description || null, challenges: form.challenges || null, team_info: form.team_info || null,
        competencies: form.competencies.filter(c => c.name), priority: form.priority,
        target_date: form.target_date || null, status: 'open',
      }).select().single()
      if (error) throw error
      await supabase.from('activity_log').insert({ organization_id: profile.organization_id, entity_type: 'vacancy', entity_id: data.id, action: 'Vacante creada: ' + form.title, performed_by: profile.id })
      navigate(`/dashboard/vacancies/${data.id}`)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally { setSaving(false) }
  }

  return (
    <FeatureGate action="create_vacancy">
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/dashboard/vacancies')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm transition-colors">
        <ArrowLeft size={16} /> Volver a vacantes
      </button>
      <h1 className="text-2xl font-display font-bold text-white mb-6">Crear nueva vacante</h1>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              i <= step ? 'bg-gradient-to-r from-primary to-accent text-white' : 'bg-white/5 text-gray-500'
            }`}>{i + 1}</div>
            <span className={`text-sm hidden sm:block ${i <= step ? 'text-white font-medium' : 'text-gray-500'}`}>{s.title}</span>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-white/10 mx-2" />}
          </div>
        ))}
      </div>

      <div className="glass-strong rounded-2xl p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div><label className={labelClass}>Titulo del puesto *</label><input type="text" value={form.title} onChange={e => update('title', e.target.value)} placeholder="Ej. Director de Marketing" className={inputClass} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>Empresa cliente</label><input type="text" value={form.company_name} onChange={e => update('company_name', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Departamento</label><input type="text" value={form.department} onChange={e => update('department', e.target.value)} className={inputClass} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>Ubicacion</label><input type="text" value={form.location} onChange={e => update('location', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Modalidad</label><select value={form.modality} onChange={e => update('modality', e.target.value)} className={inputClass}>{modalityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className={labelClass}>Salario min (MXN)</label><input type="number" value={form.salary_min} onChange={e => update('salary_min', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Salario max (MXN)</label><input type="number" value={form.salary_max} onChange={e => update('salary_max', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Prioridad</label><select value={form.priority} onChange={e => update('priority', e.target.value)} className={inputClass}>{priorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            </div>
            <div><label className={labelClass}>Fecha limite</label><input type="date" value={form.target_date} onChange={e => update('target_date', e.target.value)} className={inputClass} /></div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div><label className={labelClass}>Descripcion del puesto</label><textarea value={form.description} onChange={e => update('description', e.target.value)} rows={6} placeholder="Responsabilidades, objetivos..." className={inputClass + ' resize-none'} /></div>
            <div><label className={labelClass}>Retos principales</label><textarea value={form.challenges} onChange={e => update('challenges', e.target.value)} rows={3} className={inputClass + ' resize-none'} /></div>
            <div><label className={labelClass}>Informacion del equipo</label><textarea value={form.team_info} onChange={e => update('team_info', e.target.value)} rows={3} className={inputClass + ' resize-none'} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Competencias a evaluar</label>
              <button onClick={addCompetency} className="text-sm text-primary hover:text-primary-light font-medium">+ Agregar</button>
            </div>
            {form.competencies.map((comp, i) => (
              <div key={i} className="flex gap-3 items-start bg-white/5 rounded-lg p-3 border border-white/5">
                <div className="flex-1 space-y-2">
                  <input type="text" value={comp.name} onChange={e => updateCompetency(i, 'name', e.target.value)} placeholder="Nombre (ej. Liderazgo)" className={inputClass} />
                  <input type="text" value={comp.description} onChange={e => updateCompetency(i, 'description', e.target.value)} placeholder="Descripcion breve" className={inputClass} />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Peso (%):</label>
                    <input type="number" value={comp.weight} onChange={e => updateCompetency(i, 'weight', Number(e.target.value))} min={0} max={100} className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm outline-none" />
                  </div>
                </div>
                {form.competencies.length > 1 && (
                  <button onClick={() => removeCompetency(i)} className="text-gray-500 hover:text-red-400 mt-2 text-lg">&times;</button>
                )}
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-white mb-4">Resumen de la vacante</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Titulo:</span> <span className="text-white font-medium ml-1">{form.title || '-'}</span></div>
              <div><span className="text-gray-500">Empresa:</span> <span className="text-gray-200 ml-1">{form.company_name || '-'}</span></div>
              <div><span className="text-gray-500">Ubicacion:</span> <span className="text-gray-200 ml-1">{form.location || '-'}</span></div>
              <div><span className="text-gray-500">Modalidad:</span> <span className="text-gray-200 ml-1">{modalityOptions.find(o => o.value === form.modality)?.label}</span></div>
              <div><span className="text-gray-500">Salario:</span> <span className="text-gray-200 ml-1">{form.salary_min && form.salary_max ? `$${Number(form.salary_min).toLocaleString()} - $${Number(form.salary_max).toLocaleString()} MXN` : '-'}</span></div>
              <div><span className="text-gray-500">Prioridad:</span> <span className="text-gray-200 ml-1">{priorityOptions.find(o => o.value === form.priority)?.label}</span></div>
            </div>
            {form.description && <div className="mt-4"><div className="text-sm text-gray-500 mb-1">Descripcion:</div><p className="text-sm text-gray-300 whitespace-pre-wrap">{form.description}</p></div>}
            {form.competencies.filter(c => c.name).length > 0 && (
              <div className="mt-4"><div className="text-sm text-gray-500 mb-2">Competencias:</div>
                <div className="flex flex-wrap gap-2">
                  {form.competencies.filter(c => c.name).map((c, i) => (
                    <span key={i} className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary-light font-medium">{c.name} ({c.weight}%)</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ArrowLeft size={16} /> Anterior
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !form.title} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
              Siguiente <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving || !form.title} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Sparkles size={16} />}
              {saving ? 'Creando...' : 'Crear vacante'}
            </button>
          )}
        </div>
      </div>
    </div>
    </FeatureGate>
  )
}
