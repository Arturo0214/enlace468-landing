import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Upload, Link2, FileText, AlertCircle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import UpgradePrompt from '../ui/UpgradePrompt'

// ── PDF text extraction using pdfjs-dist ──
async function extractTextFromPDF(file) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map(item => item.str).join(' ') + '\n'
  }
  return fullText
}

// ── Section detection patterns ──
const SECTION_PATTERNS = {
  contacto: {
    label: 'Informacion de contacto',
    patterns: [/[\w.-]+@[\w.-]+\.\w+/, /\+?\d[\d\s\-()]{7,}/, /linkedin\.com/i, /github\.com/i],
    weight: 10,
  },
  resumen: {
    label: 'Resumen / Acerca de',
    patterns: [/resumen/i, /about/i, /acerca/i, /summary/i, /perfil profesional/i, /objetivo/i, /professional profile/i],
    weight: 15,
  },
  experiencia: {
    label: 'Experiencia laboral',
    patterns: [/experiencia/i, /experience/i, /trabajo/i, /employment/i, /work history/i, /historial laboral/i],
    weight: 25,
  },
  educacion: {
    label: 'Educacion',
    patterns: [/educaci[oó]n/i, /education/i, /formaci[oó]n/i, /estudios/i, /academic/i, /universidad/i, /licenciatura/i, /maestr[ií]a/i, /doctorado/i],
    weight: 15,
  },
  habilidades: {
    label: 'Habilidades',
    patterns: [/habilidades/i, /skills/i, /competencias/i, /conocimientos/i, /herramientas/i, /tecnolog[ií]as/i, /tools/i],
    weight: 15,
  },
  certificaciones: {
    label: 'Certificaciones',
    patterns: [/certificaci[oó]n/i, /certification/i, /certificado/i, /certified/i, /diploma/i, /curso/i, /course/i],
    weight: 10,
  },
  logros: {
    label: 'Logros / Resultados',
    patterns: [/logros/i, /achievements/i, /resultados/i, /awards/i, /reconocimientos/i, /premios/i, /%/, /\$\d/, /increment[oó]/i, /reduj/i, /aument[oó]/i],
    weight: 10,
  },
}

// ── Power keywords ──
const POWER_KEYWORDS = [
  'liderazgo', 'gestion', 'estrategia', 'resultados', 'equipo', 'implementacion',
  'optimizacion', 'innovacion', 'proyecto', 'crecimiento', 'ahorro', 'impacto',
  'leadership', 'management', 'strategy', 'results', 'team', 'implementation',
  'optimization', 'innovation', 'project', 'growth', 'savings', 'impact',
  'kpi', 'roi', 'scrum', 'agile', 'data', 'analytics', 'digital',
]

