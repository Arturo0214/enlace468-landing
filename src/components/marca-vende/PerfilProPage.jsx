import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Copy, CheckCircle, Wand2, User, Briefcase, Target, Sparkles, Loader2, AlertCircle, Languages, FileText } from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import { useAuth } from '../../lib/auth'
import UpgradePrompt from '../ui/UpgradePrompt'
import CoherenceFlags from './CoherenceFlags'
import { optimizeProfile } from '../../lib/motorClient'
import { logOptimization, getMonthlyUsage, monthlyLimitForPlan } from '../../lib/optimizationUsage'

const INDUSTRIES = [
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'finanzas', label: 'Finanzas y Banca' },
  { value: 'marketing', label: 'Marketing y Publicidad' },
  { value: 'salud', label: 'Salud y Farmaceutica' },
  { value: 'educacion', label: 'Educacion' },
  { value: 'manufactura', label: 'Manufactura y Operaciones' },
  { value: 'ventas', label: 'Ventas y Desarrollo de Negocios' },
  { value: 'recursos_humanos', label: 'Recursos Humanos' },
  { value: 'legal', label: 'Legal y Compliance' },
  { value: 'otro', label: 'Otra' },
]

const STEPS = [
  { icon: User, label: 'Datos basicos' },
  { icon: Briefcase, label: 'Experiencia' },
  { icon: Target, label: 'Objetivos' },
  { icon: Sparkles, label: 'Generacion' },
]

// Mapea el formulario del wizard al insumo que espera el motor (server Express).
function buildPayload(data) {
  const industryLabel = INDUSTRIES.find(i => i.value === data.industria)?.label || data.industria
  const targetIndustryLabel = INDUSTRIES.find(i => i.value === data.industriaObjetivo)?.label || ''
  return {
    nombre: data.nombre,
    titulo: data.titulo,
    industria: industryLabel,
    industriaObjetivo: targetIndustryLabel || industryLabel,
    ubicacion: data.ubicacion,
    experiencia: Number(data.experiencia) || undefined, // años declarados (checkpoint de coherencia)
    fortalezas: data.fortalezas.filter(Boolean),
    rolActual: data.rolActual,
    logros: data.logros,
    historial: data.historial,
    rolObjetivo: data.rolObjetivo,
    salario: data.salario,
    conocidoPor: data.conocidoPor,
    remoto: true,
  }
}

// Partículas de confetti precalculadas fuera del render (Math.random no es puro).
const CONFETTI_COLORS = ['#2563EB', '#0D9488', '#F59E0B', '#14B8A6', '#D97706']
function makeConfetti() {
  return Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    rotate: Math.random() * 720,
    x: (Math.random() - 0.5) * 200,
    duration: 2 + Math.random(),
    delay: Math.random() * 0.5,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }))
}

// ── Copy button ──
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink transition-colors px-2 py-1 rounded bg-surface-1 hover:bg-white/10">
      {copied ? <><CheckCircle size={12} className="text-accent" /> Copiado</> : <><Copy size={12} /> Copiar</>}
    </button>
  )
}

