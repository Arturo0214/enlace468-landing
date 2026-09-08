import { useState, useMemo, useEffect } from 'react'
import { Printer, Copy, CheckCircle, Shield, Users, TrendingUp, Star, AlertTriangle, ChevronRight, Target, CalendarClock } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { computeFunnelStats, forecastNextHire, pipelineFromHistory } from '../../lib/funnelForecast'
import { useStageLabels } from '../../lib/useStageLabels'

const STAGE_COLORS = {
  sourced: 'bg-gray-500',
  contacted: 'bg-blue-500',
  screening: 'bg-cyan-500',
  interviewing: 'bg-purple-500',
  shortlist: 'bg-amber-500',
  presented: 'bg-accent',
  offer: 'bg-green-500',
  hired: 'bg-emerald-500',
  rejected: 'bg-red-500',
}

const FUNNEL_ORDER = ['sourced', 'contacted', 'screening', 'interviewing', 'shortlist', 'presented', 'offer', 'hired']

// Orden de avance para el funnel HISTÓRICO (feedback Karina 2026-08-28: el
// reporte solo mostraba dónde está cada quien HOY; un entrevistado que luego
// fue rechazado desaparecía del conteo de entrevistas). 'evaluated' y
// 'shortlist' son la misma altura del embudo (el pipeline usa una, el reporte
// histórico las funde).
const STAGE_ORDER = { sourced: 0, contacted: 1, screening: 2, interviewing: 3, evaluated: 4, shortlist: 4, presented: 5, offer: 6, hired: 7 }
// Las etiquetas visibles salen de useStageLabels(); 'evaluated' funde
// evaluado + finalista en el embudo histórico (misma altura).
const FUNNEL_STEPS = [
  { key: 'sourced', order: 0 },
  { key: 'contacted', order: 1 },
  { key: 'screening', order: 2 },
  { key: 'interviewing', order: 3 },
  { key: 'evaluated', order: 4 },
  { key: 'presented', order: 5 },
  { key: 'offer', order: 6 },
  { key: 'hired', order: 7 },
]

// Formatea un ETA en semanas: si es menor a 1 semana, en días.
function fmtEta(weeks) {
  if (weeks == null) return null
  if (weeks < 1) return `${Math.max(1, Math.round(weeks * 7))} dias`
  return `${weeks} semanas`
}

function scoreColor(score) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function scoreBg(score) {
  if (score >= 80) return 'bg-emerald-500/15'
  if (score >= 60) return 'bg-amber-500/15'
  return 'bg-red-500/15'
}

