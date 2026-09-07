#!/usr/bin/env node
// Tests de la lógica pura de SLAs (netlify/functions/cron-sla-check.mjs).
// Sin framework (el repo no tiene Vitest): node scripts/test-sla-logic.mjs
//
// Solo se prueban las funciones PURAS (daysInStage, evaluateSlaBreaches) —
// jamás toca red, ni Resend, ni la BD real.
import assert from 'node:assert/strict'
import {
  daysInStage,
  evaluateSlaBreaches,
  RECENT_WINDOW_MS,
} from '../netlify/functions/cron-sla-check.mjs'

let passed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (e) {
    console.error(`FAIL  ${name}\n${e.stack || e}`)
    process.exitCode = 1
  }
}

const DAY = 86400000
const NOW = Date.parse('2026-09-08T13:30:00Z')
const ORG = 'org-1'
const iso = daysAgo => new Date(NOW - daysAgo * DAY).toISOString()

const RULES = [
  { stage: 'contacted', max_days: 3, is_active: true },
  { stage: 'interviewing', max_days: 7, is_active: true },
  { stage: 'offer', max_days: 5, is_active: false }, // regla APAGADA
]

function vc(id, stage, daysInStageAgo, extra = {}) {
  return {
    id,
    stage,
    stage_changed_at: iso(daysInStageAgo),
    created_at: iso(daysInStageAgo + 10),
    candidates: { full_name: `Candidato ${id}` },
    vacancies: { title: 'RAP CDMX' },
    ...extra,
  }
}

// ── daysInStage ─────────────────────────────────────────────

test('daysInStage: días completos desde stage_changed_at', () => {
  assert.equal(daysInStage({ stage_changed_at: iso(4) }, NOW), 4)
  assert.equal(daysInStage({ stage_changed_at: iso(0.5) }, NOW), 0)
})

test('daysInStage: cae en created_at si stage_changed_at es null', () => {
  assert.equal(daysInStage({ stage_changed_at: null, created_at: iso(6) }, NOW), 6)
})

test('daysInStage: sin fechas o fecha inválida → 0 (nunca truena)', () => {
  assert.equal(daysInStage({}, NOW), 0)
  assert.equal(daysInStage({ stage_changed_at: 'garbage' }, NOW), 0)
  assert.equal(daysInStage(null, NOW), 0)
})

test('daysInStage: fecha futura (reloj chueco) → 0, no negativo', () => {
  assert.equal(daysInStage({ stage_changed_at: iso(-2) }, NOW), 0)
})

// ── evaluateSlaBreaches: vencimiento ────────────────────────

test('vencido: días > max_days genera notificación org-wide', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'contacted', 4)],
    rules: RULES, alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 1)
  assert.equal(out[0].organization_id, ORG)
  assert.equal(out[0].recipient_id, null)
  assert.equal(out[0].type, 'sla_breach')
  assert.equal(out[0].entity_type, 'vacancy_candidate')
  assert.equal(out[0].entity_id, 'a')
  assert.equal(out[0].title, 'SLA vencido: Candidato a lleva 4d en Contactado')
  assert.match(out[0].body, /3 días/)
  assert.match(out[0].body, /RAP CDMX/)
})

test('límite exacto NO vence (se vence al EXCEDER max_days)', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'contacted', 3)],
    rules: RULES, alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 0)
})

test('dentro del límite NO genera nada', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'contacted', 1), vc('b', 'interviewing', 6)],
    rules: RULES, alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 0)
})

test('etapa sin regla NO genera nada', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'sourced', 90)],
    rules: RULES, alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 0)
})

test('regla is_active=false se ignora aunque esté vencidísimo', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'offer', 40)],
    rules: RULES, alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 0)
})

test('hired/rejected jamás generan alerta (etapas terminales)', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'hired', 100), vc('b', 'rejected', 100)],
    rules: [...RULES, { stage: 'hired', max_days: 1, is_active: true }],
    alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 0)
})

// ── dedupe ──────────────────────────────────────────────────

test('dedupe: entity_id ya notificado en la ventana de 72h se salta', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'contacted', 10), vc('b', 'contacted', 10)],
    rules: RULES, alreadyNotified: new Set(['a']), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 1)
  assert.equal(out[0].entity_id, 'b')
})

test('dedupe: acepta Array además de Set', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'contacted', 10)],
    rules: RULES, alreadyNotified: ['a'], labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 0)
})

test('ventana de dedupe es 72h', () => {
  assert.equal(RECENT_WINDOW_MS, 72 * 3600 * 1000)
})

// ── etiquetas y robustez ────────────────────────────────────

test('usa las etiquetas custom de la org (stage_labels) en el título', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'interviewing', 9)],
    rules: RULES, alreadyNotified: new Set(),
    labels: { interviewing: 'Entrevista con Kari' }, orgId: ORG, now: NOW,
  })
  assert.equal(out[0].title, 'SLA vencido: Candidato a lleva 9d en Entrevista con Kari')
})

test('candidato sin nombre y sin vacante no truena', () => {
  const out = evaluateSlaBreaches({
    candidates: [{ id: 'x', stage: 'contacted', stage_changed_at: iso(9), candidates: null, vacancies: null }],
    rules: RULES, alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 1)
  assert.match(out[0].title, /Candidato sin nombre/)
  assert.match(out[0].body, /—/)
})

test('entradas vacías/nulas → [] sin tronar', () => {
  assert.deepEqual(evaluateSlaBreaches({ candidates: null, rules: null, alreadyNotified: null, labels: null, orgId: ORG, now: NOW }), [])
  assert.deepEqual(evaluateSlaBreaches({ candidates: [], rules: RULES, alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW }), [])
})

test('regla con max_days inválido (0, negativo, NaN) se ignora', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'contacted', 10)],
    rules: [{ stage: 'contacted', max_days: 0 }, { stage: 'contacted', max_days: -1 }, { stage: 'contacted', max_days: 'nope' }],
    alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 0)
})

test('max_days numérico como string ("3") funciona', () => {
  const out = evaluateSlaBreaches({
    candidates: [vc('a', 'contacted', 4)],
    rules: [{ stage: 'contacted', max_days: '3' }],
    alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.equal(out.length, 1)
})

test('la fila a insertar NO incluye _meta al quitarlo (mismo destructuring del handler)', () => {
  const [b] = evaluateSlaBreaches({
    candidates: [vc('a', 'contacted', 4)],
    rules: RULES, alreadyNotified: new Set(), labels: null, orgId: ORG, now: NOW,
  })
  assert.ok(b._meta) // el email resumen lo necesita
  const { _meta, ...row } = b
  assert.deepEqual(Object.keys(row).sort(), ['body', 'entity_id', 'entity_type', 'organization_id', 'recipient_id', 'title', 'type'])
})

console.log(`\n${passed} pruebas OK${process.exitCode ? ' (con fallas)' : ''}`)
