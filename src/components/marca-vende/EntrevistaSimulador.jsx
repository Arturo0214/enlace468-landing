import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, Mic, CheckCircle, AlertCircle, Trophy,
  ChevronDown, RotateCcw
} from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import UpgradePrompt from '../ui/UpgradePrompt'

/* ───────── QUESTION BANKS ───────── */

const QUESTION_BANKS = {
  behavioral: [
    { q: 'Cuentame sobre una situacion en la que tuviste que manejar un conflicto en tu equipo de trabajo. ¿Como lo resolviste?', competency: 'Resolucion de conflictos' },
    { q: 'Describe una ocasion en la que tuviste que tomar una decision importante con informacion limitada. ¿Cual fue el resultado?', competency: 'Toma de decisiones' },
    { q: 'Dame un ejemplo de cuando lideraste un proyecto que no iba bien. ¿Que hiciste para reconducirlo?', competency: 'Liderazgo' },
    { q: '¿Puedes compartir una experiencia donde tuviste que adaptarte rapidamente a un cambio significativo en tu organizacion?', competency: 'Adaptabilidad' },
    { q: 'Cuentame sobre un logro profesional del que te sientas particularmente orgulloso. ¿Que lo hizo especial?', competency: 'Orientacion a resultados' },
    { q: 'Describe una situacion donde tuviste que trabajar con un companero dificil. ¿Como manejaste la relacion?', competency: 'Trabajo en equipo' },
    { q: '¿Has tenido que dar retroalimentacion negativa a alguien? ¿Como lo abordaste?', competency: 'Comunicacion' },
    { q: 'Cuentame sobre una vez que fallaste en alcanzar una meta. ¿Que aprendiste?', competency: 'Resiliencia' },
    { q: 'Describe una situacion en la que tuviste que influir en alguien sin tener autoridad directa sobre esa persona.', competency: 'Influencia' },
    { q: '¿Has implementado alguna mejora de proceso en tu trabajo anterior? ¿Que impacto tuvo?', competency: 'Mejora continua' },
    { q: 'Cuentame sobre una negociacion compleja que hayas liderado. ¿Cual fue tu estrategia?', competency: 'Negociacion' },
    { q: 'Describe un momento en que tuviste que priorizar multiples proyectos urgentes. ¿Como lo gestionaste?', competency: 'Gestion del tiempo' },
  ],
  technical: [
    { q: 'Explica tu experiencia con las herramientas y tecnologias clave que usas en tu rol actual. ¿Cual dominas mejor y por que?', competency: 'Dominio tecnico' },
    { q: '¿Como te mantienes actualizado en tu area de expertise? Dame ejemplos concretos de los ultimos 6 meses.', competency: 'Aprendizaje continuo' },
    { q: 'Describe el proyecto mas complejo tecnicamente que hayas liderado o en el que hayas participado.', competency: 'Complejidad tecnica' },
    { q: '¿Como evaluas y seleccionas nuevas herramientas o tecnologias para tu equipo o proyecto?', competency: 'Criterio tecnico' },
    { q: 'Explica un problema tecnico complejo que hayas resuelto. ¿Cual fue tu enfoque de diagnostico?', competency: 'Resolucion de problemas' },
    { q: '¿Como documentas y compartes conocimiento tecnico con tu equipo?', competency: 'Documentacion' },
    { q: 'Describe tu proceso de analisis cuando enfrentas un reto nuevo en tu area. ¿Que metodologia sigues?', competency: 'Pensamiento analitico' },
    { q: '¿Como manejas la deuda tecnica o los legacy systems en tus proyectos?', competency: 'Gestion tecnica' },
    { q: 'Cuentame sobre una vez que tuviste que aprender una tecnologia o herramienta nueva rapidamente para un proyecto.', competency: 'Agilidad de aprendizaje' },
    { q: '¿Como aseguras la calidad y confiabilidad de tu trabajo? ¿Que metricas o indicadores usas?', competency: 'Calidad' },
    { q: 'Describe como has integrado automatizacion o IA en tus procesos de trabajo.', competency: 'Innovacion' },
    { q: '¿Cual consideras que es la tendencia mas importante en tu industria actualmente y como te estas preparando?', competency: 'Vision estrategica' },
  ],
  case_study: [
    { q: 'Tu empresa acaba de perder al 30% de su equipo de ventas. ¿Que plan implementarias en los proximos 90 dias para recuperar la operacion?', competency: 'Planificacion estrategica' },
    { q: 'Un cliente clave amenaza con cancelar un contrato millonario por problemas de servicio. ¿Como lo abordas?', competency: 'Gestion de crisis' },
    { q: 'Te piden reducir costos operativos en un 20% sin afectar la productividad. ¿Que estrategia propones?', competency: 'Optimizacion' },
    { q: 'Tu equipo necesita adoptar una nueva metodologia de trabajo (ej. Agile) y hay resistencia al cambio. ¿Como lo manejas?', competency: 'Gestion del cambio' },
    { q: 'Tienes que lanzar un nuevo producto al mercado mexicano en 6 meses con un presupuesto limitado. ¿Cual seria tu plan?', competency: 'Go-to-market' },
    { q: 'Descubres que un miembro senior de tu equipo esta buscando trabajo activamente. ¿Que haces?', competency: 'Retencion de talento' },
    { q: 'Te asignan liderar la transformacion digital de un departamento tradicional. ¿Por donde empiezas?', competency: 'Transformacion' },
    { q: 'Tu empresa quiere expandirse a otro estado de Mexico. ¿Que factores analizarias y como armarias el equipo?', competency: 'Expansion' },
    { q: 'Recibes dos ofertas de candidatos igualmente calificados pero con expectativas salariales muy diferentes. ¿Como tomas la decision?', competency: 'Decision bajo presion' },
    { q: 'Tu principal competidor acaba de lanzar un producto que amenaza tu market share. ¿Que respuesta estrategica propones?', competency: 'Estrategia competitiva' },
  ],
}

