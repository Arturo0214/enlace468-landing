import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Copy, CheckCircle, Wand2, User, Briefcase, Target, Sparkles } from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import UpgradePrompt from '../ui/UpgradePrompt'

// ── Industry keyword maps ──
const INDUSTRY_KEYWORDS = {
  tecnologia: ['transformacion digital', 'innovacion tecnologica', 'desarrollo de software', 'inteligencia artificial', 'cloud computing', 'ciberseguridad', 'agile', 'devops', 'data analytics'],
  finanzas: ['analisis financiero', 'gestion de riesgos', 'compliance', 'planeacion estrategica', 'auditoria', 'banca', 'inversiones', 'fintech', 'regulacion'],
  marketing: ['estrategia digital', 'growth marketing', 'brand management', 'content strategy', 'performance marketing', 'SEO/SEM', 'social media', 'CRM', 'analytics'],
  salud: ['gestion hospitalaria', 'salud publica', 'investigacion clinica', 'regulacion sanitaria', 'farmacovigilancia', 'atencion al paciente', 'dispositivos medicos', 'telemedicina'],
  educacion: ['diseno instruccional', 'edtech', 'desarrollo curricular', 'formacion docente', 'e-learning', 'evaluacion educativa', 'gestion academica', 'innovacion pedagogica'],
  manufactura: ['lean manufacturing', 'supply chain', 'control de calidad', 'mejora continua', 'six sigma', 'gestion de operaciones', 'automatizacion', 'logistica', 'ERP'],
  ventas: ['desarrollo de negocios', 'gestion comercial', 'negociacion', 'CRM', 'pipeline management', 'key account management', 'estrategia comercial', 'revenue growth'],
  recursos_humanos: ['talent acquisition', 'desarrollo organizacional', 'compensaciones', 'employer branding', 'people analytics', 'gestion del cambio', 'capacitacion', 'cultura organizacional'],
  legal: ['derecho corporativo', 'compliance', 'propiedad intelectual', 'litigio', 'contratos', 'gobierno corporativo', 'regulacion', 'due diligence'],
  otro: ['liderazgo', 'gestion de proyectos', 'pensamiento estrategico', 'comunicacion efectiva', 'trabajo en equipo', 'resolucion de problemas', 'toma de decisiones', 'orientacion a resultados'],
}

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

function generateProfile(data) {
  const { nombre, titulo, industria, experiencia, ubicacion, fortalezas, rolActual, logros, historial, rolObjetivo, industriaObjetivo, salario, conocidoPor } = data

  const industryLabel = INDUSTRIES.find(i => i.value === industria)?.label || industria
  const targetIndustryLabel = INDUSTRIES.find(i => i.value === industriaObjetivo)?.label || industriaObjetivo || industryLabel

  // Headline
  const valueProps = fortalezas.filter(Boolean)
  const headline = `${titulo} | ${valueProps.slice(0, 2).join(' & ')} | ${experiencia}+ anos en ${industryLabel}`

  // About (Acerca de mi)
  const para1 = `Soy ${nombre}, ${titulo.toLowerCase()} con mas de ${experiencia} anos de experiencia en ${industryLabel.toLowerCase()}. A lo largo de mi carrera, me he especializado en ${valueProps.join(', ').toLowerCase()}, generando impacto tangible en cada organizacion donde he colaborado.`

  const logrosText = logros.trim()
    ? `Entre mis principales logros destacan: ${logros.trim()}.`
    : `Me caracterizo por mi capacidad de entregar resultados medibles y superar objetivos.`

  const para2 = `${logrosText} Mi enfoque combina vision estrategica con ejecucion practica, lo que me permite transformar desafios en oportunidades de crecimiento.`

  const futureText = rolObjetivo
    ? `Actualmente busco una posicion como ${rolObjetivo} en ${targetIndustryLabel.toLowerCase()}, donde pueda aportar mi experiencia en ${valueProps[0]?.toLowerCase() || 'mi area de especialidad'} y seguir creciendo profesionalmente.`
    : `Estoy abierto a nuevas oportunidades donde pueda seguir aportando valor y creciendo profesionalmente.`

  const knownForText = conocidoPor
    ? ` Quiero ser reconocido por ${conocidoPor.toLowerCase()}.`
    : ''

  const para3 = `${futureText}${knownForText} Si buscas un profesional comprometido con la excelencia, conectemos.`

  const acercaDeMi = `${para1}\n\n${para2}\n\n${para3}`

  // Keywords
  const industryKws = INDUSTRY_KEYWORDS[industria] || INDUSTRY_KEYWORDS.otro
  const userKws = [...valueProps.map(f => f.toLowerCase()), titulo.toLowerCase()]
  const allKeywords = [...new Set([...userKws, ...industryKws])].slice(0, 15)

  // Pitch
  const pitch = `Hola, soy ${nombre}. Soy ${titulo.toLowerCase()} con ${experiencia} anos de experiencia en ${industryLabel.toLowerCase()}. Me especializo en ${valueProps.slice(0, 2).join(' y ').toLowerCase()}, y a lo largo de mi carrera he ${logros.trim() ? logros.split('\n')[0].toLowerCase().replace(/^[-•]\s*/, '') : 'generado resultados significativos para las organizaciones donde he trabajado'}. ${rolObjetivo ? `Actualmente estoy buscando una oportunidad como ${rolObjetivo.toLowerCase()} donde pueda aportar mi experiencia y seguir creciendo.` : 'Estoy explorando nuevas oportunidades donde pueda aportar valor.'} Me encantaria platicarte mas sobre como puedo contribuir a tu equipo.`

  // CV Summary
  const cvSummary = `${titulo} con ${experiencia}+ anos de experiencia en ${industryLabel.toLowerCase()}. Especialista en ${valueProps.join(', ').toLowerCase()}. ${logros.trim() ? `Logros clave: ${logros.split('\n')[0].replace(/^[-•]\s*/, '')}.` : 'Orientado a resultados con historial comprobado de impacto.'} ${rolObjetivo ? `En busqueda de oportunidades como ${rolObjetivo} en ${targetIndustryLabel.toLowerCase()}.` : ''}`

  return { headline, acercaDeMi, keywords: allKeywords, pitch, cvSummary }
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
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10">
      {copied ? <><CheckCircle size={12} className="text-accent" /> Copiado</> : <><Copy size={12} /> Copiar</>}
    </button>
  )
}