function analyzeCV(text) {
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const sections = {}
  let totalWeightedScore = 0
  let totalWeight = 0

  for (const [key, config] of Object.entries(SECTION_PATTERNS)) {
    const matches = config.patterns.filter(p => p.test(text))
    const ratio = matches.length / config.patterns.length
    const score = Math.min(100, Math.round(ratio * 100 + (ratio > 0 ? 30 : 0)))
    sections[key] = { label: config.label, score, found: matches.length > 0 }
    totalWeightedScore += score * config.weight
    totalWeight += config.weight
  }

  // Word count bonus/penalty
  let lengthScore = 100
  if (wordCount < 150) lengthScore = 30
  else if (wordCount < 300) lengthScore = 60
  else if (wordCount > 1500) lengthScore = 70

  // Keyword density
  const lowerText = text.toLowerCase()
  const foundKeywords = POWER_KEYWORDS.filter(kw => lowerText.includes(kw))
  const keywordScore = Math.min(100, Math.round((foundKeywords.length / 8) * 100))

  const overallScore = Math.round((totalWeightedScore / totalWeight) * 0.6 + lengthScore * 0.15 + keywordScore * 0.25)

  // Recommendations
  const recommendations = []

  if (!sections.resumen.found) {
    recommendations.push({ text: 'Agrega un resumen o perfil profesional al inicio de tu CV. Es lo primero que leen los reclutadores.', priority: 'alta' })
  }
  if (!sections.experiencia.found) {
    recommendations.push({ text: 'Incluye una seccion clara de experiencia laboral con fechas, empresa y cargo.', priority: 'alta' })
  }
  if (!sections.contacto.found) {
    recommendations.push({ text: 'Asegurate de incluir email, telefono y perfil de LinkedIn en tu informacion de contacto.', priority: 'alta' })
  }
  if (!sections.habilidades.found) {
    recommendations.push({ text: 'Agrega una seccion de habilidades tecnicas y blandas relevantes para tu industria.', priority: 'media' })
  }
  if (!sections.educacion.found) {
    recommendations.push({ text: 'Incluye tu formacion academica con institucion, titulo y fechas.', priority: 'media' })
  }
  if (!sections.logros.found) {
    recommendations.push({ text: 'Cuantifica tus logros con numeros y porcentajes para mayor impacto (ej: "Aumente ventas 35%").', priority: 'alta' })
  }
  if (!sections.certificaciones.found) {
    recommendations.push({ text: 'Agrega certificaciones o cursos relevantes para fortalecer tu perfil.', priority: 'baja' })
  }
  if (wordCount < 300) {
    recommendations.push({ text: 'Tu CV es demasiado corto. Un buen CV tiene al menos 300-600 palabras con detalle suficiente.', priority: 'media' })
  }
  if (foundKeywords.length < 4) {
    recommendations.push({ text: 'Utiliza mas palabras clave de impacto como "liderazgo", "resultados", "estrategia", "crecimiento".', priority: 'media' })
  }

  return { overallScore, sections, wordCount, foundKeywords, keywordScore, lengthScore, recommendations }
}

function analyzeLinkedIn(url) {
  const linkedInRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/
  const isValid = linkedInRegex.test(url.trim())
  const slug = url.trim().match(/linkedin\.com\/in\/([\w-]+)/)?.[1] || ''
  return { isValid, slug }
}

// ── Circular Score Gauge ──
function ScoreGauge({ score }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? '#14B8A6' : score >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-display font-bold text-white">{score}</span>
        <span className="text-xs text-gray-400">/ 100</span>
      </div>
    </div>
  )
}

