import { useState, useMemo } from 'react'
import { Printer, Copy, CheckCircle, Shield, Users, TrendingUp, Star, AlertTriangle, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

const STAGE_LABELS = {
  sourced: 'Sourced',
  contacted: 'Contactado',
  screening: 'Screening',
  interviewing: 'Entrevista',
  shortlist: 'Shortlist',
  presented: 'Presentado',
  offer: 'Oferta',
  hired: 'Contratado',
  rejected: 'Rechazado',
}

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
  const [copied, setCopied] = useState(false)

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

    // Conversion rate sourced -> presented
    const presented = (funnel.presented || 0) + (funnel.offer || 0) + (funnel.hired || 0)
    const conversionRate = total > 0 ? Math.round((presented / total) * 100) : 0

    return { total, active, rejected, hired, funnel, sources, shortlist, avgDays, conversionRate }
  }, [candidates])

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

            {/* Funnel */}
            <div className="mb-5">
              <h3 className="text-[11px] font-medium text-gray-400 mb-3">Embudo de seleccion</h3>
              <div className="space-y-1.5">
                {FUNNEL_ORDER.map(stage => {
                  const count = metrics.funnel[stage] || 0
                  const pct = metrics.total > 0 ? (count / metrics.total * 100) : 0
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500 w-20 text-right">{STAGE_LABELS[stage]}</span>
                      <div className="flex-1 h-5 bg-white/[0.03] rounded-md overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className={`h-full ${STAGE_COLORS[stage]} rounded-md flex items-center justify-end pr-2`}
                        >
                          {count > 0 && <span className="text-[9px] font-bold text-white">{count}</span>}
                        </motion.div>
                      </div>
                      <span className="text-[10px] text-gray-600 w-8">{pct.toFixed(0)}%</span>
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
                              {STAGE_LABELS[vc.stage] || vc.stage}
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
                (metrics.funnel.sourced || 0) > 0 && `Contactar ${metrics.funnel.sourced} candidato${metrics.funnel.sourced > 1 ? 's' : ''} en etapa sourced`,
                (metrics.funnel.contacted || 0) > 0 && `Dar seguimiento a ${metrics.funnel.contacted} candidato${metrics.funnel.contacted > 1 ? 's' : ''} contactado${metrics.funnel.contacted > 1 ? 's' : ''}`,
                (metrics.funnel.interviewing || 0) > 0 && `Agendar/completar entrevistas con ${metrics.funnel.interviewing} candidato${metrics.funnel.interviewing > 1 ? 's' : ''}`,
                (metrics.funnel.shortlist || 0) > 0 && `Preparar presentacion de ${metrics.funnel.shortlist} candidato${metrics.funnel.shortlist > 1 ? 's' : ''} en shortlist`,
                (metrics.funnel.presented || 0) > 0 && `Esperar feedback de cliente sobre ${metrics.funnel.presented} candidato${metrics.funnel.presented > 1 ? 's' : ''} presentado${metrics.funnel.presented > 1 ? 's' : ''}`,
                (metrics.funnel.offer || 0) > 0 && `Dar seguimiento a ${metrics.funnel.offer} oferta${metrics.funnel.offer > 1 ? 's' : ''} en curso`,
                metrics.shortlist.length < 3 && metrics.total < 10 && 'Ampliar base de candidatos — se recomienda minimo 10 candidatos sourced',
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
            <p className="text-[9px] text-gray-700 mt-2">
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
