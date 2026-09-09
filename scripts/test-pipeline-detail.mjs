#!/usr/bin/env node
// Tests de la lógica pura de la ficha operativa (src/lib/pipelineDetail.js).
// Sin framework (el repo no usa Vitest): node scripts/test-pipeline-detail.mjs
import assert from 'node:assert/strict'
import {
  PIPELINE_DETAIL_GROUPS,
  PIPELINE_DETAIL_FIELDS,
  EDITABLE_KEYS,
  PSYCHOMETRIC_OPTIONS,
  hasUploads,
  docsStatus,
  psychometricStatus,
  detailBadges,
  normalizeFieldValue,
  toInputValue,
  sanitizePatch,
} from '../src/lib/pipelineDetail.js'

let passed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`) }
  catch (e) { console.error(`FAIL  ${name}\n${e.stack || e}`); process.exitCode = 1 }
}

// ── Definición de campos ──
test('grupos agrupan las 3 fases del diagrama', () => {
  assert.deepEqual(PIPELINE_DETAIL_GROUPS.map(g => g.id), ['seleccion', 'documentacion', 'induccion'])
})

test('todos los campos tienen key/label/type y no hay llaves duplicadas', () => {
  const keys = new Set()
  for (const f of PIPELINE_DETAIL_FIELDS) {
    assert.ok(f.key && f.label && f.type, `campo incompleto: ${JSON.stringify(f)}`)
    assert.ok(['date', 'datetime', 'bool', 'select', 'text'].includes(f.type), `tipo inválido: ${f.type}`)
    assert.ok(!keys.has(f.key), `llave duplicada: ${f.key}`)
    keys.add(f.key)
  }
})

test('campos select traen options', () => {
  for (const f of PIPELINE_DETAIL_FIELDS) {
    if (f.type === 'select') assert.ok(Array.isArray(f.options) && f.options.length, `sin options: ${f.key}`)
  }
})

test('psychometric options coinciden con el CHECK de BD', () => {
  assert.deepEqual(PSYCHOMETRIC_OPTIONS.map(o => o.value).sort(), ['apto', 'no_apto', 'pendiente'])
})

test('EDITABLE_KEYS cubre todos los campos y no incluye jsonb de solo-lectura', () => {
  assert.equal(EDITABLE_KEYS.size, PIPELINE_DETAIL_FIELDS.length)
  assert.ok(!EDITABLE_KEYS.has('docs_uploaded'))
  assert.ok(!EDITABLE_KEYS.has('week1_checkpoint'))
})

// ── hasUploads ──
test('hasUploads maneja null, array, objeto', () => {
  assert.equal(hasUploads(null), false)
  assert.equal(hasUploads([]), false)
  assert.equal(hasUploads({}), false)
  assert.equal(hasUploads(['ine.pdf']), true)
  assert.equal(hasUploads({ ine: 'url' }), true)
})

// ── docsStatus ──
test('docsStatus: na si no se solicitaron', () => {
  assert.equal(docsStatus(null), 'na')
  assert.equal(docsStatus({}), 'na')
})

test('docsStatus: incompleto si solicitados sin confirmar/subir', () => {
  assert.equal(docsStatus({ docs_requested_at: '2026-09-01' }), 'incompleto')
})

test('docsStatus: completo si confirmados o subidos', () => {
  assert.equal(docsStatus({ docs_requested_at: '2026-09-01', docs_confirmed_at: '2026-09-02' }), 'completo')
  assert.equal(docsStatus({ docs_requested_at: '2026-09-01', docs_uploaded: { ine: 'x' } }), 'completo')
})

// ── psychometricStatus ──
test('psychometricStatus: na si no enviado', () => {
  assert.equal(psychometricStatus(null), 'na')
  assert.equal(psychometricStatus({}), 'na')
})

test('psychometricStatus: pendiente si enviado sin resultado', () => {
  assert.equal(psychometricStatus({ psychometric_sent_at: '2026-09-01' }), 'pendiente')
  assert.equal(psychometricStatus({ psychometric_sent_at: '2026-09-01', psychometric_result: 'pendiente' }), 'pendiente')
})

test('psychometricStatus: refleja apto/no_apto', () => {
  assert.equal(psychometricStatus({ psychometric_sent_at: '2026-09-01', psychometric_result: 'apto' }), 'apto')
  assert.equal(psychometricStatus({ psychometric_sent_at: '2026-09-01', psychometric_result: 'no_apto' }), 'no_apto')
})

// ── detailBadges (espejo de las alertas del copiloto) ──
test('detailBadges: psicométrico pendiente en ámbar', () => {
  const b = detailBadges({ psychometric_sent_at: '2026-09-01' }, 'interviewing')
  assert.ok(b.some(x => x.id === 'psychometric_pending' && x.tone === 'amber'))
})

test('detailBadges: docs incompletos', () => {
  const b = detailBadges({ docs_requested_at: '2026-09-01' }, 'documentation')
  assert.ok(b.some(x => x.id === 'docs_incomplete'))
})

test('detailBadges: CNSF sin fecha sólo en documentation', () => {
  const inDoc = detailBadges({ docs_requested_at: '2026-09-01', docs_confirmed_at: '2026-09-02' }, 'documentation')
  assert.ok(inDoc.some(x => x.id === 'cnsf_no_date' && x.tone === 'red'))
  const elsewhere = detailBadges({}, 'interviewing')
  assert.ok(!elsewhere.some(x => x.id === 'cnsf_no_date'))
})

test('detailBadges: sin detail → sin badges', () => {
  assert.deepEqual(detailBadges(null, 'sourced'), [])
})

// ── normalizeFieldValue ──
test('normalizeFieldValue: vacío → null', () => {
  assert.equal(normalizeFieldValue('text', ''), null)
  assert.equal(normalizeFieldValue('date', null), null)
})

test('normalizeFieldValue: bool desde string', () => {
  assert.equal(normalizeFieldValue('bool', 'true'), true)
  assert.equal(normalizeFieldValue('bool', 'false'), false)
  assert.equal(normalizeFieldValue('bool', true), true)
})

test('normalizeFieldValue: pasa text/select/date tal cual', () => {
  assert.equal(normalizeFieldValue('select', 'apto'), 'apto')
  assert.equal(normalizeFieldValue('date', '2026-09-10'), '2026-09-10')
})

// ── toInputValue ──
test('toInputValue: null → cadena vacía', () => {
  assert.equal(toInputValue('datetime', null), '')
  assert.equal(toInputValue('text', null), '')
})

test('toInputValue: date acepta YYYY-MM-DD directo', () => {
  assert.equal(toInputValue('date', '2026-09-10'), '2026-09-10')
})

test('toInputValue: datetime produce formato datetime-local', () => {
  const out = toInputValue('datetime', '2026-09-10T15:30:00.000Z')
  assert.match(out, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
})

test('toInputValue: fecha inválida → cadena vacía', () => {
  assert.equal(toInputValue('datetime', 'no-es-fecha'), '')
})

// ── sanitizePatch ──
test('sanitizePatch: descarta llaves no editables', () => {
  const clean = sanitizePatch({
    psychometric_result: 'apto',
    docs_uploaded: { x: 1 },   // solo-lectura
    id: 'abc',                 // meta
    basura: 1,
  })
  assert.deepEqual(clean, { psychometric_result: 'apto' })
})

console.log(`\n${passed} tests passed`)