const INDUSTRIES = [
  'Tecnologia / Software', 'Fintech', 'E-commerce', 'Manufactura',
  'Servicios Financieros', 'Salud / Farmaceutica', 'Retail',
  'Consultoria', 'Telecomunicaciones', 'Energia', 'Educacion',
  'Automotriz', 'Logistica', 'Alimentos y Bebidas', 'Otro',
]

const INTERVIEW_TYPES = [
  { key: 'behavioral', label: 'Conductual (STAR)', description: 'Preguntas basadas en experiencias pasadas' },
  { key: 'technical', label: 'Tecnica', description: 'Conocimiento y habilidades especificas del rol' },
  { key: 'case_study', label: 'Caso de Estudio', description: 'Escenarios hipoteticos de negocio' },
]

/* ───────── STAR KEYWORDS ───────── */

const STAR_KEYWORDS = {
  situation: ['cuando', 'en mi trabajo', 'en la empresa', 'me encontre', 'habia', 'situacion', 'contexto', 'proyecto', 'cliente', 'equipo'],
  task: ['mi responsabilidad', 'tenia que', 'mi objetivo', 'necesitaba', 'me pidieron', 'mi rol', 'encargado', 'asignaron', 'meta'],
  action: ['decidi', 'implemente', 'hice', 'tome la decision', 'propuse', 'organice', 'lidere', 'cree', 'diseñe', 'coordine', 'desarrolle', 'negocie', 'presente'],
  result: ['resultado', 'logramos', 'mejoro', 'aumento', 'redujo', 'impacto', 'aprendizaje', 'porcentaje', 'crecimiento', 'ahorro', 'exito', 'KPI'],
}