export default function PerfilProPage() {
  const { canDo, currentPlan } = usePlan()
  const { profile } = useAuth()
  const [step, setStep] = useState(0)
  const [output, setOutput] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [aboutLang, setAboutLang] = useState('es')
  const [confetti, setConfetti] = useState([])

  const [formData, setFormData] = useState({
    nombre: '',
    titulo: '',
    industria: 'tecnologia',
    experiencia: '',
    ubicacion: '',
    fortalezas: ['', '', ''],
    rolActual: '',
    logros: '',
    historial: '',
    rolObjetivo: '',
    industriaObjetivo: '',
    salario: '',
    conocidoPor: '',
  })

  function update(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function updateFortaleza(index, value) {
    setFormData(prev => {
      const f = [...prev.fortalezas]
      f[index] = value
      return { ...prev, fortalezas: f }
    })
  }

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    try {
      // Límite mensual por plan (los admins lo saltan vía canDo en planContext).
      const limit = monthlyLimitForPlan(currentPlan)
      const used = await getMonthlyUsage(profile?.id)
      if (used >= limit) {
        setError(`Alcanzaste el límite de tu plan: ${limit} optimizaciones este mes. Mejora tu plan para generar más.`)
        setLoading(false)
        return
      }

      const result = await optimizeProfile(buildPayload(formData))
      setOutput(result)
      setAboutLang('es')
      setConfetti(makeConfetti())
      setTimeout(() => setConfetti([]), 3000)

      logOptimization({
        profileId: profile?.id,
        tipo: 'perfil',
        costUSD: result?._meta?.costUSD,
        flagsCount: result?.flags?.length || 0,
        rolObjetivo: formData.rolObjetivo || null,
        meta: result?._meta,
      })
    } catch (err) {
      setError(err.message || 'No se pudo generar el perfil. Revisa que el motor esté activo.')
    } finally {
      setLoading(false)
    }
  }

  function canAdvance() {
    if (step === 0) return formData.nombre.trim() && formData.titulo.trim() && formData.experiencia
    if (step === 1) return formData.rolActual.trim()
    if (step === 2) return true
    return true
  }

  const inputClass = 'w-full bg-surface-1 border border-line rounded-lg px-4 py-3 text-ink text-sm placeholder-gray-500 focus:outline-none focus:border-primary-light/50 transition-colors'
  const labelClass = 'block text-sm font-medium text-ink-secondary mb-1.5'

  if (!canDo('use_marca_vende')) {
    return <UpgradePrompt action="use_marca_vende" />
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/dashboard/marca-vende" className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink transition-colors mb-6">
        <ArrowLeft size={16} /> Tu Marca Vende
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-ink mb-1">Perfil Profesional IA</h1>
        <p className="text-ink-secondary mb-8">Genera tu headline, About bilingue, experiencia y palabras clave optimizadas para ATS y reclutadores — sin inflar tu historial.</p>
      </motion.div>

      {/* Progress Steps */}
      {!output && (
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = i === step
            const isDone = i < step
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full ${
                  isActive ? 'bg-primary-light/10 text-primary-light border border-primary-light/20' :
                  isDone ? 'bg-accent/10 text-accent' : 'bg-surface-1 text-ink-tertiary'
                }`}>
                  {isDone ? <Check size={14} /> : <Icon size={14} />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form Steps */}
      {!output && (
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-xl p-6">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Nombre completo</label>
                  <input className={inputClass} placeholder="Juan Perez Garcia" value={formData.nombre} onChange={e => update('nombre', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Titulo profesional actual</label>
                  <input className={inputClass} placeholder="Gerente de Marketing Digital" value={formData.titulo} onChange={e => update('titulo', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Industria</label>
                    <select className={inputClass} value={formData.industria} onChange={e => update('industria', e.target.value)}>
                      {INDUSTRIES.map(ind => (
                        <option key={ind.value} value={ind.value} className="bg-dark text-white">{ind.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Anos de experiencia</label>
                    <input type="number" min="0" max="50" className={inputClass} placeholder="8" value={formData.experiencia} onChange={e => update('experiencia', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Ubicacion</label>
                  <input className={inputClass} placeholder="Ciudad de Mexico" value={formData.ubicacion} onChange={e => update('ubicacion', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>3 fortalezas principales</label>
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <input key={i} className={inputClass} placeholder={['Ej: Liderazgo de equipos', 'Ej: Estrategia digital', 'Ej: Negociacion'][i]}
                        value={formData.fortalezas[i]} onChange={e => updateFortaleza(i, e.target.value)} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Descripcion de tu rol actual</label>
                  <textarea className={`${inputClass} min-h-[100px]`} placeholder="Describe que haces en tu posicion actual, tu equipo, responsabilidades principales..."
                    value={formData.rolActual} onChange={e => update('rolActual', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Logros principales (uno por linea)</label>
                  <textarea className={`${inputClass} min-h-[120px]`}
                    placeholder={"- Incremente ventas 35% en Q1 2024\n- Reduje costos operativos 20%\n- Lidere equipo de 15 personas"}
                    value={formData.logros} onChange={e => update('logros', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Resumen de tu trayectoria</label>
                  <textarea className={`${inputClass} min-h-[80px]`} placeholder="Breve resumen de tu carrera: empresas anteriores, roles, evolucion profesional..."
                    value={formData.historial} onChange={e => update('historial', e.target.value)} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Rol objetivo</label>
                  <input className={inputClass} placeholder="Director de Marketing" value={formData.rolObjetivo} onChange={e => update('rolObjetivo', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Industria objetivo</label>
                  <select className={inputClass} value={formData.industriaObjetivo} onChange={e => update('industriaObjetivo', e.target.value)}>
                    <option value="" className="bg-dark text-white">Misma industria</option>
                    {INDUSTRIES.map(ind => (
                      <option key={ind.value} value={ind.value} className="bg-dark text-white">{ind.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Rango salarial deseado</label>
                  <input className={inputClass} placeholder="$50,000 - $70,000 MXN mensuales" value={formData.salario} onChange={e => update('salario', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Quiero ser reconocido por...</label>
                  <input className={inputClass} placeholder="Ser un lider que transforma equipos y genera resultados" value={formData.conocidoPor} onChange={e => update('conocidoPor', e.target.value)} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Wand2 size={28} className="text-primary-light" />
                </div>
                <h3 className="text-lg font-display font-bold text-ink mb-2">Todo listo para generar</h3>
                <p className="text-sm text-ink-secondary mb-6 max-w-md mx-auto">
                  Generaremos tu headline (con variantes), About en espanol e ingles, experiencia en formula XYZ,
                  skills, palabras clave ATS y un checkpoint de honestidad.
                </p>
                {error && (
                  <div className="flex items-start gap-2 text-left text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-5 max-w-md mx-auto">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Generando…</> : <><Sparkles size={18} /> Generar Perfil Optimizado</>}
                </button>
                {loading && <p className="text-xs text-ink-tertiary mt-3">Esto toma unos segundos (Haiku 4.5 + pulido Sonnet).</p>}
              </div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          {step < 3 && (
            <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={step === 0}
                className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink transition-colors disabled:opacity-30 disabled:hover:text-ink-secondary"
              >
                <ArrowLeft size={16} /> Anterior
              </button>
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 text-sm font-semibold text-primary-light hover:text-ink transition-colors disabled:opacity-30 disabled:hover:text-primary-light"
              >
                Siguiente <ArrowRight size={16} />
              </button>
            </div>
          )}
          {step === 3 && !loading && (
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => setStep(2)} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink transition-colors">
                <ArrowLeft size={16} /> Anterior
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Output Results */}
      <AnimatePresence>
        {output && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Confetti-like particles */}
            {confetti.length > 0 && (
              <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
                {confetti.map((p) => (
                  <motion.div
                    key={p.id}
                    className="absolute w-2 h-2 rounded-full"
                    style={{ left: `${p.left}%`, top: -10, background: p.color }}
                    initial={{ y: -10, opacity: 1, rotate: 0 }}
                    animate={{ y: window.innerHeight + 20, opacity: 0, rotate: p.rotate, x: p.x }}
                    transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
                  />
                ))}
              </div>
            )}

            <div className="glass rounded-xl p-5 text-center">
              <CheckCircle size={32} className="text-accent mx-auto mb-2" />
              <h3 className="font-display font-bold text-ink">Perfil generado exitosamente</h3>
              <p className="text-sm text-ink-secondary mt-1">Copia cada seccion y pegala en tu LinkedIn. Revisa primero las alertas de honestidad.</p>
            </div>

            {/* Diagnóstico */}
            {output.diagnostico && (
              <div className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={16} className="text-primary-light" />
                  <h3 className="text-sm font-semibold text-ink">Diagnostico</h3>
                  {output.diagnostico.nivelEstimado && (
                    <span className="text-[10px] uppercase tracking-wide text-primary-light bg-primary-light/10 px-2 py-0.5 rounded-full">
                      Nivel: {output.diagnostico.nivelEstimado}
                    </span>
                  )}
                </div>
                {output.diagnostico.resumen && <p className="text-sm text-ink-secondary leading-relaxed mb-3">{output.diagnostico.resumen}</p>}
                {output.diagnostico.huecosKeywords?.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-secondary mb-2">Keywords que te faltan vs. el mercado:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {output.diagnostico.huecosKeywords.map((kw, i) => (
                        <span key={i} className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Checkpoint de honestidad */}
            <CoherenceFlags flags={output.flags} />

            {/* Headline */}
            {output.headline && (
              <div className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ink">Headline optimizado</h3>
                  <CopyButton text={output.headline.recomendado} />
                </div>
                <p className="text-base text-primary-light font-medium leading-relaxed mb-3">{output.headline.recomendado}</p>
                {output.headline.variantes?.length > 0 && (
                  <div className="space-y-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs text-ink-secondary">Variantes:</p>
                    {output.headline.variantes.map((v, i) => (
                      <div key={i} className="flex items-start justify-between gap-3">
                        <p className="text-sm text-ink-secondary">{v}</p>
                        <CopyButton text={v} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* About bilingüe */}
            {output.about && (
              <div className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-ink">Acerca de (About)</h3>
                    <div className="flex items-center gap-1 bg-surface-1 rounded-lg p-0.5">
                      {['es', 'en'].map(lang => (
                        <button key={lang} onClick={() => setAboutLang(lang)}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${aboutLang === lang ? 'bg-primary-light/20 text-primary-light' : 'text-ink-secondary hover:text-white'}`}>
                          <Languages size={11} /> {lang.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <CopyButton text={output.about[aboutLang] || ''} />
                </div>
                <div className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line">{output.about[aboutLang]}</div>
              </div>
            )}

            {/* Experiencia XYZ */}
            {output.experiencia?.length > 0 && (
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-ink mb-3">Experiencia (formula XYZ · {aboutLang.toUpperCase()})</h3>
                <div className="space-y-4">
                  {output.experiencia.map((exp, i) => {
                    const vinetas = (aboutLang === 'en' ? exp.vinetas_en : exp.vinetas_es) || exp.vinetas_es || exp.vinetas || []
                    return (
                      <div key={i} className="pl-3" style={{ borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-sm font-medium text-ink">{exp.puesto}{exp.empresa ? ` · ${exp.empresa}` : ''}</p>
                          <CopyButton text={vinetas.join('\n')} />
                        </div>
                        <ul className="space-y-1.5">
                          {vinetas.map((v, j) => (
                            <li key={j} className="text-sm text-ink-secondary leading-relaxed flex gap-2">
                              <span className="text-primary-light mt-1">•</span><span>{v}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Skills */}
            {output.skills && (
              <div className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ink">Skills</h3>
                  <CopyButton text={(output.skills.todas || []).join(', ')} />
                </div>
                {output.skills.fijar?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-ink-secondary mb-2">Fija estas 3 en LinkedIn (mayor peso):</p>
                    <div className="flex flex-wrap gap-2">
                      {output.skills.fijar.map((s, i) => (
                        <span key={i} className="text-xs bg-accent/10 border border-accent/30 text-accent px-3 py-1.5 rounded-full font-medium">★ {s}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(output.skills.todas || []).map((s, i) => (
                    <span key={i} className="text-xs bg-surface-1 border border-line text-ink-secondary px-3 py-1.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords ATS */}
            {output.keywords && (
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-ink mb-3">Palabras clave ATS</h3>
                {output.keywords.porCategoria && Object.entries(output.keywords.porCategoria).map(([cat, kws]) => (
                  <div key={cat} className="mb-3">
                    <p className="text-xs text-ink-secondary mb-1.5 capitalize">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(kws || []).map((kw, i) => (
                        <span key={i} className="text-xs bg-surface-1 border border-line text-ink-secondary px-2.5 py-1 rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {output.keywords.nicho?.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-secondary mb-1.5">Nicho</p>
                    <div className="flex flex-wrap gap-1.5">
                      {output.keywords.nicho.map((kw, i) => (
                        <span key={i} className="text-xs bg-primary-light/10 border border-primary-light/20 text-primary-light px-2.5 py-1 rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Meta / costo */}
            {output._meta && (
              <p className="text-center text-xs text-ink-tertiary">
                Generado con {output._meta.engine} · costo ≈ ${output._meta.costUSD}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/dashboard/marca-vende/cv"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary/80 to-accent/80 text-white text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2">
                <FileText size={16} /> Optimizar mi CV
              </Link>
              <button
                onClick={() => { setOutput(null); setStep(0); setError(null) }}
                className="flex-1 py-3 rounded-xl border border-line text-sm text-ink-secondary hover:text-ink hover:bg-white/5 transition-all"
              >
                Generar otro perfil
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