// ── Priority badge ──
function PriorityBadge({ priority }) {
  const styles = {
    alta: 'bg-red-500/20 text-red-400',
    media: 'bg-gold/20 text-gold-light',
    baja: 'bg-accent/20 text-accent-light',
  }
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${styles[priority]}`}>
      {priority}
    </span>
  )
}

export default function DiagnosticoPage() {
  const { canDo } = usePlan()
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [file, setFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  if (!canDo('use_marca_vende')) {
    return <UpgradePrompt action="use_marca_vende" />
  }

  async function handleAnalyze() {
    setError('')
    setResults(null)

    if (!file && !linkedinUrl.trim()) {
      setError('Ingresa tu URL de LinkedIn o sube tu CV en PDF para continuar.')
      return
    }

    setAnalyzing(true)

    try {
      let cvResults = null
      let linkedinResults = null

      if (linkedinUrl.trim()) {
        linkedinResults = analyzeLinkedIn(linkedinUrl)
        if (!linkedinResults.isValid) {
          setError('La URL de LinkedIn no es valida. Usa el formato: https://linkedin.com/in/tu-nombre')
          setAnalyzing(false)
          return
        }
      }

      if (file) {
        const text = await extractTextFromPDF(file)
        if (text.trim().length < 20) {
          setError('No se pudo extraer texto del PDF. Asegurate de que no sea una imagen escaneada.')
          setAnalyzing(false)
          return
        }
        cvResults = analyzeCV(text)
      }

      setResults({ cv: cvResults, linkedin: linkedinResults })
    } catch (err) {
      console.error(err)
      setError('Error al procesar el archivo. Intenta con otro PDF.')
    } finally {
      setAnalyzing(false)
    }
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (f && f.type === 'application/pdf') {
      setFile(f)
      setError('')
    } else if (f) {
      setError('Solo se aceptan archivos PDF.')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back nav */}
      <Link to="/dashboard/marca-vende" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6">
        <ArrowLeft size={16} /> Tu Marca Vende
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-white mb-1">Diagnostico OpenToWork</h1>
        <p className="text-gray-400 mb-8">Analiza tu CV y perfil de LinkedIn para obtener una puntuacion y recomendaciones personalizadas.</p>
      </motion.div>

      {/* Input form */}
      {!results && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-5">
          {/* LinkedIn URL */}
          <div className="glass rounded-xl p-5">
            <label className="flex items-center gap-2 text-sm font-medium text-white mb-3">
              <Link2 size={16} className="text-primary-light" /> URL de LinkedIn
            </label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/tu-nombre"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-light/50 transition-colors"
            />
          </div>

          {/* CV Upload */}
          <div className="glass rounded-xl p-5">
            <label className="flex items-center gap-2 text-sm font-medium text-white mb-3">
              <FileText size={16} className="text-accent" /> Subir CV (PDF)
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center cursor-pointer hover:border-primary-light/30 transition-colors"
            >
              <input ref={fileRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText size={20} className="text-accent" />
                  <span className="text-sm text-white font-medium">{file.name}</span>
                  <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload size={28} className="mx-auto text-gray-500 mb-2" />
                  <p className="text-sm text-gray-400">Arrastra tu CV aqui o haz clic para seleccionar</p>
                  <p className="text-xs text-gray-500 mt-1">Solo archivos PDF</p>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {analyzing ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Analizando...
              </>
            ) : (
              'Analizar mi perfil'
            )}
          </button>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {results && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* LinkedIn validation */}
            {results.linkedin && (
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">LinkedIn</h3>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-accent" />
                  <span className="text-gray-300">URL valida</span>
                  <span className="text-gray-500 ml-2">linkedin.com/in/<span className="text-white font-medium">{results.linkedin.slug}</span></span>
                </div>
              </div>
            )}

            {/* CV Results */}
            {results.cv && (
              <>
                {/* Overall Score */}
                <div className="glass rounded-xl p-6 text-center">
                  <h3 className="text-sm font-semibold text-gray-400 mb-4">Puntuacion general</h3>
                  <ScoreGauge score={results.cv.overallScore} />
                  <p className="text-sm text-gray-400 mt-4">
                    {results.cv.overallScore >= 75 ? 'Tu CV esta bien estructurado.' :
                     results.cv.overallScore >= 50 ? 'Tu CV tiene potencial pero puede mejorar.' :
                     'Tu CV necesita mejoras importantes para destacar.'}
                  </p>
                  <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
                    <span>{results.cv.wordCount} palabras</span>
                    <span>{results.cv.foundKeywords.length} palabras clave</span>
                  </div>
                </div>

                {/* Section breakdown */}
                <div className="glass rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-white mb-4">Desglose por seccion</h3>
                  <div className="space-y-4">
                    {Object.entries(results.cv.sections).map(([key, section]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-gray-300">{section.label}</span>
                          <span className={`text-xs font-bold ${section.score >= 60 ? 'text-accent' : section.score >= 30 ? 'text-gold' : 'text-red-400'}`}>
                            {section.score}%
                          </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: section.score >= 60 ? '#0D9488' : section.score >= 30 ? '#D97706' : '#EF4444' }}
                            initial={{ width: 0 }}
                            animate={{ width: `${section.score}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {results.cv.recommendations.length > 0 && (
                  <div className="glass rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-white mb-4">Recomendaciones</h3>
                    <div className="space-y-3">
                      {results.cv.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 bg-white/[0.03] rounded-lg px-4 py-3">
                          <PriorityBadge priority={rec.priority} />
                          <span className="text-sm text-gray-300 leading-relaxed">{rec.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <Link
                  to="/dashboard/marca-vende/perfil-pro"
                  className="block glass rounded-xl p-5 hover:border-accent/30 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Mejora tu perfil con Perfil Profesional IA</p>
                      <p className="text-xs text-gray-400 mt-1">Genera un headline, resumen y pitch optimizados a partir de tus datos.</p>
                    </div>
                    <ArrowRight size={18} className="text-accent group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </>
            )}

            {/* Start over */}
            <button
              onClick={() => { setResults(null); setFile(null); setLinkedinUrl(''); setError('') }}
              className="w-full py-3 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Hacer otro diagnostico
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