function evaluateAnswer(answer, interviewType) {
  if (!answer || answer.trim().length < 20) {
    return { score: 0, feedback: 'Respuesta demasiado corta. Elabora mas tu respuesta con detalles concretos.', starBreakdown: null }
  }

  const lower = answer.toLowerCase()
  const wordCount = answer.trim().split(/\s+/).length

  let score = 0
  let feedback = ''
  let starBreakdown = null

  // Length scoring
  if (wordCount >= 50) score += 15
  else if (wordCount >= 30) score += 10
  else score += 5

  // Specificity: numbers, percentages, metrics
  const hasNumbers = /\d+/.test(answer)
  const hasPercentage = /%|\bporciento\b|\bpor ciento\b/.test(lower)
  if (hasNumbers) score += 10
  if (hasPercentage) score += 5

  // Concrete examples
  const hasConcreteDetails = /empresa|equipo|proyecto|cliente|departamento|area|producto/.test(lower)
  if (hasConcreteDetails) score += 10

  if (interviewType === 'behavioral') {
    // STAR analysis
    const starScores = {}
    let starTotal = 0
    for (const [component, keywords] of Object.entries(STAR_KEYWORDS)) {
      const found = keywords.filter(kw => lower.includes(kw))
      const componentScore = Math.min(found.length * 5, 15)
      starScores[component] = { score: componentScore, found }
      starTotal += componentScore
    }
    score += Math.min(starTotal, 60)
    starBreakdown = starScores

    const missingStar = Object.entries(starScores)
      .filter(([, v]) => v.score < 5)
      .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))

    if (missingStar.length > 0) {
      feedback = `Tu respuesta podria mejorar incluyendo mas elementos del formato STAR. Falta desarrollar: ${missingStar.join(', ')}. `
    } else {
      feedback = 'Buena estructura STAR. '
    }
  } else if (interviewType === 'technical') {
    // Technical depth
    const technicalTerms = /herramienta|metodologia|framework|proceso|sistema|plataforma|tecnologia|metrica|indicador|KPI|automatizacion|integracion/.test(lower)
    if (technicalTerms) score += 20
    const hasMethodology = /paso|proceso|metodologia|primero|segundo|luego|despues|finalmente/.test(lower)
    if (hasMethodology) score += 15
    score += 25 // base for non-STAR

    feedback = technicalTerms
      ? 'Buena profundidad tecnica. '
      : 'Incluye mas detalles tecnicos especificos: herramientas, metodologias, metricas. '
    if (hasMethodology) feedback += 'Buena estructura paso a paso. '
  } else {
    // Case study
    const hasStructure = /primero|segundo|ademas|por otro lado|en primer lugar|finalmente|como resultado/.test(lower)
    const hasAnalysis = /analizar|evaluar|considerar|factor|riesgo|oportunidad|estrategia|impacto/.test(lower)
    if (hasStructure) score += 20
    if (hasAnalysis) score += 20
    score += 20 // base

    feedback = hasStructure
      ? 'Buena estructura de analisis. '
      : 'Estructura tu respuesta: analisis, opciones, plan de accion, resultado esperado. '
    if (hasAnalysis) feedback += 'Buen pensamiento analitico. '
  }

  score = Math.min(score, 100)

  // Final feedback
  if (score >= 80) feedback += 'Respuesta solida y bien fundamentada.'
  else if (score >= 60) feedback += 'Respuesta aceptable, pero podrias agregar mas detalle y resultados concretos.'
  else if (score >= 40) feedback += 'Necesita mas desarrollo. Incluye ejemplos especificos, metricas y resultados.'
  else feedback += 'Respuesta debil. Practica usando el formato STAR y agrega datos cuantitativos.'

  return { score, feedback, starBreakdown }
}

/* ───────── MAIN COMPONENT ───────── */