export default function PerfilProPage() {
  const { canDo } = usePlan()
  const [step, setStep] = useState(0)
  const [output, setOutput] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)

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

  function handleGenerate() {
    const result = generateProfile(formData)
    setOutput(result)
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 3000)
  }

  function canAdvance() {
    if (step === 0) return formData.nombre.trim() && formData.titulo.trim() && formData.experiencia
    if (step === 1) return formData.rolActual.trim()
    if (step === 2) return true
    return true
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-light/50 transition-colors'
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5'

  if (!canDo('use_marca_vende')) {
    return <UpgradePrompt action="use_marca_vende" />
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/dashboard/marca-vende" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6">
        <ArrowLeft size={16} /> Tu Marca Vende
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-white mb-1">Perfil Profesional IA</h1>
        <p className="text-gray-400 mb-8">Genera tu headline, resumen, pitch y palabras clave optimizadas en minutos.</p>
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
                  isDone ? 'bg-accent/10 text-accent' : 'bg-white/5 text-gray-500'
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
                <h3 className="text-lg font-display font-bold text-white mb-2">Todo listo para generar</h3>
                <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
                  Con la informacion que proporcionaste, generaremos tu headline, resumen profesional, palabras clave, pitch y resumen para CV.
                </p>
                <button
                  onClick={handleGenerate}
                  className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                >
                  <Sparkles size={18} /> Generar Perfil Optimizado
                </button>
              </div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          {step < 3 && (
            <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={step === 0}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-gray-400"
              >
                <ArrowLeft size={16} /> Anterior
              </button>
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 text-sm font-semibold text-primary-light hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-primary-light"
              >
                Siguiente <ArrowRight size={16} />
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => setStep(2)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
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
            {showConfetti && (
              <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
                {Array.from({ length: 30 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: -10,
                      background: ['#2563EB', '#0D9488', '#F59E0B', '#14B8A6', '#D97706'][i % 5],
                    }}
                    initial={{ y: -10, opacity: 1, rotate: 0 }}
                    animate={{
                      y: window.innerHeight + 20,
                      opacity: 0,
                      rotate: Math.random() * 720,
                      x: (Math.random() - 0.5) * 200,
                    }}
                    transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.5, ease: 'easeIn' }}
                  />
                ))}
              </div>
            )}

            <div className="glass rounded-xl p-5 text-center">
              <CheckCircle size={32} className="text-accent mx-auto mb-2" />
              <h3 className="font-display font-bold text-white">Perfil generado exitosamente</h3>
              <p className="text-sm text-gray-400 mt-1">Copia cada seccion y pegala en tu LinkedIn o CV.</p>
            </div>

            {/* Headline */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Headline optimizado</h3>
                <CopyButton text={output.headline} />
              </div>
              <p className="text-base text-primary-light font-medium leading-relaxed">{output.headline}</p>
            </div>

            {/* Acerca de mi */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Acerca de mi</h3>
                <CopyButton text={output.acercaDeMi} />
              </div>
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{output.acercaDeMi}</div>
            </div>

            {/* Keywords */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Palabras clave</h3>
                <CopyButton text={output.keywords.join(', ')} />
              </div>
              <div className="flex flex-wrap gap-2">
                {output.keywords.map((kw, i) => (
                  <span key={i} className="text-xs bg-white/5 border border-white/10 text-gray-300 px-3 py-1.5 rounded-full">{kw}</span>
                ))}
              </div>
            </div>

            {/* Pitch */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Pitch profesional (30 segundos)</h3>
                <CopyButton text={output.pitch} />
              </div>
              <p className="text-sm text-gray-300 leading-relaxed italic">"{output.pitch}"</p>
            </div>

            {/* CV Summary */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Resumen para CV</h3>
                <CopyButton text={output.cvSummary} />
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{output.cvSummary}</p>
            </div>

            {/* Start over */}
            <button
              onClick={() => { setOutput(null); setStep(0) }}
              className="w-full py-3 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Generar otro perfil
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
