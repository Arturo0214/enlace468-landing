// ─────────────────────────────────────────────────────────────────────────────
// funnelForecast.js — Modelo de pronóstico de "clave" (= contratación, stage
// 'hired') sobre las transiciones de `stage_history` (FASE 3 del plan).
//
// Módulo PURO: no importa supabase ni React. Recibe datos, devuelve números.
// Testeable con `node scripts/test-funnel-forecast.mjs`.
//
// Modelo en 2 pasos:
//   1. computeFunnelStats(transitions)  → conversión histórica etapa→etapa,
//      días medianos por etapa y ritmo de prospección (sourced/semana).
//   2. forecastNextHire(stats, pipeline) → valor esperado de claves del
//      pipeline actual + ETA de la PRIMERA clave modelando las llegadas como
//      proceso de Poisson no homogéneo: cada candidato en etapa i aporta
//      intensidad p_hire(i) que "llega" tras el tiempo mediano restante t_i,
//      y la prospección futura aporta un flujo continuo w·p_hire(sourced).
//      P(≥1 clave antes de t) = 1 − exp(−Λ(t)); los percentiles se leen de Λ:
//        optimista  Λ=0.5  (~39% de probabilidad acumulada)
//        probable   Λ=1.0  (~63%)
//        pesimista  Λ=1.6  (~80%)
//
// Garantía: ninguna salida contiene NaN ni Infinity — etapas sin muestra
// suficiente (<5 transiciones resueltas) caen al agregado de etapas vecinas
// o, en último término, al benchmark real FINANCE CONSULTANT
// (363 sourced → 42 entrevista → 1 oferta), bajando `confidence`.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

/** Altura de cada stage en el embudo. 'evaluated' y 'shortlist' son el mismo
 *  escalón (el pipeline usa una u otra según la pantalla). */
export const STAGE_LEVELS = {
  sourced: 0,
  contacted: 1,
  screening: 2,
  interviewing: 3,
  evaluated: 4,
  shortlist: 4,
  presented: 5,
  offer: 6,
  hired: 7,
}

export const HIRED_LEVEL = 7

/** Escalones del embudo previos a la clave (0..6). */
export const FUNNEL_LEVELS = [
  { key: 'sourced', order: 0, label: 'Prospectado' },
  { key: 'contacted', order: 1, label: 'Contactado' },
  { key: 'screening', order: 2, label: 'Screening' },
  { key: 'interviewing', order: 3, label: 'Entrevista' },
  { key: 'evaluated', order: 4, label: 'Evaluado / Shortlist' },
  { key: 'presented', order: 5, label: 'Presentado' },
  { key: 'offer', order: 6, label: 'Oferta' },
]

/** Mínimo de transiciones resueltas para confiar en la conversión observada. */
const MIN_STAGE_SAMPLE = 5

/** Un candidato activo sin movimiento en más de N días se considera estancado:
 *  cuenta como NO conversión en el denominador. Sin esto, los cientos de
 *  perfiles que nunca se marcan como rechazados (se quedan en sourced/
 *  contacted para siempre) quedarían excluidos como "censura" y la conversión
 *  observada se dispara a ~95% (visto con datos reales de la org). */
const STALE_PENDING_DAYS = 30

/** Clamp de toda conversión usada en el pronóstico: evita p=0 (divisiones por
 *  cero / ETAs infinitas) y p=1 (optimismo irreal por muestra chica). */
const CONV_MIN = 0.005
const CONV_MAX = 0.95

/** Horizonte máximo del pronóstico (semanas). Más allá devolvemos null. */
const HORIZON_WEEKS = 78

/** Conversión por escalón derivada del benchmark real FINANCE CONSULTANT:
 *  363 sourced → 42 llegaron a entrevista (≈0.55·0.5·0.42) → 1 oferta
 *  (≈0.45·0.35·0.15) → hired estimado 0.5. Solo se usa como último recurso. */
const DEFAULT_CONVERSIONS = [0.55, 0.5, 0.42, 0.45, 0.35, 0.15, 0.5]

/** Días medianos por etapa cuando no hay duraciones observadas. */
const DEFAULT_MEDIAN_DAYS = [5, 4, 4, 7, 5, 7, 7]

/** Objetivo del negocio: 1 clave por mes, expresado en claves/semana. */
const TARGET_HIRES_PER_WEEK = 12 / 52

// ── helpers ──────────────────────────────────────────────────────────────────

function isFiniteNum(x) {
  return typeof x === 'number' && Number.isFinite(x)
}

