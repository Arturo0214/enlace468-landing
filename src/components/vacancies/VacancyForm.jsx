import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { logActivity } from '../../lib/auditLog'
import FeatureGate from '../ui/FeatureGate'
import ComplianceBanner from '../ui/ComplianceBanner'

const steps = [
  { id: 'basic', title: 'Info basica' },
  { id: 'details', title: 'Descripcion' },
  { id: 'competencies', title: 'Competencias' },
  { id: 'compliance', title: 'Compliance' },
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

const purposeOptions = [
  { value: 'recruitment', label: 'Reclutamiento y seleccion' },
  { value: 'talent_pool', label: 'Conformacion de banco de talento' },
  { value: 'internal_mobility', label: 'Movilidad interna' },
  { value: 'succession_planning', label: 'Planificacion de sucesion' },
]

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
const labelClass = "block text-sm font-medium text-gray-400 mb-1"

/* ── Simple template-based JD extraction (no API calls) ─────── */
function extractFromJD(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result = { title: '', competencies: [], skills: [], scorecard: '' }

  // Try to extract title from first non-empty line
  if (lines.length > 0) result.title = lines[0].replace(/^(puesto|titulo|posicion|cargo|vacante)\s*:?\s*/i, '').trim()

  // Extract competencies from lines with keywords
  const competencyKeywords = /competencia|habilidad blanda|soft skill|liderazgo|comunicaci|trabajo en equipo|resoluci|adaptab|negociaci|pensamiento cr/i
  const skillKeywords = /requisito|conocimiento|herramienta|tecnolog|idioma|certificaci|excel|sql|python|java|react|marketing|ventas|finanz/i

  lines.forEach(line => {
    const clean = line.replace(/^[-*\u2022]\s*/, '')
    if (competencyKeywords.test(clean) && clean.length < 120) result.competencies.push(clean)
    if (skillKeywords.test(clean) && clean.length < 120) result.skills.push(clean)
  })

  // Scorecard: grab lines mentioning KPI / meta / objetivo / indicador
  const scorecardLines = lines.filter(l => /kpi|meta|objetivo|indicador|resultado esperado|entregable/i.test(l))
  result.scorecard = scorecardLines.join('\n')

  return result
}

export default function VacancyForm() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', company_name: '', department: '', location: '', modality: 'onsite',
    salary_min: '', salary_max: '', description: '', challenges: '', team_info: '',
    competencies: [{ name: '', weight: 0, description: '' }], priority: 'medium', target_date: '',
    // New fields
    data_purpose: 'recruitment',
    process_owner: '',
    role_kpi: '',
    team_context: '',
  })

  /* AI intake state */
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [jdText, setJdText] = useState('')
  const [aiResult, setAiResult] = useState(null)

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })) }
  function updateCompetency(i, field, value) {
    setForm(prev => { const c = [...prev.competencies]; c[i] = { ...c[i], [field]: value }; return { ...prev, competencies: c } })
  }
  function addCompetency() { setForm(prev => ({ ...prev, competencies: [...prev.competencies, { name: '', weight: 0, description: '' }] })) }
  function removeCompetency(i) { setForm(prev => ({ ...prev, competencies: prev.competencies.filter((_, j) => j !== i) })) }

  function runIntakeExtraction() {
    if (!jdText.trim()) return
    const result = extractFromJD(jdText)
    setAiResult(result)
  }

  function applyAiSuggestions() {
    if (!aiResult) return
    setForm(prev => ({
      ...prev,
      title: aiResult.title || prev.title,
      competencies: aiResult.competencies.length > 0
        ? aiResult.competencies.map(c => ({ name: c, weight: 0, description: '' }))
        : prev.competencies,
      role_kpi: aiResult.scorecard || prev.role_kpi,
    }))
    setAiResult(null)
    setIntakeOpen(false)
  }

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
        data_purpose: form.data_purpose, process_owner: form.process_owner || null,
        role_kpi: form.role_kpi || null, team_context: form.team_context || null,
      }).select().single()
      if (error) throw error
      await logActivity('vacancy', data.id, 'Vacante creada: ' + form.title, { data_purpose: form.data_purpose })
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
      <div className="flex items-center gap-2 mb-8 overflow-x-auto">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all flex-shrink-0 ${
              i <= step ? 'bg-gradient-to-r from-primary to-accent text-white' : 'bg-white/5 text-gray-500'
            }`}>{i + 1}</div>
            <span className={`text-sm hidden sm:block truncate ${i <= step ? 'text-white font-medium' : 'text-gray-500'}`}>{s.title}</span>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-white/10 mx-2" />}
          </div>
        ))}
      </div>

      {/* ── AI Intake Panel (collapsible) ─────────────────────── */}
      <div className="glass rounded-xl mb-4">
        <button
          onClick={() => setIntakeOpen(!intakeOpen)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <span className="text-sm font-medium text-white">Asistente de Intake IA</span>
          </div>
          {intakeOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        <AnimatePresence>
          {intakeOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="pt-4">
                  <ComplianceBanner type="ai_suggestion">
                    Sugerencia IA. Revisa antes de guardar.
                  </ComplianceBanner>
                </div>

                <div>
                  <label className={labelClass}>Pega la descripcion del puesto (JD)</label>
                  <textarea
                    value={jdText}
                    onChange={e => setJdText(e.target.value)}
                    rows={6}
                    placeholder="Pega aqui el texto completo de la descripcion de puesto..."
                    className={inputClass + ' resize-none'}
                  />
                </div>

                <button
                  onClick={runIntakeExtraction}
                  disabled={!jdText.trim()}
                  className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-500/30 disabled:opacity-40 transition-colors"
                >
                  Extraer informacion
                </button>

                {aiResult && (
                  <div className="space-y-3 bg-white/5 rounded-lg p-4 border border-white/10">
                    <h4 className="text-sm font-medium text-white">Vista previa</h4>
                    {aiResult.title && (
                      <div><span className="text-xs text-gray-500">Titulo:</span> <span className="text-sm text-gray-200">{aiResult.title}</span></div>
                    )}
                    {aiResult.competencies.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500">Competencias:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {aiResult.competencies.map((c, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary-light">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiResult.skills.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500">Skills:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {aiResult.skills.map((s, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiResult.scorecard && (
                      <div><span className="text-xs text-gray-500">Scorecard/KPIs:</span><p className="text-xs text-gray-300 mt-1 whitespace-pre-wrap">{aiResult.scorecard}</p></div>
                    )}

                    <button
                      onClick={applyAiSuggestions}
                      className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Aplicar sugerencias
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass-strong rounded-2xl p-6">
        {/* Step 0: Basic info */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>Fecha limite</label><input type="date" value={form.target_date} onChange={e => update('target_date', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Responsable del proceso</label><input type="text" value={form.process_owner} onChange={e => update('process_owner', e.target.value)} placeholder="Nombre del responsable" className={inputClass} /></div>
            </div>
          </div>
        )}

        {/* Step 1: Description + new context fields */}
        {step === 1 && (
          <div className="space-y-4">
            <div><label className={labelClass}>Descripcion del puesto</label><textarea value={form.description} onChange={e => update('description', e.target.value)} rows={6} placeholder="Responsabilidades, objetivos..." className={inputClass + ' resize-none'} /></div>
            <div><label className={labelClass}>Retos principales</label><textarea value={form.challenges} onChange={e => update('challenges', e.target.value)} rows={3} className={inputClass + ' resize-none'} /></div>
            <div><label className={labelClass}>Informacion del equipo</label><textarea value={form.team_info} onChange={e => update('team_info', e.target.value)} rows={3} className={inputClass + ' resize-none'} /></div>
            <div><label className={labelClass}>KPI del rol</label><textarea value={form.role_kpi} onChange={e => update('role_kpi', e.target.value)} rows={2} placeholder="Indicadores clave de desempeno del puesto..." className={inputClass + ' resize-none'} /></div>
            <div><label className={labelClass}>Contexto del equipo</label><textarea value={form.team_context} onChange={e => update('team_context', e.target.value)} rows={2} placeholder="Tamano del equipo, cultura, dinamica..." className={inputClass + ' resize-none'} /></div>
          </div>
        )}

        {/* Step 2: Competencies */}
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

        {/* Step 3: Compliance */}
        {step === 3 && (
          <div className="space-y-4">
            <ComplianceBanner type="consent">
              Estos datos se utilizan para cumplir con la normativa de proteccion de datos personales.
            </ComplianceBanner>
            <div>
              <label className={labelClass}>Finalidad del tratamiento de datos *</label>
              <select value={form.data_purpose} onChange={e => update('data_purpose', e.target.value)} className={inputClass}>
                {purposeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-white mb-4">Resumen de la vacante</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Titulo:</span> <span className="text-white font-medium ml-1">{form.title || '-'}</span></div>
              <div><span className="text-gray-500">Empresa:</span> <span className="text-gray-200 ml-1">{form.company_name || '-'}</span></div>
              <div><span className="text-gray-500">Ubicacion:</span> <span className="text-gray-200 ml-1">{form.location || '-'}</span></div>
              <div><span className="text-gray-500">Modalidad:</span> <span className="text-gray-200 ml-1">{modalityOptions.find(o => o.value === form.modality)?.label}</span></div>
              <div><span className="text-gray-500">Salario:</span> <span className="text-gray-200 ml-1">{form.salary_min && form.salary_max ? `$${Number(form.salary_min).toLocaleString()} - $${Number(form.salary_max).toLocaleString()} MXN` : '-'}</span></div>
              <div><span className="text-gray-500">Prioridad:</span> <span className="text-gray-200 ml-1">{priorityOptions.find(o => o.value === form.priority)?.label}</span></div>
              <div><span className="text-gray-500">Responsable:</span> <span className="text-gray-200 ml-1">{form.process_owner || '-'}</span></div>
              <div><span className="text-gray-500">Finalidad datos:</span> <span className="text-gray-200 ml-1">{purposeOptions.find(o => o.value === form.data_purpose)?.label}</span></div>
            </div>
            {form.description && <div className="mt-4"><div className="text-sm text-gray-500 mb-1">Descripcion:</div><p className="text-sm text-gray-300 whitespace-pre-wrap">{form.description}</p></div>}
            {form.role_kpi && <div className="mt-4"><div className="text-sm text-gray-500 mb-1">KPI del rol:</div><p className="text-sm text-gray-300 whitespace-pre-wrap">{form.role_kpi}</p></div>}
            {form.team_context && <div className="mt-4"><div className="text-sm text-gray-500 mb-1">Contexto del equipo:</div><p className="text-sm text-gray-300 whitespace-pre-wrap">{form.team_context}</p></div>}
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
