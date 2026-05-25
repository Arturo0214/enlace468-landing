import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, User, Briefcase, Target, Tags, FileText, Save, Globe, Loader2, Sparkles, CheckCircle, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const STEPS = [
  { id: 1, label: 'Datos basicos', icon: User },
  { id: 2, label: 'Experiencia', icon: Briefcase },
  { id: 3, label: 'Objetivo', icon: Target },
  { id: 4, label: 'Habilidades', icon: Tags },
  { id: 5, label: 'Resumen', icon: FileText },
]

const PREDEFINED_SKILLS = [
  'Liderazgo', 'Comunicacion', 'Trabajo en equipo', 'Negociacion', 'Analisis de datos',
  'Gestion de proyectos', 'Ventas', 'Marketing digital', 'Excel avanzado', 'SQL',
  'Python', 'JavaScript', 'Finanzas', 'Contabilidad', 'Recursos Humanos',
  'Atencion al cliente', 'Logistica', 'Supply Chain', 'Lean Manufacturing', 'Six Sigma',
  'Scrum', 'Agile', 'Power BI', 'SAP', 'CRM', 'ERP', 'Tableau',
  'Ingles avanzado', 'Resolucion de problemas', 'Pensamiento critico',
]

const INDUSTRIES = [
  'Tecnologia', 'Finanzas', 'Manufactura', 'Retail', 'Salud', 'Educacion',
  'Consultoría', 'Logistica', 'Energia', 'Telecomunicaciones', 'Automotriz',
  'Alimentos y Bebidas', 'Farmaceutica', 'Construccion', 'Medios', 'Gobierno', 'Otro',
]

const MODALITIES = [
  { value: 'remote', label: 'Remoto' },
  { value: 'hybrid', label: 'Hibrido' },
  { value: 'onsite', label: 'Presencial' },
  { value: 'any', label: 'Sin preferencia' },
]

const initialForm = {
  // Step 1
  full_name: '',
  email: '',
  phone: '',
  location: '',
  // Step 2
  current_title: '',
  current_company: '',
  years_experience: '',
  industry: '',
  achievements: ['', '', ''],
  // Step 3
  target_role: '',
  target_industry: '',
  preferred_modality: '',
  salary_min: '',
  salary_max: '',
  // Step 4
  skills: [],
  custom_skill: '',
  // Step 5
  pitch: '',
}

