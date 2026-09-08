import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Upload, FileText, Loader2, AlertCircle, CheckCircle, Copy, Download, FileDown, Sparkles } from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import { useAuth } from '../../lib/auth'
import UpgradePrompt from '../ui/UpgradePrompt'
import CoherenceFlags from './CoherenceFlags'
import { optimizeCv } from '../../lib/motorClient'
import { extractPdfText } from '../../lib/pdfText'
import { exportCvPdf, exportCvDoc } from '../../lib/cvExport'
import { logOptimization, getMonthlyUsage, monthlyLimitForPlan } from '../../lib/optimizationUsage'

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

function ScoreBar({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const color = v >= 75 ? '#0D9488' : v >= 50 ? '#F59E0B' : '#ef4444'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-ink-secondary">{label}</span>
        <span className="text-xs font-semibold text-ink">{v}/100</span>
      </div>
      <div className="h-2 rounded-full bg-surface-1 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
      </div>
    </div>
  )
}

export default function CvOptimizer() {
  const { canDo, currentPlan } = usePlan()
  const { profile } = useAuth()
  const fileRef = useRef(null)

  const [cvText, setCvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [rolObjetivo, setRolObjetivo] = useState('')
  const [ubicacion, setUbicacion] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [output, setOutput] = useState(null)

  async function handleFile(file) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Sube un archivo PDF.')
      return
    }
    setError(null)
    setParsing(true)
    try {
      const text = await extractPdfText(file)
      if (!text || text.length < 30) {
        setError('No pudimos extraer texto de ese PDF (¿es una imagen escaneada?). Pega el texto manualmente.')
      } else {
        setCvText(text)
        setFileName(file.name)
      }
    } catch (err) {
      setError('Error al leer el PDF: ' + (err.message || 'desconocido') + '. Pega el texto manualmente.')
    } finally {
      setParsing(false)
    }
  }

  async function handleOptimize() {
    setError(null)
    if (!cvText.trim()) { setError('Sube un PDF o pega el texto de tu CV.'); return }
    setLoading(true)
    try {
      const limit = monthlyLimitForPlan(currentPlan)
      const used = await getMonthlyUsage(profile?.id)
      if (used >= limit) {
        setError(`Alcanzaste el límite de tu plan: ${limit} optimizaciones este mes. Mejora tu plan para generar más.`)
        setLoading(false)
        return
      }

      const result = await optimizeCv(cvText, { rolObjetivo, ubicacion, remoto: true })
      setOutput(result)

      logOptimization({
        profileId: profile?.id,
        tipo: 'cv',
        costUSD: result?._meta?.costUSD,
        flagsCount: result?.flags?.length || 0,
        rolObjetivo: rolObjetivo || null,
        meta: result?._meta,
      })
    } catch (err) {
      setError(err.message || 'No se pudo optimizar el CV. Revisa que el motor esté activo.')
    } finally {
      setLoading(false)
    }
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
        <h1 className="text-2xl font-display font-bold text-ink mb-1">Optimizador de CV IA</h1>
        <p className="text-ink-secondary mb-8">Sube tu CV en PDF y lo reescribimos adaptado a tus vacantes objetivo: viñetas XYZ, keywords ATS y score estimado — sin inventar datos.</p>
      </motion.div>

      {!output && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 space-y-5">
          {/* Dropzone / upload */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
            className="border-2 border-dashed border-line-strong rounded-xl p-8 text-center cursor-pointer hover:border-primary-light/40 hover:bg-white/[0.02] transition-all"
          >
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])} />
            {parsing ? (
              <div className="flex flex-col items-center gap-2 text-ink-secondary">
                <Loader2 size={28} className="animate-spin text-primary-light" />
                <span className="text-sm">Leyendo PDF…</span>
              </div>
            ) : fileName ? (
              <div className="flex flex-col items-center gap-2">
                <FileText size={28} className="text-accent" />
                <span className="text-sm text-ink font-medium">{fileName}</span>
                <span className="text-xs text-ink-secondary">{cvText.length.toLocaleString()} caracteres extraídos · clic para cambiar</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-ink-secondary">
                <Upload size={28} className="text-primary-light" />
                <span className="text-sm text-ink font-medium">Arrastra tu CV en PDF o haz clic para subir</span>
                <span className="text-xs">El archivo se procesa en tu navegador; solo enviamos el texto.</span>
              </div>
            )}
          </div>

          {/* Pegar texto alternativo */}
          <div>
            <label className={labelClass}>…o pega el texto de tu CV</label>
            <textarea className={`${inputClass} min-h-[120px] font-mono text-xs`} placeholder="Pega aquí el contenido de tu CV si no tienes el PDF a la mano…"
              value={cvText} onChange={(e) => { setCvText(e.target.value); if (fileName) setFileName('') }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Rol objetivo</label>
              <input className={inputClass} placeholder="Senior Full Stack Developer" value={rolObjetivo} onChange={(e) => setRolObjetivo(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Ubicacion (opcional)</label>
              <input className={inputClass} placeholder="Remoto / Ciudad de Mexico" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleOptimize}
            disabled={loading || parsing}
            className="w-full px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> Optimizando…</> : <><Sparkles size={18} /> Optimizar mi CV</>}
          </button>
          {loading && <p className="text-center text-xs text-ink-tertiary">Reescribiendo con Haiku 4.5 + pulido Sonnet. Unos segundos…</p>}
        </motion.div>
      )}

      {/* Resultado */}
      <AnimatePresence>
        {output && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="glass rounded-xl p-5 text-center">
              <CheckCircle size={32} className="text-accent mx-auto mb-2" />
              <h3 className="font-display font-bold text-ink">CV optimizado</h3>
              <p className="text-sm text-ink-secondary mt-1">Revisa las alertas de honestidad antes de exportar.</p>
            </div>

            {/* Score ATS */}
            {output.scoreATS && (
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-ink mb-4">Score ATS estimado</h3>
                <div className="grid grid-cols-2 gap-6">
                  <ScoreBar label="Antes" value={output.scoreATS.antes} />
                  <ScoreBar label="Despues" value={output.scoreATS.despues} />
                </div>
              </div>
            )}

            {/* Checkpoint de honestidad */}
            <CoherenceFlags flags={output.flags} />

            {/* Resumen profesional */}
            {output.resumenProfesional && (
              <div className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ink">Resumen profesional</h3>
                  <CopyButton text={output.resumenProfesional} />
                </div>
                <p className="text-sm text-ink-secondary leading-relaxed">{output.resumenProfesional}</p>
              </div>
            )}

            {/* Experiencia */}
            {output.experiencia?.length > 0 && (
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-ink mb-3">Experiencia reescrita (XYZ)</h3>
                <div className="space-y-4">
                  {output.experiencia.map((exp, i) => {
                    const vinetas = exp.vinetas || exp.vinetas_es || []
                    return (
                      <div key={i} className="pl-3" style={{ borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-sm font-medium text-ink">
                            {exp.puesto}{exp.empresa ? ` · ${exp.empresa}` : ''}{exp.periodo ? ` · ${exp.periodo}` : ''}
                          </p>
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
            {output.skills?.length > 0 && (
              <div className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ink">Skills ordenadas</h3>
                  <CopyButton text={output.skills.join(', ')} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {output.skills.map((s, i) => (
                    <span key={i} className="text-xs bg-surface-1 border border-line text-ink-secondary px-3 py-1.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords faltantes */}
            {output.keywordsFaltantes?.length > 0 && (
              <div className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ink">Keywords ATS que faltaban</h3>
                  <CopyButton text={output.keywordsFaltantes.join(', ')} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {output.keywordsFaltantes.map((kw, i) => (
                    <span key={i} className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {output._meta && (
              <p className="text-center text-xs text-ink-tertiary">Generado con {output._meta.engine} · costo ≈ ${output._meta.costUSD}</p>
            )}

            {/* Export */}
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-ink mb-3">Exportar CV optimizado</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => exportCvPdf(output)}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2">
                  <FileDown size={16} /> Descargar PDF
                </button>
                <button onClick={() => exportCvDoc(output)}
                  className="flex-1 py-3 rounded-xl border border-line-strong text-ink text-sm font-semibold hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2">
                  <Download size={16} /> Descargar Word (.doc)
                </button>
              </div>
            </div>

            <button
              onClick={() => { setOutput(null); setError(null) }}
              className="w-full py-3 rounded-xl border border-line text-sm text-ink-secondary hover:text-ink hover:bg-white/5 transition-all"
            >
              Optimizar otro CV
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