function clampConv(p) {
  if (!isFiniteNum(p)) return CONV_MIN
  return Math.min(CONV_MAX, Math.max(CONV_MIN, p))
}

function median(arr) {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function mean(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function round1(x) { return Math.round(x * 10) / 10 }
function round2(x) { return Math.round(x * 100) / 100 }

/**
 * Normaliza el pipeline actual a conteos por nivel del embudo (0..6).
 * Acepta: array de candidatos con `.stage`, o un mapa `{ stage: count }`.
 * Ignora hired (ya es clave) y rejected (fuera del embudo).
 */
export function normalizePipeline(currentPipeline) {
  const counts = new Array(FUNNEL_LEVELS.length).fill(0)
  if (!currentPipeline) return counts
  const add = (stage, n) => {
    const lvl = STAGE_LEVELS[stage]
    if (lvl != null && lvl >= 0 && lvl < FUNNEL_LEVELS.length && isFiniteNum(n) && n > 0) {
      counts[lvl] += n
    }
  }
  if (Array.isArray(currentPipeline)) {
    currentPipeline.forEach(c => { if (c && c.stage) add(c.stage, 1) })
  } else if (typeof currentPipeline === 'object') {
    Object.entries(currentPipeline).forEach(([stage, n]) => add(stage, Number(n)))
  }
  return counts
}

/**
 * Deriva la composición VIVA del pipeline desde stage_history: última etapa
 * de cada candidato, separando a los estancados (sin movimiento en
 * `staleDays`, default STALE_PENDING_DAYS). Los estancados se excluyen del
 * pronóstico — tratarlos como vivos infló el valor esperado de claves en el
 * backtest (cientos de perfiles muertos en sourced/contacted que nadie marca
 * como rechazados).
 *
 * @param {Array<{vacancy_candidate_id:string, to_stage:string, changed_at:string|number|Date}>} transitions
 * @param {{now?: number|string|Date, staleDays?: number}} [options]
 * @returns {{counts: Object<string,number>, staleCount: number, activeTotal: number}}
 *   `counts` = solo candidatos vivos por stage (compatible con forecastNextHire).
 */
export function pipelineFromHistory(transitions, options = {}) {
  const now = options.now != null ? new Date(options.now).getTime() : Date.now()
  const staleDays = isFiniteNum(options.staleDays) ? options.staleDays : STALE_PENDING_DAYS
  const last = new Map()
  for (const t of (transitions || [])) {
    if (!t || !t.vacancy_candidate_id || !t.to_stage) continue
    const at = new Date(t.changed_at).getTime()
    if (!Number.isFinite(at)) continue
    const prev = last.get(t.vacancy_candidate_id)
    if (!prev || at >= prev.at) last.set(t.vacancy_candidate_id, { stage: t.to_stage, at })
  }
  const counts = {}
  let staleCount = 0
  let activeTotal = 0
  for (const { stage, at } of last.values()) {
    if (stage === 'rejected' || stage === 'hired' || STAGE_LEVELS[stage] == null) continue
    activeTotal++
    if (now - at > staleDays * DAY_MS) { staleCount++; continue }
    counts[stage] = (counts[stage] || 0) + 1
  }
  return { counts, staleCount, activeTotal }
}

// ── paso 1: estadísticas históricas ─────────────────────────────────────────

/**
 * Calcula las estadísticas históricas del embudo a partir de filas crudas de
 * `stage_history`.
 *
 * Semántica de los datos (migración 20260831000000): `from_stage IS NULL`
 * significa alta inicial del candidato en el pipeline; cada UPDATE de stage
 * genera una fila con `changed_at`. La historia de un candidato es la
 * secuencia de sus `to_stage` ordenada por `changed_at`.
 *
 * Modelo por etapa i (0=sourced .. 6=offer):
 *  - reached(i)   = candidatos cuyo nivel máximo alcanzado ≥ i.
 *  - advanced(i)  = reached(i+1).
 *  - pending(i)   = candidatos cuyo máximo es exactamente i, siguen ACTIVOS
 *                   (ni rejected ni hired) y tuvieron movimiento en los
 *                   últimos STALE_PENDING_DAYS: todavía no sabemos si
 *                   avanzarán, así que se EXCLUYEN del denominador (censura
 *                   por la derecha). Los estancados >30 días SÍ cuentan como
 *                   no-conversión aunque nadie los haya rechazado formalmente.
 *  - conversion(i)= advanced(i) / (reached(i) − pending(i)); si el denominador
 *                   tiene < MIN_STAGE_SAMPLE muestras, se usa el agregado de
 *                   etapas vecinas observadas (o el benchmark) y se marca
 *                   `conversionSource: 'fallback'`.
 *  - días en etapa: duración de cada segmento [entrada a la etapa, siguiente
 *                   transición] por candidato; el segmento final (aún abierto)
 *                   no cuenta. Mediana 0 o muestra < MIN_STAGE_SAMPLE →
 *                   default del benchmark (`daysSource: 'fallback'`).
 *
 * Throughput: altas iniciales (primera transición de cada candidato) por
 * semana en las últimas 4 y 8 semanas respecto a `options.now`.
 *
 * @param {Array<{vacancy_candidate_id:string, from_stage?:string|null, to_stage:string, changed_at:string|number|Date}>} transitions
 * @param {{now?: number|string|Date}} [options] `now` inyectable para tests/backtests.
 * @returns {{
 *   totalTransitions:number, candidateCount:number, hires:number, rejectedCount:number,
 *   stages: Array<{key:string, order:number, label:string, reached:number, advanced:number,
 *     pending:number, conversion:number, conversionSource:'observed'|'fallback',
 *     sampleSize:number, medianDays:number, meanDays:number|null,
 *     daysSource:'observed'|'fallback', daysSample:number}>,
 *   throughput: {perWeek4:number, perWeek8:number, recentPerWeek:number}
 * }}
 */
export function computeFunnelStats(transitions, options = {}) {
  const now = options.now != null ? new Date(options.now).getTime() : Date.now()

  // Agrupar y ordenar la historia de cada candidato.
  const byVc = new Map()
  for (const t of (transitions || [])) {
    if (!t || !t.vacancy_candidate_id || !t.to_stage) continue
    const at = new Date(t.changed_at).getTime()
    if (!Number.isFinite(at)) continue
    let arr = byVc.get(t.vacancy_candidate_id)
    if (!arr) { arr = []; byVc.set(t.vacancy_candidate_id, arr) }
    arr.push({ toStage: t.to_stage, at })
  }

  const L = FUNNEL_LEVELS.length // 7
  const reached = new Array(L + 1).fill(0)   // índice 7 = hired
  const pendingAt = new Array(L).fill(0)
  const durations = Array.from({ length: L }, () => [])
  const firstAdds = []
  let hires = 0
  let rejectedCount = 0
  let totalTransitions = 0

  for (const arr of byVc.values()) {
    arr.sort((a, b) => a.at - b.at)
    totalTransitions += arr.length
    firstAdds.push(arr[0].at)

    let maxLevel = -1
    let curLevel = null   // nivel del segmento abierto
    let curStart = null

    for (const step of arr) {
      const lvl = STAGE_LEVELS[step.toStage]
      const isRejected = step.toStage === 'rejected'
      if (lvl == null && !isRejected) continue // stage desconocido: ignorar

      if (lvl != null && lvl > maxLevel) maxLevel = lvl

      // Cerrar el segmento anterior cuando cambia el escalón (o rechazan).
      const newLevel = isRejected ? null : lvl
      if (curLevel != null && newLevel !== curLevel) {
        const days = (step.at - curStart) / DAY_MS
        if (days >= 0 && curLevel < L) durations[curLevel].push(days)
      }
      if (newLevel !== curLevel) { curLevel = newLevel; curStart = step.at }
    }

    const lastStage = arr[arr.length - 1].toStage
    if (lastStage === 'rejected') rejectedCount++
    if (maxLevel >= HIRED_LEVEL) hires++
    for (let i = 0; i <= Math.min(maxLevel, L - 1); i++) reached[i]++
    const lastAt = arr[arr.length - 1].at
    const isStale = now - lastAt > STALE_PENDING_DAYS * DAY_MS
    if (maxLevel >= 0 && maxLevel < L && lastStage !== 'rejected' && lastStage !== 'hired' && !isStale) {
      pendingAt[maxLevel]++
    }
  }
  // reached[7] (hired) explícito:
  reached[L] = hires

  // Conversión observada por etapa.
  const observed = FUNNEL_LEVELS.map((lv, i) => {
    const denom = reached[i] - pendingAt[i]
    const adv = reached[i + 1]
    if (denom >= MIN_STAGE_SAMPLE) {
      return { conversion: clampConv(adv / denom), sampleSize: denom }
    }
    return { conversion: null, sampleSize: Math.max(0, denom) }
  })

  // Fallback: media geométrica de las conversiones observadas (agregado
  // "de etapas vecinas"); prioriza vecinas inmediatas si existen.
  const observedVals = observed.filter(o => o.conversion != null).map(o => o.conversion)
  const globalGeo = observedVals.length
    ? Math.exp(observedVals.reduce((s, p) => s + Math.log(p), 0) / observedVals.length)
    : null

  const stages = FUNNEL_LEVELS.map((lv, i) => {
    let conversion = observed[i].conversion
    let conversionSource = 'observed'
    if (conversion == null) {
      const neighbors = [observed[i - 1]?.conversion, observed[i + 1]?.conversion]
        .filter(p => p != null)
      if (neighbors.length) conversion = clampConv(mean(neighbors))
      else if (globalGeo != null) conversion = clampConv(globalGeo)
      else conversion = DEFAULT_CONVERSIONS[i]
      conversionSource = 'fallback'
    }

    const durs = durations[i]
    let medianDays = median(durs)
    let daysSource = 'observed'
    if (durs.length < MIN_STAGE_SAMPLE || medianDays == null) {
      medianDays = DEFAULT_MEDIAN_DAYS[i]
      daysSource = 'fallback'
    } else {
      // Con muestra suficiente se respeta la velocidad observada aunque sea
      // casi cero (el equipo registra movimientos en ráfagas: el backtest
      // mostró que imponer defaults aquí inflaba la ETA ~3 semanas). Piso de
      // 0.25 días para no colapsar el embudo a cero.
      medianDays = Math.max(medianDays, 0.25)
    }

    return {
      key: lv.key,
      order: i,
      label: lv.label,
      reached: reached[i],
      advanced: reached[i + 1],
      pending: pendingAt[i],
      conversion: round2(conversion),
      conversionSource,
      sampleSize: observed[i].sampleSize,
      medianDays: round1(medianDays),
      meanDays: durs.length ? round1(mean(durs)) : null,
      daysSource,
      daysSample: durs.length,
    }
  })

  // Throughput de prospección (altas por semana).
  const in4w = firstAdds.filter(t => t > now - 28 * DAY_MS && t <= now).length
  const in8w = firstAdds.filter(t => t > now - 56 * DAY_MS && t <= now).length
  const perWeek4 = round1(in4w / 4)
  const perWeek8 = round1(in8w / 8)

  return {
    totalTransitions,
    candidateCount: byVc.size,
    hires,
    rejectedCount,
    stages,
    throughput: {
      perWeek4,
      perWeek8,
      recentPerWeek: perWeek4 > 0 ? perWeek4 : perWeek8,
    },
  }
}

// ── paso 2: pronóstico ──────────────────────────────────────────────────────

/**
 * Pronostica la próxima clave con la composición ACTUAL del pipeline y las
 * estadísticas históricas.
 *
 * Modelo (Poisson no homogéneo, ver cabecera del archivo):
 *  - p_hire(i) = ∏ conversion(j) para j=i..offer — probabilidad de que quien
 *    está HOY en la etapa i termine contratado.
 *  - expectedHires = Σ n_i · p_hire(i) — claves esperadas del pipeline actual.
 *  - Cada etapa "entrega" su masa esperada en t_i = Σ días medianos restantes.
 *  - La prospección futura agrega un flujo continuo de
 *    throughputPerWeek · p_hire(sourced) claves/semana, que arranca tras el
 *    tiempo total del embudo.
 *  - ETA percentil X = menor t con Λ(t) ≥ umbral (0.5 / 1.0 / 1.6). Si no se
 *    alcanza dentro de HORIZON_WEEKS, ese percentil es null y
 *    `horizonCapped: true`.
 *
 * @param {ReturnType<typeof computeFunnelStats>} stats
 * @param {Array<{stage:string}>|Object<string,number>} currentPipeline candidatos de HOY (o mapa stage→count)
 * @param {{now?: number|string|Date, throughputPerWeek?: number}} [options]
 *   `throughputPerWeek` permite usar el ritmo propio de la vacante aunque las
 *   conversiones vengan del agregado global.
 * @returns {{
 *   expectedHires:number,
 *   pHireByStage: Object<string,number>,
 *   etaWeeks: {optimista:number|null, probable:number|null, pesimista:number|null},
 *   etaDate: Date|null,
 *   horizonCapped: boolean,
 *   sourcedPerWeekNeeded: number,
 *   currentSourcedPerWeek: number,
 *   paceRatio: number,
 *   paceStatus: 'verde'|'amarillo'|'rojo',
 *   confidence: 'alta'|'media'|'baja',
 *   confidenceReason: string
 * }}
 */
export function forecastNextHire(stats, currentPipeline, options = {}) {
  const now = options.now != null ? new Date(options.now).getTime() : Date.now()
  const L = FUNNEL_LEVELS.length
  const counts = normalizePipeline(currentPipeline)

  const conv = stats.stages.map(s => clampConv(s.conversion))
  const days = stats.stages.map(s => (isFiniteNum(s.medianDays) && s.medianDays > 0 ? s.medianDays : DEFAULT_MEDIAN_DAYS[s.order]))

  // p_hire(i) y tiempo mediano restante desde cada etapa.
  const pHire = new Array(L).fill(0)
  const remDays = new Array(L).fill(0)
  for (let i = L - 1; i >= 0; i--) {
    pHire[i] = conv[i] * (i === L - 1 ? 1 : pHire[i + 1])
    remDays[i] = days[i] + (i === L - 1 ? 0 : remDays[i + 1])
  }

  const expectedHires = counts.reduce((s, n, i) => s + n * pHire[i], 0)

  // Flujo de claves por prospección futura.
  const throughputPerWeek = isFiniteNum(options.throughputPerWeek)
    ? Math.max(0, options.throughputPerWeek)
    : (stats.throughput?.recentPerWeek || 0)
  const sourcingRatePerDay = (throughputPerWeek * pHire[0]) / 7
  const tFull = remDays[0]

  // Λ(t): escalones del pipeline actual + rampa de la prospección.
  const events = counts
    .map((n, i) => ({ t: remDays[i], lambda: n * pHire[i] }))
    .filter(e => e.lambda > 0)

  const horizonDays = HORIZON_WEEKS * 7
  const lambdaAt = (t) => {
    let s = 0
    for (const e of events) if (e.t <= t) s += e.lambda
    if (sourcingRatePerDay > 0 && t > tFull) s += sourcingRatePerDay * (t - tFull)
    return s
  }
  const solve = (target) => {
    if (lambdaAt(horizonDays) < target) return null
    let lo = 0, hi = horizonDays
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2
      if (lambdaAt(mid) >= target) hi = mid; else lo = mid
    }
    return hi
  }

  const dOpt = solve(0.5)
  const dProb = solve(1.0)
  const dPess = solve(1.6)
  const horizonCapped = dOpt == null || dProb == null || dPess == null

  // Prospectados/semana necesarios para 1 clave/mes al ritmo de conversión.
  const sourcedPerWeekNeeded = Math.ceil(TARGET_HIRES_PER_WEEK / pHire[0])
  const paceRatio = round2(throughputPerWeek / sourcedPerWeekNeeded)
  const paceStatus = paceRatio >= 1 ? 'verde' : paceRatio >= 0.6 ? 'amarillo' : 'rojo'

  // Confianza según muestra histórica.
  const fallbackStages = stats.stages.filter(s => s.conversionSource !== 'observed').length
  let confidence = 'baja'
  let confidenceReason = `Solo ${stats.totalTransitions} transiciones / ${stats.hires} claves históricas`
  if (stats.hires >= 3 && stats.candidateCount >= 150 && fallbackStages <= 2) {
    confidence = 'alta'
    confidenceReason = `${stats.totalTransitions} transiciones, ${stats.hires} claves históricas, ${L - fallbackStages}/${L} etapas con muestra propia`
  } else if (stats.hires >= 1 && stats.candidateCount >= 40) {
    confidence = 'media'
    confidenceReason = `${stats.totalTransitions} transiciones y ${stats.hires} clave(s) históricas; ${fallbackStages} etapa(s) estimadas por agregado`
  }

  const pHireByStage = {}
  FUNNEL_LEVELS.forEach((lv, i) => { pHireByStage[lv.key] = Math.round(pHire[i] * 1000) / 1000 })

  return {
    expectedHires: round2(expectedHires),
    pHireByStage,
    etaWeeks: {
      optimista: dOpt != null ? round1(dOpt / 7) : null,
      probable: dProb != null ? round1(dProb / 7) : null,
      pesimista: dPess != null ? round1(dPess / 7) : null,
    },
    etaDate: dProb != null ? new Date(now + dProb * DAY_MS) : null,
    horizonCapped,
    sourcedPerWeekNeeded,
    currentSourcedPerWeek: round1(throughputPerWeek),
    paceRatio,
    paceStatus,
    confidence,
    confidenceReason,
  }
}