export default function CandidateProfileBuilder() {
  const { profile } = useAuth()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    ...initialForm,
    full_name: profile?.full_name || '',
    email: profile?.email || '',
  })
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [published, setPublished] = useState(false)
  const [generatingPitch, setGeneratingPitch] = useState(false)

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const completionPct = useCallback(() => {
    let filled = 0
    let total = 0
    // Step 1 fields
    const s1 = ['full_name', 'email', 'phone', 'location']
    s1.forEach(k => { total++; if (form[k]?.trim()) filled++ })
    // Step 2
    const s2 = ['current_title', 'current_company', 'years_experience', 'industry']
    s2.forEach(k => { total++; if (form[k]?.toString().trim()) filled++ })
    total += 3
    form.achievements.forEach(a => { if (a.trim()) filled++ })
    // Step 3
    const s3 = ['target_role', 'target_industry', 'preferred_modality']
    s3.forEach(k => { total++; if (form[k]?.trim()) filled++ })
    // Step 4
    total++; if (form.skills.length > 0) filled++
    // Step 5
    total++; if (form.pitch?.trim()) filled++
    return Math.round((filled / total) * 100)
  }, [form])

  const toggleSkill = (skill) => {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  const addCustomSkill = () => {
    const s = form.custom_skill.trim()
    if (s && !form.skills.includes(s)) {
      setForm(prev => ({ ...prev, skills: [...prev.skills, s], custom_skill: '' }))
    }
  }

  const generatePitch = () => {
    setGeneratingPitch(true)
    setTimeout(() => {
      const pitch = `Soy ${form.full_name || 'un profesional'}, ${form.current_title || 'con experiencia'}${form.current_company ? ` en ${form.current_company}` : ''} con ${form.years_experience || 'varios'} anos de experiencia en ${form.industry || 'mi sector'}. ${form.achievements.filter(a => a.trim()).length > 0 ? `Entre mis logros destaco: ${form.achievements.filter(a => a.trim()).join('; ')}.` : ''} Busco oportunidades como ${form.target_role || 'profesional'} en ${form.target_industry || 'la industria'}, modalidad ${MODALITIES.find(m => m.value === form.preferred_modality)?.label?.toLowerCase() || 'flexible'}. Mis principales fortalezas incluyen ${form.skills.slice(0, 5).join(', ') || 'multiples competencias clave'}.`
      set('pitch', pitch)
      setGeneratingPitch(false)
    }, 1200)
  }

  const buildPayload = (status) => ({
    full_name: form.full_name,
    email: form.email,
    phone: form.phone,
    location: form.location,
    current_title: form.current_title,
    current_company: form.current_company,
    years_experience: form.years_experience ? Number(form.years_experience) : null,
    tags: form.skills,
    source: 'self_registration',
    notes: JSON.stringify({
      industry: form.industry,
      achievements: form.achievements.filter(a => a.trim()),
      target_role: form.target_role,
      target_industry: form.target_industry,
      preferred_modality: form.preferred_modality,
      salary_range: form.salary_min || form.salary_max
        ? `${form.salary_min || '?'} - ${form.salary_max || '?'} MXN`
        : null,
      pitch: form.pitch,
      profile_status: status,
      completion_pct: completionPct(),
    }),
    organization_id: profile?.organization_id,
  })

  const handleSaveDraft = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await supabase.from('candidates').upsert(buildPayload('draft'), { onConflict: 'email' })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    setPublished(false)
    try {
      await supabase.from('candidates').upsert(buildPayload('published'), { onConflict: 'email' })
      setPublished(true)
    } catch (err) {
      console.error(err)
    } finally {
      setPublishing(false)
    }
  }

  const pct = completionPct()

  const inputClass = 'w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-light/40 focus:ring-1 focus:ring-primary-light/20 transition-colors'
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5'

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <Link to="/dashboard/marca-vende" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors mb-4">
          <ArrowLeft size={14} /> Tu Marca Vende
        </Link>
        <h1 className="text-2xl font-display font-bold text-white">Construye tu Perfil Profesional</h1>
        <p className="text-gray-400 text-sm mt-1">Completa cada seccion para maximizar tu visibilidad ante reclutadores.</p>
      </motion.div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Perfil completado</span>
          <span className="text-xs font-bold text-primary-light">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s) => {
          const Icon = s.icon
          const active = step === s.id
          const done = step > s.id
          return (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                active
                  ? 'bg-primary/20 text-primary-light border border-primary-light/20'
                  : done
                  ? 'bg-accent/10 text-accent border border-accent/10'
                  : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10'
              }`}
            >
              {done ? <CheckCircle size={14} /> : <Icon size={14} />}
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="glass rounded-xl p-6"
        >
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-display font-semibold text-white mb-4">Datos basicos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombre completo</label>
                  <input className={inputClass} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Juan Perez" />
                </div>
                <div>
                  <label className={labelClass}>Correo electronico</label>
                  <input className={inputClass} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="juan@email.com" />
                </div>
                <div>
                  <label className={labelClass}>Telefono</label>
                  <input className={inputClass} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+52 55 1234 5678" />
                </div>
                <div>
                  <label className={labelClass}>Ubicacion</label>
                  <input className={inputClass} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Ciudad de Mexico, CDMX" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-display font-semibold text-white mb-4">Experiencia profesional</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Titulo actual</label>
                  <input className={inputClass} value={form.current_title} onChange={e => set('current_title', e.target.value)} placeholder="Gerente de Operaciones" />
                </div>
                <div>
                  <label className={labelClass}>Empresa actual</label>
                  <input className={inputClass} value={form.current_company} onChange={e => set('current_company', e.target.value)} placeholder="Empresa SA de CV" />
                </div>
                <div>
                  <label className={labelClass}>Anos de experiencia</label>
                  <input className={inputClass} type="number" min="0" value={form.years_experience} onChange={e => set('years_experience', e.target.value)} placeholder="5" />
                </div>
                <div>
                  <label className={labelClass}>Industria</label>
                  <select className={inputClass} value={form.industry} onChange={e => set('industry', e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>3 logros principales</label>
                {form.achievements.map((a, idx) => (
                  <input
                    key={idx}
                    className={`${inputClass} mb-2`}
                    value={a}
                    onChange={e => {
                      const copy = [...form.achievements]
                      copy[idx] = e.target.value
                      set('achievements', copy)
                    }}
                    placeholder={`Logro ${idx + 1}: ej. Incremento ventas un 30%`}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-display font-semibold text-white mb-4">Objetivo profesional</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Rol buscado</label>
                  <input className={inputClass} value={form.target_role} onChange={e => set('target_role', e.target.value)} placeholder="Director de Marketing" />
                </div>
                <div>
                  <label className={labelClass}>Industria target</label>
                  <select className={inputClass} value={form.target_industry} onChange={e => set('target_industry', e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Modalidad preferida</label>
                  <select className={inputClass} value={form.preferred_modality} onChange={e => set('preferred_modality', e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {MODALITIES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Salario min (MXN)</label>
                    <input className={inputClass} type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)} placeholder="25,000" />
                  </div>
                  <div>
                    <label className={labelClass}>Salario max (MXN)</label>
                    <input className={inputClass} type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)} placeholder="45,000" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-display font-semibold text-white mb-4">Habilidades y competencias</h2>
              <p className="text-sm text-gray-400 mb-3">Selecciona tus habilidades o agrega las tuyas.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {PREDEFINED_SKILLS.map(skill => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      form.skills.includes(skill)
                        ? 'bg-primary/20 text-primary-light border border-primary-light/30'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={form.custom_skill}
                  onChange={e => set('custom_skill', e.target.value)}
                  placeholder="Agregar habilidad personalizada..."
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
                />
                <button onClick={addCustomSkill} className="px-4 py-2 rounded-lg bg-primary/20 text-primary-light text-sm font-medium hover:bg-primary/30 transition-colors whitespace-nowrap">
                  Agregar
                </button>
              </div>
              {form.skills.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Seleccionadas ({form.skills.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {form.skills.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                        {s}
                        <button onClick={() => toggleSkill(s)} className="hover:text-white"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-display font-semibold text-white mb-4">Resumen / Pitch profesional</h2>
              <p className="text-sm text-gray-400 mb-3">Escribe un breve resumen o genera uno automaticamente a partir de tu informacion.</p>
              <textarea
                className={`${inputClass} min-h-[160px] resize-y`}
                value={form.pitch}
                onChange={e => set('pitch', e.target.value)}
                placeholder="Describe brevemente quien eres, que ofreces y que buscas..."
              />
              <button
                onClick={generatePitch}
                disabled={generatingPitch}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary/20 to-accent/10 text-primary-light text-sm font-medium hover:from-primary/30 hover:to-accent/20 transition-all disabled:opacity-50"
              >
                {generatingPitch ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generar con IA
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between mt-6 gap-3">
        <div className="flex gap-2">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-lg bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">
              <ArrowLeft size={14} /> Anterior
            </button>
          )}
          {step < 5 && (
            <button onClick={() => setStep(step + 1)} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-lg bg-primary/20 text-primary-light text-sm font-medium hover:bg-primary/30 transition-colors">
              Siguiente <ArrowRight size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? 'Guardado!' : 'Guardar borrador'}
          </button>
          {step === 5 && (
            <button
              onClick={handlePublish}
              disabled={publishing || pct < 30}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              {published ? 'Publicado!' : 'Publicar perfil'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
