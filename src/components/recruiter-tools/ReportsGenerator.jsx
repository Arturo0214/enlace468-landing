import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, BarChart3, Copy, Check, Download,
  TrendingDown, Activity, FileText
} from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import UpgradePrompt from '../ui/UpgradePrompt'

/* ───────── PIPELINE REPORT ───────── */

const PIPELINE_STAGES = [
  { key: 'sourced', label: 'Sourced', color: 'bg-blue-500' },
  { key: 'contacted', label: 'Contactados', color: 'bg-cyan-500' },
  { key: 'interviewing', label: 'En entrevista', color: 'bg-indigo-500' },
  { key: 'evaluated', label: 'Evaluados', color: 'bg-violet-500' },
  { key: 'presented', label: 'Presentados', color: 'bg-amber-500' },
  { key: 'offer', label: 'Oferta', color: 'bg-orange-500' },
  { key: 'hired', label: 'Contratados', color: 'bg-emerald-500' },
]

function PipelineReport() {
  const [vacancy, setVacancy] = useState('')
  const [values, setValues] = useState({})
  const [generated, setGenerated] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = () => {
    const stages = PIPELINE_STAGES.map((s, i) => {
      const count = parseInt(values[s.key]) || 0
      const prev = i === 0 ? count : (parseInt(values[PIPELINE_STAGES[i - 1].key]) || 1)
      const rate = i === 0 ? 100 : prev > 0 ? Math.round((count / prev) * 100) : 0
      return { ...s, count, rate }
    })
    setGenerated({ vacancy: vacancy || 'Sin especificar', stages })
  }

  const getReportText = () => {
    if (!generated) return ''
    let text = `REPORTE DE PIPELINE\n${'='.repeat(40)}\nVacante: ${generated.vacancy}\nFecha: ${new Date().toLocaleDateString('es-MX')}\n\n`
    generated.stages.forEach(s => {
      text += `${s.label}: ${s.count} candidatos (${s.rate}% conversion)\n`
    })
    const total = generated.stages[0].count
    const hired = generated.stages[generated.stages.length - 1].count
    text += `\nConversion total: ${total > 0 ? Math.round((hired / total) * 100) : 0}%\n`
    text += `Total sourced: ${total} | Total contratados: ${hired}\n`
    return text
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getReportText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([getReportText()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-pipeline-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Nombre de la vacante</label>
        <input
          type="text"
          value={vacancy}
          onChange={e => setVacancy(e.target.value)}
          placeholder="Ej: Desarrollador Full Stack Senior"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none transition-colors"
        />
      </div>

      <div className="glass rounded-xl p-4">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Candidatos por etapa</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PIPELINE_STAGES.map(s => (
            <div key={s.key}>
              <label className="text-xs text-gray-400 mb-1 block">{s.label}</label>
              <input
                type="number"
                min="0"
                value={values[s.key] || ''}
                onChange={e => setValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none transition-colors"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleGenerate}
          className="mt-4 w-full bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <BarChart3 size={16} />
          Generar Reporte de Pipeline
        </button>
      </div>

      <AnimatePresence>
        {generated && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-strong rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Pipeline: {generated.vacancy}</h3>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-medium text-primary-light hover:text-white transition-colors bg-primary/10 px-3 py-1.5 rounded-lg">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button onClick={handleDownload} className="flex items-center gap-1.5 text-xs font-medium text-accent-light hover:text-white transition-colors bg-accent/10 px-3 py-1.5 rounded-lg">
                  <Download size={14} /> Descargar
                </button>
              </div>
            </div>

            {/* Visual funnel */}
            <div className="space-y-2 mb-4">
              {generated.stages.map((s, i) => {
                const maxCount = generated.stages[0].count || 1
                const width = Math.max(10, (s.count / maxCount) * 100)
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-24 text-right flex-shrink-0">{s.label}</span>
                    <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className={`h-full ${s.color} rounded-lg flex items-center px-2`}
                      >
                        <span className="text-xs font-bold text-white">{s.count}</span>
                      </motion.div>
                    </div>
                    <span className="text-xs text-gray-500 w-12 flex-shrink-0">
                      {i === 0 ? '' : `${s.rate}%`}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-4 text-xs text-gray-400 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span>Conversion total: <strong className="text-white">{generated.stages[0].count > 0 ? Math.round((generated.stages[generated.stages.length - 1].count / generated.stages[0].count) * 100) : 0}%</strong></span>
              <span>Fecha: {new Date().toLocaleDateString('es-MX')}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───────── PRODUCTIVITY REPORT ───────── */

const PRODUCTIVITY_FIELDS = [
  { key: 'searches', label: 'Busquedas realizadas' },
  { key: 'contacted', label: 'Candidatos contactados' },
  { key: 'responses', label: 'Respuestas recibidas' },
  { key: 'interviews', label: 'Entrevistas agendadas' },
  { key: 'evaluations', label: 'Evaluaciones completadas' },
  { key: 'presentations', label: 'Candidatos presentados' },
  { key: 'offers', label: 'Ofertas enviadas' },
  { key: 'hires', label: 'Contrataciones cerradas' },
]

function ProductivityReport() {
  const [recruiter, setRecruiter] = useState('')
  const [week, setWeek] = useState('')
  const [values, setValues] = useState({})
  const [generated, setGenerated] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = () => {
    const rows = PRODUCTIVITY_FIELDS.map(f => ({
      label: f.label,
      value: parseInt(values[f.key]) || 0,
    }))
    setGenerated({ recruiter: recruiter || 'Sin especificar', week: week || 'Actual', rows })
  }

  const getReportText = () => {
    if (!generated) return ''
    let text = `REPORTE DE PRODUCTIVIDAD SEMANAL\n${'='.repeat(40)}\n`
    text += `Reclutador: ${generated.recruiter}\nSemana: ${generated.week}\nFecha: ${new Date().toLocaleDateString('es-MX')}\n\n`
    text += `${'Actividad'.padEnd(35)} | Cantidad\n${'-'.repeat(48)}\n`
    generated.rows.forEach(r => {
      text += `${r.label.padEnd(35)} | ${r.value}\n`
    })
    const responseRate = (generated.rows[1].value > 0)
      ? Math.round((generated.rows[2].value / generated.rows[1].value) * 100)
      : 0
    text += `\nTasa de respuesta: ${responseRate}%\n`
    return text
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getReportText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([getReportText()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-productividad-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Nombre del reclutador</label>
            <input type="text" value={recruiter} onChange={e => setRecruiter(e.target.value)} placeholder="Ej: Ana Garcia"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Semana</label>
            <input type="text" value={week} onChange={e => setWeek(e.target.value)} placeholder="Ej: 19-23 Mayo 2026"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none transition-colors" />
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Actividades de la semana</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRODUCTIVITY_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
              <input type="number" min="0" value={values[f.key] || ''} onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none transition-colors" />
            </div>
          ))}
        </div>
        <button onClick={handleGenerate}
          className="mt-4 w-full bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <Activity size={16} />
          Generar Reporte de Productividad
        </button>
      </div>

      <AnimatePresence>
        {generated && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass-strong rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Productividad: {generated.recruiter}</h3>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-medium text-primary-light hover:text-white transition-colors bg-primary/10 px-3 py-1.5 rounded-lg">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button onClick={handleDownload} className="flex items-center gap-1.5 text-xs font-medium text-accent-light hover:text-white transition-colors bg-accent/10 px-3 py-1.5 rounded-lg">
                  <Download size={14} /> Descargar
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.04]">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actividad</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {generated.rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-4 py-2.5 text-gray-300">{r.label}</td>
                      <td className="px-4 py-2.5 text-white font-semibold text-right">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-gray-400 mt-3">Semana: {generated.week} | Fecha: {new Date().toLocaleDateString('es-MX')}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───────── EXECUTIVE REPORT ───────── */

function ExecutiveReport() {
  const [form, setForm] = useState({
    vacancy: '', area: '', hiringManager: '', recruiter: '',
    openDate: '', closeDate: '', candidatesReviewed: '',
    finalist: '', timeline: '', recommendations: '',
  })
  const [generated, setGenerated] = useState(null)
  const [copied, setCopied] = useState(false)

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleGenerate = () => setGenerated({ ...form })

  const getReportText = () => {
    if (!generated) return ''
    return `REPORTE EJECUTIVO DE CIERRE DE VACANTE
${'='.repeat(50)}

INFORMACION DE LA VACANTE
  Puesto:            ${generated.vacancy || '___'}
  Area/Departamento: ${generated.area || '___'}
  Hiring Manager:    ${generated.hiringManager || '___'}
  Reclutador:        ${generated.recruiter || '___'}

LINEA DE TIEMPO
  Fecha de apertura: ${generated.openDate || '___'}
  Fecha de cierre:   ${generated.closeDate || '___'}
  Dias totales:      ${generated.openDate && generated.closeDate ? Math.ceil((new Date(generated.closeDate) - new Date(generated.openDate)) / 86400000) : '___'} dias

RESUMEN DEL PROCESO
  Candidatos revisados: ${generated.candidatesReviewed || '___'}

CANDIDATO FINALISTA SELECCIONADO
  ${generated.finalist || '(No especificado)'}

DETALLE DE TIMELINE
  ${generated.timeline || '(No especificado)'}

RECOMENDACIONES Y OBSERVACIONES
  ${generated.recommendations || '(Sin recomendaciones)'}

${'='.repeat(50)}
Generado el ${new Date().toLocaleDateString('es-MX')} | Enlace 468 - Recruiter Pro Tools
`
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getReportText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([getReportText()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-ejecutivo-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none transition-colors'

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 space-y-3">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Informacion de la vacante</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Puesto</label>
            <input type="text" value={form.vacancy} onChange={e => update('vacancy', e.target.value)} placeholder="Ej: Director Comercial" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Area / Departamento</label>
            <input type="text" value={form.area} onChange={e => update('area', e.target.value)} placeholder="Ej: Ventas" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Hiring Manager</label>
            <input type="text" value={form.hiringManager} onChange={e => update('hiringManager', e.target.value)} placeholder="Ej: Carlos Rodriguez" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Reclutador</label>
            <input type="text" value={form.recruiter} onChange={e => update('recruiter', e.target.value)} placeholder="Tu nombre" className={inputCls} />
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Timeline y resultados</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Fecha apertura</label>
            <input type="date" value={form.openDate} onChange={e => update('openDate', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Fecha cierre</label>
            <input type="date" value={form.closeDate} onChange={e => update('closeDate', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Candidatos revisados</label>
            <input type="number" min="0" value={form.candidatesReviewed} onChange={e => update('candidatesReviewed', e.target.value)} placeholder="Ej: 45" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Candidato finalista seleccionado</label>
          <input type="text" value={form.finalist} onChange={e => update('finalist', e.target.value)} placeholder="Nombre del candidato seleccionado y puesto actual" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Detalle del timeline (hitos clave)</label>
          <textarea rows={3} value={form.timeline} onChange={e => update('timeline', e.target.value)}
            placeholder="Ej: Semana 1: Sourcing y publicacion. Semana 2-3: Entrevistas. Semana 4: Evaluaciones y oferta."
            className={`${inputCls} resize-none`} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Recomendaciones y observaciones</label>
          <textarea rows={3} value={form.recommendations} onChange={e => update('recommendations', e.target.value)}
            placeholder="Observaciones sobre el proceso, mercado laboral, y recomendaciones para futuras vacantes similares."
            className={`${inputCls} resize-none`} />
        </div>
        <button onClick={handleGenerate}
          className="mt-2 w-full bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <FileText size={16} />
          Generar Reporte Ejecutivo
        </button>
      </div>

      <AnimatePresence>
        {generated && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass-strong rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Reporte Ejecutivo: {generated.vacancy}</h3>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-medium text-primary-light hover:text-white transition-colors bg-primary/10 px-3 py-1.5 rounded-lg">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button onClick={handleDownload} className="flex items-center gap-1.5 text-xs font-medium text-accent-light hover:text-white transition-colors bg-accent/10 px-3 py-1.5 rounded-lg">
                  <Download size={14} /> Descargar como texto
                </button>
              </div>
            </div>
            <div className="bg-black/30 rounded-lg p-4 border border-white/10">
              <pre className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">{getReportText()}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───────── MAIN COMPONENT ───────── */

const REPORT_TYPES = [
  { key: 'pipeline', label: 'Reporte de Pipeline', icon: TrendingDown, description: 'Embudo de candidatos con conteos y tasas de conversion por etapa' },
  { key: 'productivity', label: 'Reporte de Productividad', icon: Activity, description: 'Resumen semanal de actividades y metricas del reclutador' },
  { key: 'executive', label: 'Reporte Ejecutivo', icon: FileText, description: 'Reporte profesional de cierre de vacante para hiring managers' },
]

export default function ReportsGenerator() {
  const { canDo } = usePlan()
  const [activeReport, setActiveReport] = useState('pipeline')

  if (!canDo('view_reports')) {
    return <UpgradePrompt action="view_reports" />
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link to="/dashboard/recruiter-tools" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ChevronLeft size={16} /> Recruiter Pro Tools
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <BarChart3 size={20} className="text-primary-light" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Generador de Reportes</h1>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400">Elite</span>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Genera reportes profesionales de pipeline, productividad y cierre de vacantes. Completa los datos y obtendras un reporte formateado listo para compartir.
        </p>
      </motion.div>

      {/* Report type selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {REPORT_TYPES.map(rt => (
          <button
            key={rt.key}
            onClick={() => setActiveReport(rt.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeReport === rt.key
                ? 'bg-primary text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <rt.icon size={16} />
            {rt.label}
          </button>
        ))}
      </div>

      {/* Active report description */}
      <motion.p
        key={activeReport}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm text-gray-400 mb-6"
      >
        {REPORT_TYPES.find(r => r.key === activeReport)?.description}
      </motion.p>

      {/* Report form */}
      <AnimatePresence mode="wait">
        <motion.div key={activeReport} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {activeReport === 'pipeline' && <PipelineReport />}
          {activeReport === 'productivity' && <ProductivityReport />}
          {activeReport === 'executive' && <ExecutiveReport />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
