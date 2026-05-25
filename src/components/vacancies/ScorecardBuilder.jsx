import { useState, useMemo } from 'react'
import { Plus, Trash2, Save, AlertTriangle, ChevronDown, Star, Flag, MessageSquare, ThumbsUp, ThumbsDown, HelpCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const TEMPLATES = {
  comercial_agro: {
    name: 'Comercial Agro B2B',
    criteria: [
      { name: 'Experiencia en agro/agroindustria', weight: 20, description: 'Conocimiento del sector agropecuario y cadena de valor' },
      { name: 'Ventas B2B consultivas', weight: 25, description: 'Track record en ventas complejas con ciclos largos' },
      { name: 'Gestion de cartera', weight: 15, description: 'Capacidad de mantener y hacer crecer cuentas clave' },
      { name: 'Conocimiento tecnico del producto', weight: 15, description: 'Entendimiento de insumos, maquinaria o servicios agro' },
      { name: 'Orientacion a resultados', weight: 15, description: 'Cumplimiento de cuotas y KPIs comerciales' },
      { name: 'Habilidades de negociacion', weight: 10, description: 'Cierre de acuerdos, manejo de objeciones' },
    ],
  },
  financiero_seguros: {
    name: 'Financiero/Seguros',
    criteria: [
      { name: 'Regulacion financiera', weight: 20, description: 'Conocimiento de CNBV, CNSF, normatividad aplicable' },
      { name: 'Analisis de riesgo', weight: 20, description: 'Evaluacion crediticia, actuarial o de mercado' },
      { name: 'Productos financieros', weight: 20, description: 'Dominio de instrumentos, seguros o productos bancarios' },
      { name: 'Relacion con clientes', weight: 15, description: 'Atencion a clientes corporativos o institucionales' },
      { name: 'Herramientas analiticas', weight: 15, description: 'Excel avanzado, Bloomberg, SAS, Python, etc.' },
      { name: 'Comunicacion ejecutiva', weight: 10, description: 'Presentaciones a comites y alta direccion' },
    ],
  },
  tecnologia: {
    name: 'Tecnologia',
    criteria: [
      { name: 'Stack tecnico requerido', weight: 25, description: 'Dominio de lenguajes, frameworks y herramientas del puesto' },
      { name: 'Arquitectura y diseno', weight: 20, description: 'Capacidad de disenar soluciones escalables' },
      { name: 'Metodologias agiles', weight: 15, description: 'Experiencia con Scrum, Kanban, CI/CD' },
      { name: 'Resolucion de problemas', weight: 15, description: 'Debugging, optimizacion, pensamiento algoritmico' },
      { name: 'Colaboracion y comunicacion', weight: 15, description: 'Trabajo en equipo, code reviews, documentacion' },
      { name: 'Aprendizaje continuo', weight: 10, description: 'Capacidad de adoptar nuevas tecnologias rapidamente' },
    ],
  },
}

const SCALE_LABELS = ['Insuficiente', 'Basico', 'Competente', 'Destacado', 'Excepcional']
const RECOMMENDATIONS = [
  { id: 'advance', label: 'Avanzar', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', icon: ThumbsUp },
  { id: 'evaluate', label: 'Evaluar mas', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', icon: HelpCircle },
  { id: 'reject', label: 'No viable', color: 'bg-red-500/15 text-red-400 border-red-500/20', icon: ThumbsDown },
]

export default function ScorecardBuilder({ vacancy, candidateId, evaluation, onSave }) {
  const isEvaluation = !!candidateId
  const existingCriteria = vacancy?.competencies?.length
    ? vacancy.competencies.map(c => ({ name: c.name, weight: c.weight || 0, description: c.description || '' }))
    : []

  const [criteria, setCriteria] = useState(
    evaluation?.criteria?.length ? evaluation.criteria
      : existingCriteria.length ? existingCriteria
      : [{ name: '', weight: 100, description: '' }]
  )
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [saving, setSaving] = useState(false)

  // Evaluation state
  const [scores, setScores] = useState(evaluation?.scores || {})
  const [evidence, setEvidence] = useState(evaluation?.evidence || {})
  const [greenFlags, setGreenFlags] = useState(evaluation?.greenFlags || {})
  const [redFlags, setRedFlags] = useState(evaluation?.redFlags || {})
  const [recommendation, setRecommendation] = useState(evaluation?.recommendation || '')

  const totalWeight = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0)
  const isWeightValid = totalWeight === 100

  // Weighted overall score
  const overallScore = useMemo(() => {
    if (!isEvaluation) return 0
    let weighted = 0, totalW = 0
    criteria.forEach(c => {
      const s = scores[c.name]
      if (s != null) {
        weighted += s * (Number(c.weight) || 0)
        totalW += Number(c.weight) || 0
      }
    })
    return totalW > 0 ? (weighted / totalW) : 0
  }, [scores, criteria, isEvaluation])

  // Auto-generated analysis
  const strengths = useMemo(() => criteria.filter(c => (scores[c.name] || 0) >= 4), [scores, criteria])
  const gaps = useMemo(() => criteria.filter(c => (scores[c.name] || 0) <= 2 && scores[c.name] != null), [scores, criteria])
  const pending = useMemo(() => criteria.filter(c => scores[c.name] == null), [scores, criteria])

  function addCriterion() {
    setCriteria(prev => [...prev, { name: '', weight: 0, description: '' }])
  }

  function removeCriterion(index) {
    if (criteria.length <= 1) return
    setCriteria(prev => prev.filter((_, i) => i !== index))
  }

  function updateCriterion(index, field, value) {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, [field]: field === 'weight' ? Number(value) || 0 : value } : c))
  }

  function applyTemplate(key) {
    if (!key || !TEMPLATES[key]) return
    setSelectedTemplate(key)
    setCriteria(TEMPLATES[key].criteria.map(c => ({ ...c })))
  }

  function handleSave() {
    if (!isWeightValid) return
    setSaving(true)
    const payload = isEvaluation
      ? { criteria, scores, evidence, greenFlags, redFlags, recommendation, overallScore }
      : { criteria }
    onSave?.(payload)
    setTimeout(() => setSaving(false), 600)
  }

  function scoreGaugeColor(s) {
    if (s >= 4) return 'text-emerald-400'
    if (s >= 3) return 'text-amber-400'
    if (s >= 2) return 'text-orange-400'
    return 'text-red-400'
  }

  function gaugeStroke(s) {
    if (s >= 4) return 'stroke-emerald-400'
    if (s >= 3) return 'stroke-amber-400'
    if (s >= 2) return 'stroke-orange-400'
    return 'stroke-red-400'
  }

  // ─── EVALUATION MODE ─────────────────────────────────
  if (isEvaluation) {
    return (
      <div className="space-y-4">
        {/* AI Disclaimer Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
        >
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300/90">
            Resultado preliminar asistido por IA. Requiere validacion humana.
          </p>
        </motion.div>

        {/* Overall Score Gauge */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" className={gaugeStroke(overallScore)} strokeWidth="3"
                  strokeDasharray={`${(overallScore / 5) * 100}, 100`} strokeLinecap="round"
                />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${scoreGaugeColor(overallScore)}`}>
                {overallScore.toFixed(1)}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white mb-1">Puntuacion ponderada</h3>
              <p className="text-xs text-gray-500">
                {Object.keys(scores).length} de {criteria.length} criterios evaluados
              </p>
              <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${overallScore >= 4 ? 'bg-emerald-400' : overallScore >= 3 ? 'bg-amber-400' : overallScore >= 2 ? 'bg-orange-400' : 'bg-red-400'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(overallScore / 5) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Criteria Evaluation */}
        <div className="space-y-3">
          {criteria.map((c, idx) => (
            <motion.div
              key={c.name || idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">{c.name}</h4>
                  {c.description && <p className="text-[11px] text-gray-500 mt-0.5">{c.description}</p>}
                </div>
                <span className="text-[10px] font-semibold text-primary-light bg-primary-light/10 px-2 py-0.5 rounded">
                  {c.weight}%
                </span>
              </div>

              {/* Scale 1-5 pills */}
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(val => {
                  const isSelected = scores[c.name] === val
                  const pillColors = val <= 2 ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : val === 3 ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  return (
                    <button
                      key={val}
                      onClick={() => setScores(prev => ({ ...prev, [c.name]: val }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? pillColors
                          : 'border-white/[0.06] bg-white/[0.02] text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                      }`}
                    >
                      <div className="text-sm font-bold">{val}</div>
                      <div className="text-[9px] mt-0.5 opacity-70">{SCALE_LABELS[val - 1]}</div>
                    </button>
                  )
                })}
              </div>

              {/* Evidence textarea */}
              <textarea
                value={evidence[c.name] || ''}
                onChange={e => setEvidence(prev => ({ ...prev, [c.name]: e.target.value }))}
                placeholder="Evidencia o notas sobre este criterio..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] focus:border-primary-light/40 outline-none text-xs text-gray-300 placeholder-gray-600 resize-none"
              />

              {/* Green / Red flag toggles */}
              <div className="flex gap-2">
                <button
                  onClick={() => setGreenFlags(prev => ({ ...prev, [c.name]: !prev[c.name] }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    greenFlags[c.name]
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-white/[0.06] bg-white/[0.02] text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Flag size={10} /> Green flag
                </button>
                <button
                  onClick={() => setRedFlags(prev => ({ ...prev, [c.name]: !prev[c.name] }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    redFlags[c.name]
                      ? 'border-red-500/30 bg-red-500/10 text-red-400'
                      : 'border-white/[0.06] bg-white/[0.02] text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Flag size={10} /> Red flag
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Auto-generated Analysis */}
        <div className="glass rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Analisis automatico</h3>

          {strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle size={12} className="text-emerald-400" />
                <span className="text-[11px] font-medium text-emerald-400">Fortalezas</span>
              </div>
              <div className="space-y-1">
                {strengths.map(c => (
                  <div key={c.name} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/[0.05] rounded-lg border border-emerald-500/10">
                    <Star size={10} className="text-emerald-400" />
                    <span className="text-xs text-emerald-300">{c.name}</span>
                    <span className="text-[10px] text-emerald-500 ml-auto">{scores[c.name]}/5</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gaps.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <XCircle size={12} className="text-red-400" />
                <span className="text-[11px] font-medium text-red-400">Brechas</span>
              </div>
              <div className="space-y-1">
                {gaps.map(c => (
                  <div key={c.name} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/[0.05] rounded-lg border border-red-500/10">
                    <AlertTriangle size={10} className="text-red-400" />
                    <span className="text-xs text-red-300">{c.name}</span>
                    <span className="text-[10px] text-red-500 ml-auto">{scores[c.name]}/5</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <HelpCircle size={12} className="text-gray-400" />
                <span className="text-[11px] font-medium text-gray-400">Preguntas pendientes</span>
              </div>
              <div className="space-y-1">
                {pending.map(c => (
                  <div key={c.name} className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                    <MessageSquare size={10} className="text-gray-500" />
                    <span className="text-xs text-gray-400">Evaluar: {c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recommendation */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recomendacion</h3>
          <div className="flex gap-2">
            {RECOMMENDATIONS.map(r => {
              const Icon = r.icon
              return (
                <button
                  key={r.id}
                  onClick={() => setRecommendation(r.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-all ${
                    recommendation === r.id ? r.color : 'border-white/[0.06] bg-white/[0.02] text-gray-500 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon size={14} /> {r.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-light text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar evaluacion
          </button>
        </div>
      </div>
    )
  }

  // ─── BUILDER MODE ─────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Template selector */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Scorecard</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Define los criterios de evaluacion y sus pesos</p>
          </div>
          <div className="relative">
            <select
              value={selectedTemplate}
              onChange={e => applyTemplate(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-300 focus:border-primary-light/40 outline-none cursor-pointer"
            >
              <option value="">Elegir template...</option>
              {Object.entries(TEMPLATES).map(([key, t]) => (
                <option key={key} value={key}>{t.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Weight indicator */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full transition-colors ${isWeightValid ? 'bg-emerald-400' : totalWeight > 100 ? 'bg-red-400' : 'bg-amber-400'}`}
              animate={{ width: `${Math.min(totalWeight, 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className={`text-xs font-bold ${isWeightValid ? 'text-emerald-400' : totalWeight > 100 ? 'text-red-400' : 'text-amber-400'}`}>
            {totalWeight}%
          </span>
        </div>

        {/* Criteria rows */}
        <AnimatePresence mode="popLayout">
          {criteria.map((c, idx) => (
            <motion.div
              key={idx}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2"
            >
              <div className="flex gap-2 items-start p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={c.name}
                      onChange={e => updateCriterion(idx, 'name', e.target.value)}
                      placeholder="Nombre del criterio"
                      className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] focus:border-primary-light/40 outline-none text-sm text-white placeholder-gray-600"
                    />
                    <div className="relative w-20">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={c.weight}
                        onChange={e => updateCriterion(idx, 'weight', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] focus:border-primary-light/40 outline-none text-sm text-white text-center"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">%</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={c.description}
                    onChange={e => updateCriterion(idx, 'description', e.target.value)}
                    placeholder="Descripcion (opcional)"
                    className="w-full px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] focus:border-primary-light/30 outline-none text-[11px] text-gray-400 placeholder-gray-700"
                  />
                </div>
                <button
                  onClick={() => removeCriterion(idx)}
                  disabled={criteria.length <= 1}
                  className="p-2 text-gray-600 hover:text-red-400 disabled:opacity-20 transition-colors mt-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add criterion */}
        <button
          onClick={addCriterion}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/[0.08] text-xs text-gray-500 hover:text-white hover:border-white/[0.15] hover:bg-white/[0.02] transition-all mt-2"
        >
          <Plus size={14} /> Agregar criterio
        </button>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        {!isWeightValid && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Los pesos deben sumar 100%
          </p>
        )}
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={!isWeightValid || saving || criteria.some(c => !c.name.trim())}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-light text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar scorecard
        </button>
      </div>
    </div>
  )
}
