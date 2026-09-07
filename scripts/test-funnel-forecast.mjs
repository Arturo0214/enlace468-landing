#!/usr/bin/env node
// Tests del modelo de pronóstico de clave (src/lib/funnelForecast.js).
// Sin framework (el repo no tiene Vitest): node scripts/test-funnel-forecast.mjs
import assert from 'node:assert/strict'
import {
  computeFunnelStats,
  forecastNextHire,
  normalizePipeline,
  pipelineFromHistory,
  FUNNEL_LEVELS,
} from '../src/lib/funnelForecast.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-01T12:00:00Z').getTime()
let passed = 0

function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`) }
  catch (e) { console.error(`FAIL  ${name}\n${e.stack || e}`); process.exitCode = 1 }
}

/** Recorre cualquier salida y verifica que no haya NaN ni Infinity. */
function assertNoBadNumbers(obj, path = '$') {
  if (obj == null) return
  if (typeof obj === 'number') {
    assert.ok(Number.isFinite(obj), `${path} es ${obj}`)
    return
  }
  if (obj instanceof Date) {
    assert.ok(Number.isFinite(obj.getTime()), `${path} es Date inválida`)
    return
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) assertNoBadNumbers(v, `${path}.${k}`)
  }
}

/** Genera transiciones sintéticas: `spec` = [n0, n1, ...] cuántos llegan a
 *  cada nivel; los que se quedan en el nivel i son rechazados ahí (nada de
 *  pendientes → censura cero). `daysPerStage` controla la velocidad. */
function synthTransitions(spec, daysPerStage = 5, startAt = NOW - 120 * DAY) {
  const stagesByLevel = ['sourced', 'contacted', 'screening', 'interviewing', 'evaluated', 'presented', 'offer', 'hired']
  const rows = []
  for (let c = 0; c < spec[0]; c++) {
    const id = `vc-${c}`
    // ¿hasta qué nivel llega este candidato?
    let maxLevel = 0
    for (let l = 1; l < spec.length; l++) { if (c < spec[l]) maxLevel = l }
    let t = startAt + (c % 7) * DAY
    for (let l = 0; l <= maxLevel; l++) {
      rows.push({ vacancy_candidate_id: id, from_stage: l === 0 ? null : stagesByLevel[l - 1], to_stage: stagesByLevel[l], changed_at: new Date(t).toISOString() })
      t += daysPerStage * DAY
    }
    if (maxLevel < 7) {
      rows.push({ vacancy_candidate_id: id, from_stage: stagesByLevel[maxLevel], to_stage: 'rejected', changed_at: new Date(t).toISOString() })
    }
  }
  return rows
}

// ── 1. Pipeline y historia vacíos ───────────────────────────────────────────
test('vacío: sin transiciones ni pipeline, salida sin NaN/Infinity', () => {
  const stats = computeFunnelStats([], { now: NOW })
  assert.equal(stats.candidateCount, 0)
  assert.equal(stats.hires, 0)
  assert.equal(stats.stages.length, FUNNEL_LEVELS.length)
  stats.stages.forEach(s => {
    assert.equal(s.conversionSource, 'fallback')
    assert.ok(s.conversion > 0 && s.conversion < 1)
    assert.ok(s.medianDays > 0)
  })
  const fc = forecastNextHire(stats, [], { now: NOW })
  assert.equal(fc.expectedHires, 0)
  assert.equal(fc.confidence, 'baja')
  // Sin pipeline ni prospección no hay clave alcanzable en el horizonte.
  assert.equal(fc.etaWeeks.probable, null)
  assert.equal(fc.horizonCapped, true)
  assert.ok(fc.sourcedPerWeekNeeded > 0)
  assertNoBadNumbers(fc)
  assertNoBadNumbers(stats)
})

test('vacío: entradas basura no truenan', () => {
  const stats = computeFunnelStats([
    null, {}, { vacancy_candidate_id: 'x' }, // sin to_stage
    { vacancy_candidate_id: 'y', to_stage: 'sourced', changed_at: 'no-es-fecha' },
  ], { now: NOW })
  assertNoBadNumbers(stats)
  const fc = forecastNextHire(stats, { sourced: 'no-numero', hired: 5, rejected: 3 }, { now: NOW })
  assertNoBadNumbers(fc)
})

// ── 2. Conversión sintética conocida ────────────────────────────────────────
test('sintético: 100 sourced → 10 hired, conversiones y ETA razonables', () => {
  // 100 → 80 → 60 → 40 → 30 → 20 → 15 → 10 hired; 5 días por etapa.
  const rows = synthTransitions([100, 80, 60, 40, 30, 20, 15, 10], 5)
  const stats = computeFunnelStats(rows, { now: NOW })
  assert.equal(stats.candidateCount, 100)
  assert.equal(stats.hires, 10)
  const byKey = Object.fromEntries(stats.stages.map(s => [s.key, s]))
  assert.equal(byKey.sourced.reached, 100)
  assert.equal(byKey.sourced.conversion, 0.8)       // 80/100
  assert.equal(byKey.contacted.conversion, 0.75)    // 60/80
  assert.equal(byKey.offer.conversion, 0.67)        // 10/15 redondeado
  assert.equal(byKey.interviewing.medianDays, 5)
  stats.stages.forEach(s => assert.equal(s.conversionSource, 'observed'))

  // Pipeline actual: 1 en oferta → p_hire(offer)=10/15≈0.67, mediana 5 días.
  const fc = forecastNextHire(stats, [{ stage: 'offer' }], { now: NOW, throughputPerWeek: 0 })
  assert.ok(Math.abs(fc.expectedHires - 0.67) < 0.02, `expectedHires=${fc.expectedHires}`)
  // Λ nunca llega a 1 con 0.67 esperado → probable null, pero optimista (Λ≥0.5)
  // cae en la semana de la oferta (~5 días ≈ 0.7 semanas).
  assert.equal(fc.etaWeeks.probable, null)
  assert.ok(fc.etaWeeks.optimista != null && fc.etaWeeks.optimista <= 1, `optimista=${fc.etaWeeks.optimista}`)

  // Pipeline gordo: 50 sourced (p_hire=0.1) → 5 esperadas al final del embudo
  // (35 días ≈ 5 semanas): la primera clave debe pronosticarse en ≤ 5 semanas.
  const fc2 = forecastNextHire(stats, { sourced: 50 }, { now: NOW, throughputPerWeek: 0 })
  assert.ok(Math.abs(fc2.expectedHires - 5) < 0.3, `expectedHires=${fc2.expectedHires}`)
  assert.ok(fc2.etaWeeks.probable != null && fc2.etaWeeks.probable <= 5.2, `probable=${fc2.etaWeeks.probable}`)
  assert.ok(fc2.etaDate instanceof Date)
  // p_hire(sourced)=0.1 → para 1 clave/mes (≈0.23/sem) se necesitan ~3/semana.
  assert.ok(fc2.sourcedPerWeekNeeded >= 2 && fc2.sourcedPerWeekNeeded <= 4, `needed=${fc2.sourcedPerWeekNeeded}`)
  assertNoBadNumbers(fc2)
})

test('sintético: censura — pendientes activos no castigan la conversión', () => {
  // 10 llegan a sourced y avanzan a contacted; otros 10 ACABAN de entrar y
  // siguen en sourced (activos): la conversión sourced→contacted debe ser 1.0
  // clampeada a 0.95, no 0.5.
  const rows = synthTransitions([10, 10, 0, 0, 0, 0, 0, 0], 3)
  for (let c = 0; c < 10; c++) {
    rows.push({ vacancy_candidate_id: `nuevo-${c}`, from_stage: null, to_stage: 'sourced', changed_at: new Date(NOW - 1 * DAY).toISOString() })
  }
  const stats = computeFunnelStats(rows, { now: NOW })
  const sourced = stats.stages[0]
  assert.equal(sourced.reached, 20)
  assert.equal(sourced.pending, 10)
  assert.ok(sourced.conversion >= 0.9, `conversion=${sourced.conversion}`)
})

// ── 3. Muestra chica ────────────────────────────────────────────────────────
test('muestra chica: <5 transiciones → fallback + confidence baja', () => {
  const rows = synthTransitions([3, 2, 1, 0, 0, 0, 0, 0], 4)
  const stats = computeFunnelStats(rows, { now: NOW })
  stats.stages.forEach(s => assert.equal(s.conversionSource, 'fallback'))
  const fc = forecastNextHire(stats, [{ stage: 'contacted' }, { stage: 'sourced' }], { now: NOW })
  assert.equal(fc.confidence, 'baja')
  assert.ok(fc.expectedHires >= 0)
  assertNoBadNumbers(fc)
  assertNoBadNumbers(stats)
})

// ── 4. División por cero / extremos ─────────────────────────────────────────
test('división por cero: todos rechazados en sourced, cero throughput', () => {
  // 50 sourced, 0 avanzan (todos rechazados) → conversión observada 0 se
  // clampa a CONV_MIN: sourcedPerWeekNeeded finito, nada de Infinity.
  const rows = synthTransitions([50, 0, 0, 0, 0, 0, 0, 0], 2)
  const stats = computeFunnelStats(rows, { now: NOW })
  assert.equal(stats.stages[0].conversion, 0.01) // clamp CONV_MIN=0.005 → round2
  const fc = forecastNextHire(stats, { sourced: 10 }, { now: NOW, throughputPerWeek: 0 })
  assert.ok(Number.isFinite(fc.sourcedPerWeekNeeded))
  assert.ok(fc.sourcedPerWeekNeeded > 0)
  assert.equal(fc.paceStatus, 'rojo')
  assertNoBadNumbers(fc)
})

test('normalizePipeline acepta array y mapa, ignora hired/rejected', () => {
  const a = normalizePipeline([{ stage: 'sourced' }, { stage: 'shortlist' }, { stage: 'hired' }, { stage: 'rejected' }, null])
  assert.deepEqual(a, [1, 0, 0, 0, 1, 0, 0])
  const b = normalizePipeline({ sourced: 2, offer: 1, hired: 9, basura: 4 })
  assert.deepEqual(b, [2, 0, 0, 0, 0, 0, 1])
})

test('pipelineFromHistory: última etapa por candidato, estancados aparte', () => {
  const rows = [
    // vivo en interviewing (movió hace 2 días)
    { vacancy_candidate_id: 'a', to_stage: 'sourced', changed_at: new Date(NOW - 10 * DAY).toISOString() },
    { vacancy_candidate_id: 'a', to_stage: 'interviewing', changed_at: new Date(NOW - 2 * DAY).toISOString() },
    // estancado en sourced (45 días sin movimiento) → excluido de counts
    { vacancy_candidate_id: 'b', to_stage: 'sourced', changed_at: new Date(NOW - 45 * DAY).toISOString() },
    // rechazado → fuera
    { vacancy_candidate_id: 'c', to_stage: 'screening', changed_at: new Date(NOW - 3 * DAY).toISOString() },
    { vacancy_candidate_id: 'c', to_stage: 'rejected', changed_at: new Date(NOW - 1 * DAY).toISOString() },
    // contratado → fuera
    { vacancy_candidate_id: 'd', to_stage: 'hired', changed_at: new Date(NOW - 1 * DAY).toISOString() },
  ]
  const p = pipelineFromHistory(rows, { now: NOW })
  assert.deepEqual(p.counts, { interviewing: 1 })
  assert.equal(p.staleCount, 1)
  assert.equal(p.activeTotal, 2)
  assert.deepEqual(pipelineFromHistory([], { now: NOW }), { counts: {}, staleCount: 0, activeTotal: 0 })
})

test('prospección continua permite ETA aunque el pipeline esté vacío', () => {
  const rows = synthTransitions([100, 80, 60, 40, 30, 20, 15, 10], 5)
  const stats = computeFunnelStats(rows, { now: NOW })
  // 0 candidatos hoy, pero 30 prospectados/semana con p_hire=0.1 → 3/semana.
  const fc = forecastNextHire(stats, [], { now: NOW, throughputPerWeek: 30 })
  assert.ok(fc.etaWeeks.probable != null, 'probable debe existir')
  // El embudo completo tarda 35 días (5 sem); Λ=1 se alcanza ~5.33 semanas.
  assert.ok(fc.etaWeeks.probable > 5 && fc.etaWeeks.probable < 7, `probable=${fc.etaWeeks.probable}`)
  assert.ok(fc.etaWeeks.optimista <= fc.etaWeeks.probable)
  assert.ok(fc.etaWeeks.pesimista >= fc.etaWeeks.probable)
  assertNoBadNumbers(fc)
})

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ' (con fallas)' : ''}`)
