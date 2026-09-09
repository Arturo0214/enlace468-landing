#!/usr/bin/env node
// Tests del motor del copiloto (src/lib/copilot.js).
// Sin framework (el repo no tiene Vitest): node scripts/test-copilot.mjs
import assert from 'node:assert/strict'
import {
  buildFocusList,
  buildDailyPace,
  THRESHOLDS,
  CONNECTIONS_PER_FC,
  WORK_DAYS_PER_MONTH,
} from '../src/lib/copilot.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-09T12:00:00Z').getTime()
let passed = 0

function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`) }
  catch (e) { console.error(`FAIL  ${name}\n${e.stack || e}`); process.exitCode = 1 }
}

const iso = daysAgo => new Date(NOW - daysAgo * DAY).toISOString()

/** Fabrica una fila de vacancy_candidate mínima. */
function vc(over = {}) {
  return {
    id: over.id || 'vc-1',
    stage: over.stage || 'contacted',
    stage_changed_at: over.stage_changed_at || iso(1),
    created_at: over.created_at || iso(1),
    candidates: { full_name: over.name || 'Sofía Herrera' },
    vacancies: { id: over.vacancyId || 'vac-1', title: over.vacancyTitle || 'Finance Consultant' },
    ...over._raw,
  }
}

const findType = (list, type) => list.filter(f => f.type === type)

// ── 1. Lista vacía / entradas ausentes ───────────────────────────────────────
test('vacío: sin candidatos → lista vacía', () => {
  assert.deepEqual(buildFocusList({ now: NOW }), [])
  assert.deepEqual(buildFocusList({ candidates: [], now: NOW }), [])
})

test('robustez: entradas basura no truenan', () => {
  const list = buildFocusList({
    candidates: [null, {}, { id: 'x', stage: 'hired' }, { id: 'y', stage: 'rejected' }],
    details: [null, {}, { vacancy_candidate_id: null }],
    slaRules: [null, { stage: null }, { stage: 'contacted', max_days: 'no-num' }],
    interactions: [null, { direction: 'inbound' }, { vacancy_candidate_id: 'z', created_at: 'nope' }],
    now: NOW,
  })
  assert.deepEqual(list, []) // hired/rejected excluidos; basura ignorada
})

// ── 2. SLA breach ────────────────────────────────────────────────────────────
test('sla_breach: excede el límite → foco con severidad por exceso', () => {
  const cands = [
    vc({ id: 'a', stage: 'sourced', stage_changed_at: iso(112), name: 'Sofía' }), // 112d, límite 5 → alta
    vc({ id: 'b', stage: 'sourced', stage_changed_at: iso(8) }),  // 8d, límite 5 → baja (over 3 < 5)
    vc({ id: 'c', stage: 'sourced', stage_changed_at: iso(4) }),  // 4d ≤ 5 → sin foco
  ]
  const rules = [{ stage: 'sourced', max_days: 5 }]
  const list = buildFocusList({ candidates: cands, slaRules: rules, now: NOW })
  const breaches = findType(list, 'sla_breach')
  assert.equal(breaches.length, 2)
  const a = breaches.find(f => f.candidateId === 'a')
  assert.equal(a.severity, 'alta')
  assert.equal(a.daysStuck, 112)
  assert.match(a.message, /112d/)
  const b = breaches.find(f => f.candidateId === 'b')
  assert.equal(b.severity, 'baja')
})

test('sla_breach: sin regla para la etapa → no dispara', () => {
  const list = buildFocusList({
    candidates: [vc({ stage: 'interviewing', stage_changed_at: iso(90) })],
    slaRules: [{ stage: 'sourced', max_days: 5 }],
    now: NOW,
  })
  assert.equal(findType(list, 'sla_breach').length, 0)
})

test('sla_breach: regla inactiva se ignora', () => {
  const list = buildFocusList({
    candidates: [vc({ stage: 'sourced', stage_changed_at: iso(90) })],
    slaRules: [{ stage: 'sourced', max_days: 5, is_active: false }],
    now: NOW,
  })
  assert.equal(findType(list, 'sla_breach').length, 0)
})

// ── 3. no_response ───────────────────────────────────────────────────────────
test('no_response: outbound sin inbound posterior ≥3d', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a' })],
    interactions: [
      { vacancy_candidate_id: 'a', direction: 'outbound', created_at: iso(5) },
    ],
    now: NOW,
  })
  const nr = findType(list, 'no_response')
  assert.equal(nr.length, 1)
  assert.equal(nr[0].daysStuck, 5)
  assert.equal(nr[0].action, 'Envíale seguimiento')
})

test('no_response: inbound posterior al outbound → sin foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a' })],
    interactions: [
      { vacancy_candidate_id: 'a', direction: 'outbound', created_at: iso(5) },
      { vacancy_candidate_id: 'a', direction: 'inbound', created_at: iso(2) }, // respondió
    ],
    now: NOW,
  })
  assert.equal(findType(list, 'no_response').length, 0)
})

test('no_response: outbound de hace 2d (< umbral) → sin foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a' })],
    interactions: [{ vacancy_candidate_id: 'a', direction: 'outbound', created_at: iso(2) }],
    now: NOW,
  })
  assert.equal(findType(list, 'no_response').length, 0)
  assert.ok(THRESHOLDS.noResponseDays === 3)
})

// ── 4. psychometric_pending ──────────────────────────────────────────────────
test('psychometric_pending: enviado sin resultado > 3d', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'interviewing' })],
    details: [{ vacancy_candidate_id: 'a', psychometric_sent_at: iso(9) }], // sin result
    now: NOW,
  })
  const p = findType(list, 'psychometric_pending')
  assert.equal(p.length, 1)
  assert.equal(p[0].severity, 'alta') // 9 > 2×3
})

test('psychometric_pending: result="pendiente" también dispara', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a' })],
    details: [{ vacancy_candidate_id: 'a', psychometric_sent_at: iso(4), psychometric_result: 'pendiente' }],
    now: NOW,
  })
  assert.equal(findType(list, 'psychometric_pending').length, 1)
})

test('psychometric_pending: con resultado "apto" → sin foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a' })],
    details: [{ vacancy_candidate_id: 'a', psychometric_sent_at: iso(9), psychometric_result: 'apto' }],
    now: NOW,
  })
  assert.equal(findType(list, 'psychometric_pending').length, 0)
})

// ── 5. docs_incomplete ───────────────────────────────────────────────────────
test('docs_incomplete: documentation con docs solicitados sin confirmar > 5d', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'documentation' })],
    details: [{ vacancy_candidate_id: 'a', docs_requested_at: iso(8), cnsf_exam_date: '2026-10-01' }],
    now: NOW,
  })
  const d = findType(list, 'docs_incomplete')
  assert.equal(d.length, 1)
  assert.equal(d[0].action, 'Sube documentos')
})

test('docs_incomplete: docs_uploaded presente → sin foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'documentation' })],
    details: [{ vacancy_candidate_id: 'a', docs_requested_at: iso(8), docs_uploaded: { ine: 'url' }, cnsf_exam_date: '2026-10-01' }],
    now: NOW,
  })
  assert.equal(findType(list, 'docs_incomplete').length, 0)
})

test('docs_incomplete: confirmado → sin foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'documentation' })],
    details: [{ vacancy_candidate_id: 'a', docs_requested_at: iso(8), docs_confirmed_at: iso(2), cnsf_exam_date: '2026-10-01' }],
    now: NOW,
  })
  assert.equal(findType(list, 'docs_incomplete').length, 0)
})

test('docs_incomplete: fuera de documentation no aplica', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'offer' })],
    details: [{ vacancy_candidate_id: 'a', docs_requested_at: iso(8) }],
    now: NOW,
  })
  assert.equal(findType(list, 'docs_incomplete').length, 0)
})

// ── 6. cnsf_no_date ──────────────────────────────────────────────────────────
test('cnsf_no_date: documentation sin fecha de examen → foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'documentation' })],
    details: [{ vacancy_candidate_id: 'a', docs_confirmed_at: iso(1) }], // sin cnsf_exam_date
    now: NOW,
  })
  const c = findType(list, 'cnsf_no_date')
  assert.equal(c.length, 1)
  assert.equal(c[0].action, 'Agenda la fecha del examen CNSF')
})

test('cnsf_no_date: con fecha definida → sin foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'documentation' })],
    details: [{ vacancy_candidate_id: 'a', docs_confirmed_at: iso(1), cnsf_exam_date: '2026-10-15' }],
    now: NOW,
  })
  assert.equal(findType(list, 'cnsf_no_date').length, 0)
})

// ── 7. cnsf_unpaid ───────────────────────────────────────────────────────────
test('cnsf_unpaid: aceptado + 7d sin pago → foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'documentation' })],
    details: [{ vacancy_candidate_id: 'a', accepted_at: iso(10), cnsf_exam_date: '2026-10-01', docs_confirmed_at: iso(1) }],
    now: NOW,
  })
  const c = findType(list, 'cnsf_unpaid')
  assert.equal(c.length, 1)
  assert.equal(c[0].action, 'Confirma pago CNSF')
})

test('cnsf_unpaid: pagado → sin foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'documentation' })],
    details: [{ vacancy_candidate_id: 'a', accepted_at: iso(10), cnsf_paid_at: iso(3), cnsf_exam_date: '2026-10-01', docs_confirmed_at: iso(1) }],
    now: NOW,
  })
  assert.equal(findType(list, 'cnsf_unpaid').length, 0)
})

test('cnsf_unpaid: aceptado hace 3d (< 7) → sin foco', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'offer' })],
    details: [{ vacancy_candidate_id: 'a', accepted_at: iso(3) }],
    now: NOW,
  })
  assert.equal(findType(list, 'cnsf_unpaid').length, 0)
})

// ── 8. Campos faltantes (candidatos viejos sin detail) ───────────────────────
test('candidato viejo sin fila detail: solo reglas independientes disparan', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'sourced', stage_changed_at: iso(30) })],
    slaRules: [{ stage: 'sourced', max_days: 5 }],
    details: [], // sin ficha operativa
    interactions: [{ vacancy_candidate_id: 'a', direction: 'outbound', created_at: iso(10) }],
    now: NOW,
  })
  // Solo sla_breach + no_response; nada de psicométrico/docs/cnsf.
  const types = new Set(list.map(f => f.type))
  assert.ok(types.has('sla_breach'))
  assert.ok(types.has('no_response'))
  assert.ok(!types.has('psychometric_pending'))
  assert.ok(!types.has('docs_incomplete'))
})

// ── 9. Priorización ──────────────────────────────────────────────────────────
test('orden: severidad desc, luego daysStuck desc', () => {
  const list = buildFocusList({
    candidates: [
      vc({ id: 'a', stage: 'sourced', stage_changed_at: iso(6) }),  // sla baja (over<max)
      vc({ id: 'b', stage: 'sourced', stage_changed_at: iso(200) }), // sla alta
    ],
    slaRules: [{ stage: 'sourced', max_days: 5 }],
    now: NOW,
  })
  assert.equal(list[0].severity, 'alta')
  assert.equal(list[0].candidateId, 'b')
})

test('un candidato puede generar varios focos', () => {
  const list = buildFocusList({
    candidates: [vc({ id: 'a', stage: 'documentation', stage_changed_at: iso(20) })],
    slaRules: [{ stage: 'documentation', max_days: 7 }],
    details: [{
      vacancy_candidate_id: 'a',
      accepted_at: iso(20),
      docs_requested_at: iso(15),
      psychometric_sent_at: iso(15),
      // sin cnsf_exam_date, sin pago, sin confirm docs, sin result
    }],
    interactions: [{ vacancy_candidate_id: 'a', direction: 'outbound', created_at: iso(6) }],
    now: NOW,
  })
  const types = new Set(list.map(f => f.type))
  assert.ok(types.has('sla_breach'))
  assert.ok(types.has('docs_incomplete'))
  assert.ok(types.has('cnsf_no_date'))
  assert.ok(types.has('cnsf_unpaid'))
  assert.ok(types.has('psychometric_pending'))
  assert.ok(types.has('no_response'))
})

// ── 10. buildDailyPace ───────────────────────────────────────────────────────
test('pace: verde cuando alcanza la cuota diaria', () => {
  const p = buildDailyPace({ connectionsToday: 20, monthGoalFC: 3 })
  // 3×105=315/22 ≈ 15/día. 20 ≥ 15 → verde.
  assert.equal(p.monthTarget, 3 * CONNECTIONS_PER_FC)
  assert.ok(p.neededPerDay >= 14 && p.neededPerDay <= 15, `needed=${p.neededPerDay}`)
  assert.equal(p.status, 'verde')
  assert.ok(p.ratio >= 1)
})

test('pace: rojo cuando va muy por debajo', () => {
  const p = buildDailyPace({ connectionsToday: 2, monthGoalFC: 3 })
  assert.equal(p.status, 'rojo') // 2/15 ≈ 0.13 < 0.6
})

test('pace: amarillo en zona intermedia', () => {
  const p = buildDailyPace({ connectionsToday: 10, monthGoalFC: 3 })
  // 10/15 ≈ 0.67 → amarillo
  assert.equal(p.status, 'amarillo')
})

test('pace: usa interactionsToday si no hay connectionsToday', () => {
  const p = buildDailyPace({ interactionsToday: 30, monthGoalFC: 3 })
  assert.equal(p.sentToday, 30)
  assert.equal(p.status, 'verde')
})

test('pace: sin datos → 0 enviados, rojo, sin NaN', () => {
  const p = buildDailyPace({})
  assert.equal(p.sentToday, 0)
  assert.equal(p.status, 'rojo')
  assert.ok(Number.isFinite(p.neededPerDay) && p.neededPerDay > 0)
  assert.ok(Number.isFinite(p.ratio))
  assert.ok(WORK_DAYS_PER_MONTH > 0)
})

test('pace: meta inválida cae a 3 FC', () => {
  const p = buildDailyPace({ connectionsToday: 5, monthGoalFC: 'x' })
  assert.equal(p.monthTarget, 3 * CONNECTIONS_PER_FC)
})

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ' (con fallas)' : ''}`)