export default function EntrevistaSimulador() {
  const { canDo } = usePlan()
  const [role, setRole] = useState('')
  const [industry, setIndustry] = useState('')
  const [interviewType, setInterviewType] = useState('behavioral')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (!canDo('use_marca_vende')) {
    return <UpgradePrompt action="use_marca_vende" />
  }

  const generateQuestions = () => {
    const bank = QUESTION_BANKS[interviewType] || QUESTION_BANKS.behavioral
    // Shuffle and pick 10
    const shuffled = [...bank].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 10).map((q, i) => ({
      ...q,
      id: i,
      contextNote: role ? `Para el rol de ${role}${industry ? ` en ${industry}` : ''}` : '',
    }))
    setQuestions(selected)
    setAnswers({})
    setResults(null)
  }

  const handleEvaluate = () => {
    const evaluations = questions.map((q, i) => {
      const answer = answers[i] || ''
      const evaluation = evaluateAnswer(answer, interviewType)
      return { question: q, answer, ...evaluation }
    })

    const answered = evaluations.filter(e => e.answer.trim().length > 0)
    const overallScore = answered.length > 0
      ? Math.round(answered.reduce((sum, e) => sum + e.score, 0) / answered.length)
      : 0

    setResults({ evaluations, overallScore, answered: answered.length, total: questions.length })
  }

  const handleReset = () => {
    setQuestions([])
    setAnswers({})
    setResults(null)
  }

  const getReadinessLabel = (score) => {
    if (score >= 80) return { label: 'Listo para entrevista', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    if (score >= 60) return { label: 'Casi listo - practica mas', color: 'text-amber-400', bg: 'bg-amber-500/10' }
    if (score >= 40) return { label: 'Necesita preparacion', color: 'text-orange-400', bg: 'bg-orange-500/10' }
    return { label: 'Requiere practica intensiva', color: 'text-red-400', bg: 'bg-red-500/10' }
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link to="/dashboard/marca-vende" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ChevronLeft size={16} /> Tu Marca Vende
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/20 to-gold/10 flex items-center justify-center">
            <Mic size={20} className="text-accent-light" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Simulador de Entrevista</h1>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-400">Pro</span>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Practica para tu proxima entrevista con preguntas reales. Selecciona el tipo de entrevista, responde las preguntas y recibe retroalimentacion sobre tus respuestas.
        </p>
      </motion.div>

      {questions.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 max-w-2xl">
          <h2 className="text-lg font-display font-semibold text-white mb-4">Configura tu simulacion</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Puesto objetivo</label>
              <input type="text" value={role} onChange={e => setRole(e.target.value)}
                placeholder="Ej: Gerente de Producto, Developer Senior, Director Comercial"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Industria</label>
              <div className="relative">
                <button onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white hover:border-white/20 transition-colors">
                  <span className={industry ? 'text-white' : 'text-gray-600'}>{industry || 'Selecciona una industria'}</span>
                  <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="absolute z-10 w-full mt-1 glass-strong rounded-lg border border-white/10 overflow-hidden max-h-48 overflow-y-auto">
                      {INDUSTRIES.map(ind => (
                        <button key={ind} onClick={() => { setIndustry(ind); setDropdownOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${ind === industry ? 'bg-primary/10 text-primary-light' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                          {ind}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Tipo de entrevista</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {INTERVIEW_TYPES.map(t => (
                  <button key={t.key} onClick={() => setInterviewType(t.key)}
                    className={`text-left px-4 py-3 rounded-lg border transition-all ${
                      interviewType === t.key
                        ? 'bg-primary/10 border-primary-light/20 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                    }`}>
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={generateQuestions}
              className="w-full bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-2">
              <Mic size={16} />
              Iniciar Simulacion (10 preguntas)
            </button>
          </div>
        </motion.div>
      ) : !results ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">
              {role && <span className="text-white font-medium">{role}</span>}
              {industry && <span> en {industry}</span>}
              {' '} — {INTERVIEW_TYPES.find(t => t.key === interviewType)?.label}
            </p>
            <button onClick={handleReset} className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1">
              <RotateCcw size={12} /> Reiniciar
            </button>
          </div>

          {questions.map((q, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-bold text-primary-light bg-primary/10 px-2 py-0.5 rounded-full">Pregunta {i + 1}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{q.competency}</span>
              </div>
              <p className="text-sm text-white mb-3 leading-relaxed">{q.q}</p>
              <textarea
                rows={4}
                value={answers[i] || ''}
                onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                placeholder="Escribe tu respuesta aqui. Intenta usar el formato STAR: Situacion, Tarea, Accion, Resultado."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none transition-colors resize-none"
              />
              {answers[i] && (
                <div className="text-[10px] text-gray-500 mt-1 text-right">
                  {answers[i].trim().split(/\s+/).length} palabras
                </div>
              )}
            </motion.div>
          ))}

          <button onClick={handleEvaluate}
            className="w-full bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Trophy size={16} />
            Evaluar respuestas
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Overall score */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong rounded-xl p-6 text-center">
            <div className="text-6xl font-bold text-white mb-2">{results.overallScore}<span className="text-2xl text-gray-400">/100</span></div>
            {(() => {
              const readiness = getReadinessLabel(results.overallScore)
              return (
                <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${readiness.color} ${readiness.bg}`}>
                  {results.overallScore >= 60 ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  {readiness.label}
                </span>
              )
            })()}
            <p className="text-sm text-gray-400 mt-3">{results.answered} de {results.total} preguntas respondidas</p>
          </motion.div>

          {/* Per-question results */}
          {results.evaluations.map((ev, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-bold text-primary-light bg-primary/10 px-2 py-0.5 rounded-full">Pregunta {i + 1}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  ev.score >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                  ev.score >= 40 ? 'bg-amber-500/10 text-amber-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {ev.score}/100
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-2">{ev.question.q}</p>
              {ev.answer ? (
                <>
                  <div className="bg-white/5 rounded-lg p-3 text-xs text-gray-400 mb-2 max-h-24 overflow-y-auto">{ev.answer}</div>
                  <p className="text-xs text-gray-300 leading-relaxed">{ev.feedback}</p>
                  {ev.starBreakdown && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {Object.entries(ev.starBreakdown).map(([k, v]) => (
                        <span key={k} className={`text-[10px] px-2 py-0.5 rounded-full ${v.score >= 10 ? 'bg-emerald-500/10 text-emerald-400' : v.score >= 5 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                          {k.charAt(0).toUpperCase() + k.slice(1)}: {v.score}/15
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500 italic">Sin respuesta</p>
              )}
            </motion.div>
          ))}

          <div className="flex gap-3">
            <button onClick={handleReset}
              className="flex-1 bg-white/5 text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
              <RotateCcw size={16} /> Nueva simulacion
            </button>
            <button onClick={() => { setResults(null) }}
              className="flex-1 bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              Editar respuestas
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
