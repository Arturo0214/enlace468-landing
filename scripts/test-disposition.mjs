#!/usr/bin/env node
// Tests de la lógica pura de disposición/ruteo (src/lib/disposition.js).
// Sin framework (el repo no usa Vitest): node scripts/test-disposition.mjs
import assert from 'node:assert/strict'
import {
  DISPOSITIONS,
  DISPOSITION_VALUES,
  getDisposition,
  dispositionLabel,
  suggestDisposition,
  summarizeDispositions,
  DEFAULT_DISPOSITION,
} from '../src/lib/disposition.js'

let passed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`) }
  catch (e) { console.error(`FAIL  ${name}\n${e.stack || e}`); process.exitCode = 1 }
}

// ── Catálogo ──
test('DISPOSITIONS tiene las 6 salidas esperadas', () => {
  assert.deepEqual(
    DISPOSITION_VALUES,
    ['fc_track', 'tu_marca_vende', 'otro_rol', 'otro_producto', 'nurture', 'descartado'],
  )
})

test('cada disposición tiene label, description, action y color', () => {
  for (const d of DISPOSITIONS) {
    assert.ok(d.label && d.description && d.action, `${d.value} falta metadata`)
    assert.ok(d.color?.text && d.color?.dot, `${d.value} falta color`)
    assert.equal(typeof d.routes, 'boolean')
  }
})

test('el default es fc_track', () => {
  assert.equal(DEFAULT_DISPOSITION, 'fc_track')
})

// ── getDisposition / labels ──
test('getDisposition devuelve el registro correcto', () => {
  assert.equal(getDisposition('tu_marca_vende').label, 'Tu Marca Vende')
  assert.equal(dispositionLabel('otro_rol'), 'Otro rol comercial')
})

test('getDisposition cae a fc_track con valor desconocido/null', () => {
  assert.equal(getDisposition('inexistente').value, 'fc_track')
  assert.equal(getDisposition(null).value, 'fc_track')
})

test('otro_rol y otro_producto rutean (routes=true), el resto no', () => {
  assert.equal(getDisposition('otro_rol').routes, true)
  assert.equal(getDisposition('otro_producto').routes, true)
  assert.equal(getDisposition('tu_marca_vende').routes, false)
  assert.equal(getDisposition('fc_track').routes, false)
})

// ── suggestDisposition ──
test('perfil de seguros/extranjero → descartado', () => {
  const s = suggestDisposition({ current_title: 'Agente de seguros GNP', location: 'Miami (extranjero)' })
  assert.equal(s.value, 'descartado')
  assert.ok(s.reason)
})

test('menciona mejorar CV/marca → tu_marca_vende', () => {
  const s = suggestDisposition({ notes: 'Quiere mejorar su CV y marca personal', current_title: 'Diseñador' })
  assert.equal(s.value, 'tu_marca_vende')
})

test('open to work → tu_marca_vende', () => {
  const s = suggestDisposition({ tags: ['open to work'], current_title: 'Community manager' })
  assert.equal(s.value, 'tu_marca_vende')
})

test('comercial fuerte sin finanzas → otro_rol', () => {
  const s = suggestDisposition({ current_title: 'Ejecutivo de ventas', current_company: 'Coca-Cola' })
  assert.equal(s.value, 'otro_rol')
})

test('comercial CON finanzas NO va a otro_rol (sigue en FC)', () => {
  const s = suggestDisposition({ current_title: 'Asesor comercial de inversiones', match_score: 72 })
  assert.notEqual(s.value, 'otro_rol')
  assert.equal(s.value, 'fc_track')
})

test('match bajo con experiencia → nurture', () => {
  const s = suggestDisposition({ current_title: 'Contador', match_score: 40, years_experience: 5 })
  assert.equal(s.value, 'nurture')
})

test('match saludable → fc_track', () => {
  const s = suggestDisposition({ current_title: 'Analista', match_score: 78 })
  assert.equal(s.value, 'fc_track')
})

test('objeto vacío → fc_track con razón neutra (nunca null)', () => {
  const s = suggestDisposition({})
  assert.equal(s.value, 'fc_track')
  assert.ok(s.reason && typeof s.reason === 'string')
})

test('suggestDisposition sin argumentos no revienta', () => {
  const s = suggestDisposition()
  assert.equal(s.value, 'fc_track')
})

// ── summarizeDispositions ──
test('cuenta por disposición y trata null como fc_track', () => {
  const cands = [
    { disposition: 'fc_track' },
    { disposition: 'tu_marca_vende' },
    { disposition: 'tu_marca_vende' },
    { disposition: 'otro_rol' },
    { disposition: 'descartado' },
    { disposition: null },       // → fc_track
    {},                          // → fc_track
  ]
  const s = summarizeDispositions(cands)
  assert.equal(s.total, 7)
  assert.equal(s.counts.fc_track, 3)         // 1 explícito + 2 null/undefined
  assert.equal(s.counts.tu_marca_vende, 2)
  assert.equal(s.counts.otro_rol, 1)
  assert.equal(s.counts.descartado, 1)
  // recuperados = tmv(2) + otro_rol(1) + otro_producto(0) + nurture(0) = 3
  assert.equal(s.recovered, 3)
  // monetizable = tmv(2) + otro_producto(0)
  assert.equal(s.monetizable, 2)
  // nonFc = total(7) - fc_track(3) = 4
  assert.equal(s.nonFc, 4)
  // recoveryRate = 3/4
  assert.ok(Math.abs(s.recoveryRate - 0.75) < 1e-9)
})

test('summarize con lista vacía no divide por cero', () => {
  const s = summarizeDispositions([])
  assert.equal(s.total, 0)
  assert.equal(s.recoveryRate, 0)
  assert.ok(Number.isFinite(s.recoveryRate))
})

test('disposición desconocida en datos no truena y cuenta como no-fc implícito', () => {
  const s = summarizeDispositions([{ disposition: 'valor_viejo' }])
  // valor desconocido → tratado como unset → fc_track
  assert.equal(s.counts.fc_track, 1)
  assert.equal(s.total, 1)
})

console.log(`\n${passed} tests pasaron`)