export default function ExecutiveReport({ vacancy, candidates }) {
  const { getLabel } = useStageLabels()
  // Etiqueta de un paso del embudo; 'evaluated' agrupa dos etapas internas.
  const stepLabel = key => (key === 'evaluated' ? `${getLabel('evaluated')} / ${getLabel('shortlist')}` : getLabel(key))
  const [copied, setCopied] = useState(false)
  // Transiciones de etapa registradas en BD (trigger en vacancy_candidates +
  // backfill desde activity_log) → permite contar quiénes PASARON por cada
  // etapa aunque hoy estén en rechazados.
  const [history, setHistory] = useState(null)
  // Historia de TODA la org (RLS la acota): benchmark agregado para el
  // pronóstico cuando la vacante es nueva y no tiene historia propia.
  const [orgHistory, setOrgHistory] = useState(null)

  useEffect(() => {
    if (!vacancy?.id) return
    let alive = true
    supabase
      .from('stage_history')
      .select('vacancy_candidate_id, from_stage, to_stage, changed_at')
      .eq('vacancy_id', vacancy.id)
      .limit(10000)
      .then(({ data, error }) => { if (alive) setHistory(error ? [] : (data || [])) })
    return () => { alive = false }
  }, [vacancy?.id])

  useEffect(() => {
    let alive = true
    supabase
      .from('stage_history')
      .select('vacancy_candidate_id, from_stage, to_stage, changed_at')
      .limit(10000)
      .then(({ data, error }) => { if (alive) setOrgHistory(error ? [] : (data || [])) })
    return () => { alive = false }
  }, [])

  // Process metrics
  const metrics = useMemo(() => {
    if (!candidates?.length) return null

    const total = candidates.length
    const rejected = candidates.filter(c => c.stage === 'rejected').length
    const active = total - rejected
    const hired = candidates.filter(c => c.stage === 'hired').length

    // Funnel counts
    const funnel = {}
    candidates.forEach(vc => {
      funnel[vc.stage] = (funnel[vc.stage] || 0) + 1
    })

    // ── Funnel HISTÓRICO: hasta dónde llegó cada candidato ──
    const maxByVc = {}
    candidates.forEach(vc => {
      const o = STAGE_ORDER[vc.stage]
      if (o != null) maxByVc[vc.id] = o
    })
    ;(history || []).forEach(h => {
      const o = STAGE_ORDER[h.to_stage]
      if (o != null) maxByVc[h.vacancy_candidate_id] = Math.max(maxByVc[h.vacancy_candidate_id] ?? -1, o)
    })
    const rejectedIds = new Set(candidates.filter(c => c.stage === 'rejected').map(c => c.id))
    const reachedOrders = Object.entries(maxByVc)
    const histFunnel = FUNNEL_STEPS.map(step => {
      const reached = reachedOrders.filter(([, o]) => o >= step.order).length
      const rejectedAfter = reachedOrders.filter(([id, o]) => o === step.order && rejectedIds.has(id)).length
      const current = candidates.filter(c =>
        c.stage === step.key || (step.key === 'evaluated' && c.stage === 'shortlist')
      ).length
      return { ...step, reached, rejectedAfter, current }
    })

    // Source distribution
    const sources = {}
    candidates.forEach(vc => {
      const src = vc.source || vc.candidates?.source || 'other'
      sources[src] = (sources[src] || 0) + 1
    })

    // Shortlist: top candidates by match_score
    const shortlist = [...candidates]
      .filter(c => c.match_score != null && c.stage !== 'rejected')
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5)

    // Average days in process
    const avgDays = candidates.length > 0
      ? Math.round(
          candidates.reduce((sum, c) => {
            const start = new Date(c.created_at)
            return sum + Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
          }, 0) / candidates.length
        )
      : 0

    // Conversion rate sourced -> presentado, sobre el HISTÓRICO (quien llegó a
    // presentado cuenta aunque después haya sido rechazado).
    const reachedPresented = histFunnel.find(s => s.key === 'presented')?.reached || 0
    const conversionRate = total > 0 ? Math.round((reachedPresented / total) * 100) : 0

    return { total, active, rejected, hired, funnel, histFunnel, sources, shortlist, avgDays, conversionRate }
  }, [candidates, history])

  // ── Pronóstico de clave (FASE 3) ──
  // Estadísticas de la vacante; si su historia es corta (sin claves o pocos
  // candidatos), caemos al agregado de toda la org. El RITMO de prospección
  // siempre es el propio de la vacante.
  const forecast = useMemo(() => {
    if (!candidates?.length || history == null) return null
    const vacStats = computeFunnelStats(history)
    let stats = vacStats
    let scope = 'vacante'
    if ((vacStats.hires === 0 || vacStats.candidateCount < 40) && orgHistory?.length) {
      stats = computeFunnelStats(orgHistory)
      scope = 'global'
    }
    // Pipeline vivo desde la historia (excluye estancados >30 días, que
    // inflaban el valor esperado); si no hay historia, los candidatos de hoy.
    const pipe = pipelineFromHistory(history)
    const pipelineInput = pipe.activeTotal > 0 ? pipe.counts : candidates
    const fc = forecastNextHire(stats, pipelineInput, {
      throughputPerWeek: vacStats.throughput.recentPerWeek,
    })
    return { stats, vacStats, scope, fc, staleCount: pipe.staleCount }
  }, [candidates, history, orgHistory])

  function handlePrint() {
    window.print()
  }

  function handleCopy() {
    if (!vacancy || !metrics) return

    const lines = [
      `REPORTE EJECUTIVO - ${vacancy.title}`,
      `${vacancy.company_name || 'Enlace 468'} | ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
      `RESUMEN`,
      `- Puesto: ${vacancy.title}`,
      `- Empresa: ${vacancy.company_name || 'N/A'}`,
      `- Ubicacion: ${vacancy.location || 'N/A'} (${vacancy.modality || 'N/A'})`,
      vacancy.salary_min ? `- Rango salarial: $${Number(vacancy.salary_min).toLocaleString()} - $${Number(vacancy.salary_max).toLocaleString()} MXN` : '',
      '',
      `METRICAS`,
      `- Total candidatos: ${metrics.total}`,
      `- En proceso: ${metrics.active}`,
      `- Tasa de conversion: ${metrics.conversionRate}%`,
      `- Dias promedio en proceso: ${metrics.avgDays}`,
      '',
      `EMBUDO HISTORICO (llegaron a cada etapa)`,
      ...metrics.histFunnel.filter(s => s.reached > 0).map(s =>
        `- ${stepLabel(s.key)}: llegaron ${s.reached}${s.current ? ` | ${s.current} actualmente` : ''}${s.rejectedAfter ? ` | ${s.rejectedAfter} descartados tras llegar` : ''}`
      ),
      ...(forecast ? [
        '',
        `PRONOSTICO DE CLAVE`,
        forecast.fc.etaWeeks.probable != null
          ? `- ETA proxima clave: ~${fmtEta(forecast.fc.etaWeeks.probable)} (rango ${fmtEta(forecast.fc.etaWeeks.optimista) ?? '?'} - ${fmtEta(forecast.fc.etaWeeks.pesimista) ?? '78+ semanas'})${forecast.fc.etaDate ? ` → ${forecast.fc.etaDate.toLocaleDateString('es-MX')}` : ''}`
          : `- ETA proxima clave: fuera de horizonte (>78 semanas) al ritmo actual`,
        `- Claves esperadas del pipeline actual: ${forecast.fc.expectedHires}`,
        `- Ritmo: ${forecast.fc.currentSourcedPerWeek} prospectados/semana vs ~${forecast.fc.sourcedPerWeekNeeded} necesarios para 1 clave/mes (${forecast.fc.paceStatus})`,
        `- Confianza ${forecast.fc.confidence} (${forecast.stats.totalTransitions} transiciones historicas${forecast.scope === 'global' ? ', benchmark global' : ''})`,
      ] : []),
      '',
      `SHORTLIST`,
      ...metrics.shortlist.map((vc, i) =>
        `${i + 1}. ${vc.candidates?.full_name} - ${vc.candidates?.current_title || 'N/A'} (${Math.round(vc.match_score)}%)`
      ),
      '',
      'CONFIDENCIAL - Solo para uso interno',
    ].filter(l => l !== undefined)

    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (!vacancy) return null

  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      {/* Action buttons - no print */}
      <div className="flex items-center justify-end gap-2 no-print">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
        >
          {copied ? <><CheckCircle size={13} className="text-emerald-400" /> Copiado</> : <><Copy size={13} /> Copiar resumen</>}
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-primary-light hover:bg-primary-light/90 rounded-lg transition-colors"
        >
          <Printer size={13} /> Imprimir
        </button>
      </div>

      {/* CONFIDENCIAL header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-xl p-5 text-center"
        style={{ borderTop: '3px solid #D97706' }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield size={16} className="text-gold" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-gold uppercase">Confidencial</span>
          <Shield size={16} className="text-gold" />
        </div>
        <h1 className="text-xl font-display font-bold gradient-text mb-1">Reporte Ejecutivo</h1>
        <p className="text-sm text-gray-400">{vacancy.title}</p>
        <p className="text-xs text-gray-600 mt-1">
          {vacancy.company_name || 'Enlace 468'} | {today}
        </p>
      </motion.div>

      {/* Vacancy summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-xl p-5"
      >
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Resumen de la vacante</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Puesto', value: vacancy.title },
            { label: 'Empresa', value: vacancy.company_name || 'N/A' },
            { label: 'Ubicacion', value: vacancy.location || 'N/A' },
            { label: 'Modalidad', value: vacancy.modality || 'N/A' },
            { label: 'Prioridad', value: vacancy.priority || 'N/A' },
            vacancy.salary_min && {
              label: 'Rango salarial',
              value: `$${Number(vacancy.salary_min).toLocaleString()} - $${Number(vacancy.salary_max).toLocaleString()} MXN`,
            },
            vacancy.target_date && {
              label: 'Fecha objetivo',
              value: new Date(vacancy.target_date).toLocaleDateString('es-MX'),
            },
          ].filter(Boolean).map(item => (
            <div key={item.label} className="bg-white/[0.03] rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-600 uppercase tracking-wide">{item.label}</div>
              <div className="text-sm text-white mt-0.5 font-medium">{item.value}</div>
            </div>
          ))}
        </div>
        {vacancy.description && (
          <div className="mt-4">
            <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Descripcion</div>
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-4">{vacancy.description}</p>
          </div>
        )}
      </motion.div>

      {/* Process metrics */}
      {metrics && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-5"
          >
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Metricas del proceso</h2>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Total', value: metrics.total, icon: Users, color: 'text-white', iconBg: 'bg-primary/20' },
                { label: 'En proceso', value: metrics.active, icon: TrendingUp, color: 'text-blue-400', iconBg: 'bg-blue-500/20' },
                { label: 'Conversion', value: `${metrics.conversionRate}%`, icon: Star, color: metrics.conversionRate >= 20 ? 'text-emerald-400' : 'text-amber-400', iconBg: metrics.conversionRate >= 20 ? 'bg-emerald-500/20' : 'bg-amber-500/20' },
                { label: 'Dias promedio', value: metrics.avgDays, icon: AlertTriangle, color: metrics.avgDays <= 15 ? 'text-emerald-400' : 'text-amber-400', iconBg: metrics.avgDays <= 15 ? 'bg-emerald-500/20' : 'bg-amber-500/20' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white/[0.03] rounded-xl p-3.5 text-center">
                  <div className={`w-8 h-8 rounded-lg ${kpi.iconBg} flex items-center justify-center mx-auto mb-2`}>
                    <kpi.icon size={14} className={kpi.color} />
                  </div>
                  <div className={`text-xl font-bold font-display ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Funnel HISTÓRICO: cuántos LLEGARON a cada etapa (aunque hoy
                estén rechazados) + cuántos siguen ahí y cuántos se quedaron */}
            <div className="mb-5">
              <h3 className="text-[11px] font-medium text-gray-400 mb-1">Embudo de seleccion (historico)</h3>
              <p className="text-[10px] text-gray-600 mb-3">
                Cada barra cuenta a todos los que <span className="text-gray-400">llegaron</span> a la etapa,
                incluyendo a quienes despues fueron rechazados o avanzaron.
              </p>
              <div className="space-y-1.5">
                {metrics.histFunnel.map(step => {
                  const pct = metrics.total > 0 ? (step.reached / metrics.total * 100) : 0
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500 w-20 text-right">{stepLabel(step.key)}</span>
                      <div className="flex-1 h-5 bg-white/[0.03] rounded-md overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(pct, step.reached > 0 ? 8 : 0)}%` }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className={`h-full ${STAGE_COLORS[step.key]} rounded-md flex items-center justify-end pr-2`}
                        >
                          {step.reached > 0 && <span className="text-[9px] font-bold text-white">{step.reached}</span>}
                        </motion.div>
                      </div>
                      <span className="text-[10px] text-gray-600 w-8">{pct.toFixed(0)}%</span>
                      <span className="text-[9px] text-gray-600 w-40 hidden sm:block">
                        {step.current > 0 && <span className="text-gray-400">{step.current} aqui ahora</span>}
                        {step.current > 0 && step.rejectedAfter > 0 && ' · '}
                        {step.rejectedAfter > 0 && <span className="text-red-400/80">{step.rejectedAfter} rechazados tras llegar</span>}
                      </span>
                    </div>
                  )
                })}
                {/* Rejected separate */}
                {(metrics.funnel.rejected || 0) > 0 && (
                  <div className="flex items-center gap-3 mt-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-[10px] text-gray-500 w-20 text-right">Rechazado</span>
                    <div className="flex-1 h-5 bg-white/[0.03] rounded-md overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max((metrics.funnel.rejected / metrics.total) * 100, 8)}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="h-full bg-red-500 rounded-md flex items-center justify-end pr-2"
                      >
                        <span className="text-[9px] font-bold text-white">{metrics.funnel.rejected}</span>
                      </motion.div>
                    </div>
                    <span className="text-[10px] text-gray-600 w-8">{((metrics.funnel.rejected / metrics.total) * 100).toFixed(0)}%</span>
                    <span className="w-40 hidden sm:block" />
                  </div>
                )}
              </div>
            </div>

            {/* Source distribution */}
            {Object.keys(metrics.sources).length > 0 && (
              <div>
                <h3 className="text-[11px] font-medium text-gray-400 mb-3">Distribucion por fuente</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(metrics.sources)
                    .sort((a, b) => b[1] - a[1])
                    .map(([src, count]) => {
                      const labels = { linkedin: 'LinkedIn', referral: 'Referido', jobboard: 'Bolsa de trabajo', internal: 'Interno', other: 'Otro' }
                      const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0
                      return (
                        <div key={src} className="bg-white/[0.04] rounded-lg px-3 py-2 text-center min-w-[80px]">
                          <div className="text-sm font-bold text-white">{count}</div>
                          <div className="text-[10px] text-gray-500">{labels[src] || src}</div>
                          <div className="text-[9px] text-gray-600">{pct}%</div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Pronóstico de clave (FASE 3): composición actual del pipeline ×
              conversiones históricas de stage_history × velocidad por etapa */}
          {forecast && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="glass rounded-xl p-5"
            >
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Target size={13} className="text-accent" /> Pronostico de clave
              </h2>
              {forecast.scope === 'global' && (
                <p className="text-[10px] text-amber-400/80 mb-3">
                  Esta vacante aun no tiene historia suficiente para pronosticar por si sola —
                  el calculo usa el benchmark agregado de toda la organizacion.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {/* (a) ETA de próxima clave */}
                <div className="bg-white/[0.03] rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CalendarClock size={13} className="text-primary-light" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">ETA proxima clave</span>
                  </div>
                  {forecast.fc.etaWeeks.probable != null ? (
                    <>
                      <div className="text-xl font-bold font-display text-white">
                        ~{fmtEta(forecast.fc.etaWeeks.probable)}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        rango {fmtEta(forecast.fc.etaWeeks.optimista) ?? '?'} – {fmtEta(forecast.fc.etaWeeks.pesimista) ?? '78+ semanas'}
                        {forecast.fc.etaDate && (
                          <> · est. <span className="text-gray-300">{forecast.fc.etaDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</span></>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm font-medium text-amber-400">
                      Fuera de horizonte ({'>'}78 semanas) al ritmo y conversion actuales
                    </div>
                  )}
                  <div className="text-[10px] text-gray-600 mt-1.5">
                    {forecast.fc.expectedHires} clave{forecast.fc.expectedHires === 1 ? '' : 's'} esperada{forecast.fc.expectedHires === 1 ? '' : 's'} del pipeline vivo
                    {forecast.staleCount > 0 && <> (excluye {forecast.staleCount} sin movimiento en 30+ dias)</>}
                  </div>
                </div>

                {/* (b) Ritmo de prospección: semáforo actual vs necesario */}
                <div className="bg-white/[0.03] rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`w-2 h-2 rounded-full ${forecast.fc.paceStatus === 'verde' ? 'bg-emerald-400' : forecast.fc.paceStatus === 'amarillo' ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">Ritmo para 1 clave/mes</span>
                  </div>
                  <div className="text-xl font-bold font-display text-white">
                    ~{forecast.fc.sourcedPerWeekNeeded} <span className="text-xs font-normal text-gray-500">prospectados/semana</span>
                  </div>
                  <div className="text-[11px] mt-0.5">
                    <span className={forecast.fc.paceStatus === 'verde' ? 'text-emerald-400' : forecast.fc.paceStatus === 'amarillo' ? 'text-amber-400' : 'text-red-400'}>
                      ritmo actual: {forecast.fc.currentSourcedPerWeek}/semana
                    </span>
                    <span className="text-gray-600"> ({Math.round(forecast.fc.paceRatio * 100)}% de lo necesario)</span>
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1.5">
                    al ritmo de conversion historica de {forecast.scope === 'global' ? 'la organizacion' : 'esta vacante'}
                  </div>
                </div>
              </div>

              {/* (c) Embudo con números: conversión y días por etapa */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] text-gray-600 uppercase tracking-wide">
                      <th className="py-1.5 pr-2 font-medium">Etapa</th>
                      <th className="py-1.5 px-2 font-medium text-right">Llegaron</th>
                      <th className="py-1.5 px-2 font-medium text-right">Pasan a la sig.</th>
                      <th className="py-1.5 px-2 font-medium text-right">Dias medianos</th>
                      <th className="py-1.5 pl-2 font-medium text-right">Prob. de clave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.stats.stages.map(s => (
                      <tr key={s.key} className="border-t border-white/[0.04] text-[11px]">
                        <td className="py-1.5 pr-2 text-gray-300">{stepLabel(s.key)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-400">{s.reached}</td>
                        <td className="py-1.5 px-2 text-right text-gray-300">
                          {Math.round(s.conversion * 100)}%{s.conversionSource === 'fallback' && <span className="text-amber-500/70">*</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right text-gray-400">
                          {s.medianDays}{s.daysSource === 'fallback' && <span className="text-amber-500/70">*</span>}
                        </td>
                        <td className="py-1.5 pl-2 text-right text-gray-400">
                          {(forecast.fc.pHireByStage[s.key] * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* (d) Nota de confianza */}
              <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
                Confianza <span className={forecast.fc.confidence === 'alta' ? 'text-emerald-400' : forecast.fc.confidence === 'media' ? 'text-amber-400' : 'text-red-400'}>{forecast.fc.confidence}</span> —
                basado en {forecast.stats.totalTransitions} transiciones historicas de {forecast.stats.candidateCount} candidatos
                ({forecast.scope === 'global' ? 'toda la organizacion' : 'esta vacante'}), {forecast.stats.hires} clave{forecast.stats.hires === 1 ? '' : 's'} registrada{forecast.stats.hires === 1 ? '' : 's'}.
                {' '}<span className="text-amber-500/70">*</span> = estimado con el agregado/benchmark por muestra chica.
              </p>
            </motion.div>
          )}

          {/* Shortlist - top candidates */}
          {metrics.shortlist.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass rounded-xl p-5"
            >
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Shortlist — Top candidatos
              </h2>
              <div className="space-y-3">
                {metrics.shortlist.map((vc, i) => {
                  const c = vc.candidates || {}
                  const score = Math.round(vc.match_score || 0)

                  // Generate strengths and gaps based on score
                  const strengths = []
                  const gaps = []

                  if (c.years_experience >= 5) strengths.push('Experiencia solida')
                  else if (c.years_experience) gaps.push('Experiencia limitada')
                  if (score >= 80) strengths.push('Alta compatibilidad')
                  if (c.current_title?.toLowerCase().includes(vacancy?.title?.split(' ')[0]?.toLowerCase())) {
                    strengths.push('Perfil alineado')
                  }
                  if (c.location && vacancy?.location && c.location !== vacancy.location) {
                    gaps.push('Requiere reubicacion')
                  }
                  if (score < 70) gaps.push('Match por debajo del objetivo')
                  if (strengths.length === 0) strengths.push('Perfil evaluado')

                  return (
                    <div key={vc.id || i} className="bg-white/[0.03] rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        {/* Rank */}
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-bold text-primary-light">{i + 1}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div>
                              <div className="text-sm font-medium text-white">{c.full_name}</div>
                              <div className="text-[11px] text-gray-500">
                                {c.current_title}{c.current_company ? ` · ${c.current_company}` : ''}
                              </div>
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${scoreBg(score)}`}>
                              <Star size={11} className={scoreColor(score)} />
                              <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}%</span>
                            </div>
                          </div>

                          {/* Stage badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-gray-400">
                              {getLabel(vc.stage)}
                            </span>
                            {c.years_experience && (
                              <span className="text-[10px] text-gray-500">{c.years_experience} anos exp.</span>
                            )}
                          </div>

                          {/* Strengths & gaps */}
                          <div className="flex flex-wrap gap-1.5">
                            {strengths.map((s, j) => (
                              <span key={`s-${j}`} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <ChevronRight size={8} className="inline" /> {s}
                              </span>
                            ))}
                            {gaps.map((g, j) => (
                              <span key={`g-${j}`} className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <AlertTriangle size={8} className="inline" /> {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Pending questions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-5"
          >
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Preguntas pendientes</h2>
            <div className="space-y-2">
              {[
                metrics.active === 0 && 'No hay candidatos activos en el proceso. Considerar ampliar sourcing.',
                metrics.conversionRate < 15 && 'Tasa de conversion baja. Revisar criterios de screening o calidad de sourcing.',
                metrics.avgDays > 20 && 'El proceso lleva mas de 20 dias en promedio. Evaluar cuellos de botella.',
                (metrics.funnel.interviewing || 0) === 0 && metrics.total > 5 && 'Ningun candidato ha llegado a entrevista. Revisar filtros de screening.',
                !vacancy.salary_min && 'Rango salarial no definido. Puede impactar la negociacion.',
              ].filter(Boolean).map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/10">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{q}</span>
                </div>
              ))}
              {[
                metrics.active > 0 && metrics.conversionRate >= 15 && metrics.avgDays <= 20 && (
                  <div key="ok" className="flex items-start gap-2 text-xs text-emerald-400/80 bg-emerald-500/5 rounded-lg px-3 py-2 border border-emerald-500/10">
                    <CheckCircle size={12} className="mt-0.5 flex-shrink-0" />
                    <span>El proceso se encuentra dentro de parametros saludables.</span>
                  </div>
                )
              ].filter(Boolean)}
            </div>
          </motion.div>

          {/* Next steps */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass rounded-xl p-5"
          >
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Proximos pasos</h2>
            <div className="space-y-2">
              {[
                (metrics.funnel.sourced || 0) > 0 && `Contactar ${metrics.funnel.sourced} candidato${metrics.funnel.sourced > 1 ? 's' : ''} en etapa "${getLabel('sourced')}"`,
                (metrics.funnel.contacted || 0) > 0 && `Dar seguimiento a ${metrics.funnel.contacted} candidato${metrics.funnel.contacted > 1 ? 's' : ''} contactado${metrics.funnel.contacted > 1 ? 's' : ''}`,
                (metrics.funnel.interviewing || 0) > 0 && `Agendar/completar entrevistas con ${metrics.funnel.interviewing} candidato${metrics.funnel.interviewing > 1 ? 's' : ''}`,
                (metrics.funnel.shortlist || 0) > 0 && `Preparar presentacion de ${metrics.funnel.shortlist} candidato${metrics.funnel.shortlist > 1 ? 's' : ''} en "${getLabel('shortlist')}"`,
                (metrics.funnel.presented || 0) > 0 && `Esperar feedback de cliente sobre ${metrics.funnel.presented} candidato${metrics.funnel.presented > 1 ? 's' : ''} presentado${metrics.funnel.presented > 1 ? 's' : ''}`,
                (metrics.funnel.offer || 0) > 0 && `Dar seguimiento a ${metrics.funnel.offer} oferta${metrics.funnel.offer > 1 ? 's' : ''} en curso`,
                metrics.shortlist.length < 3 && metrics.total < 10 && `Ampliar base de candidatos — se recomienda minimo 10 en "${getLabel('sourced')}"`,
              ].filter(Boolean).map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-gray-300">
                  <span className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary-light flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Legal notes */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl p-4 border border-white/[0.05] bg-white/[0.01]"
          >
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <strong className="text-gray-500">Aviso legal:</strong> Este documento es confidencial y propiedad de {vacancy.company_name || 'Enlace 468'}.
              La informacion contenida es exclusivamente para uso interno del proceso de seleccion.
              Queda prohibida su reproduccion, distribucion o divulgacion total o parcial sin autorizacion expresa.
              El manejo de datos personales de los candidatos se realiza conforme a la Ley Federal de Proteccion de Datos Personales
              en Posesion de los Particulares (LFPDPPP) y su reglamento. Los datos seran utilizados unicamente para fines de reclutamiento
              y seleccion de personal.
            </p>
            <p className="text-[9px] text-gray-500 mt-2">
              Generado el {today} | Enlace 468 Talent Solutions
            </p>
          </motion.div>
        </>
      )}

      {/* Empty state */}
      {(!candidates || candidates.length === 0) && (
        <div className="glass rounded-xl p-10 text-center">
          <Users size={32} className="mx-auto text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">No hay candidatos en el pipeline para generar el reporte.</p>
          <p className="text-xs text-gray-600 mt-1">Agrega candidatos desde la pestana de Sourcing.</p>
        </div>
      )}
    </div>
  )
}
