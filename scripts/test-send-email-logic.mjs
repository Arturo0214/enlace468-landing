#!/usr/bin/env node
// Tests de la lógica pura de los emails de Fase 7:
//   - send-email.mjs: personalize({{nombre}}), buildBrandedHtml, esc
//   - cron-interview-reminders.mjs: ventana 20-28h, formatCdmx
// Sin framework (el repo no tiene Vitest): node scripts/test-send-email-logic.mjs
// Jamás toca red, ni Resend, ni la BD real.
import assert from 'node:assert/strict'
import { personalize, buildBrandedHtml, esc, EMAIL_TYPES } from '../netlify/functions/send-email.mjs'
import {
  inReminderWindow,
  formatCdmx,
  WINDOW_MIN_H,
  WINDOW_MAX_H,
} from '../netlify/functions/cron-interview-reminders.mjs'

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

// ── personalize ──
test('personalize usa el primer nombre', () => {
  assert.equal(personalize('Hola {{nombre}},', 'María Fernanda López'), 'Hola María,')
})
test('personalize reemplaza TODAS las ocurrencias', () => {
  assert.equal(personalize('{{nombre}} y {{nombre}}', 'Ana Ruiz'), 'Ana y Ana')
})
test('personalize tolera espacios dentro de las llaves', () => {
  assert.equal(personalize('Hola {{ nombre }}', 'Luis Pérez'), 'Hola Luis')
})
test('personalize sin nombre → fallback candidato/a', () => {
  assert.equal(personalize('Hola {{nombre}}', ''), 'Hola candidato/a')
  assert.equal(personalize('Hola {{nombre}}', null), 'Hola candidato/a')
  assert.equal(personalize('Hola {{nombre}}', '   '), 'Hola candidato/a')
})
test('personalize sin placeholder deja el texto igual', () => {
  assert.equal(personalize('Sin placeholder', 'Ana'), 'Sin placeholder')
})
test('personalize tolera template null', () => {
  assert.equal(personalize(null, 'Ana'), '')
})

// ── esc / buildBrandedHtml ──
test('esc escapa HTML', () => {
  assert.equal(esc('<b>"x" & y</b>'), '&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;')
})
test('buildBrandedHtml lleva la marca navy/turquesa y el texto', () => {
  const html = buildBrandedHtml({ kicker: 'Proceso de selección', title: 'Gracias', bodyText: 'Hola Ana,\n\nGracias por participar.' })
  assert.ok(html.includes('#071B49'), 'falta navy')
  assert.ok(html.includes('#00A99D'), 'falta turquesa')
  assert.ok(html.includes('Hola Ana,'), 'falta el cuerpo')
  assert.ok(html.includes('Gracias por participar.'), 'falta el segundo párrafo')
  // Doble salto de línea → párrafos separados
  assert.ok((html.match(/<p style="margin:0 0 14px/g) || []).length >= 2, 'no separó párrafos')
})
test('buildBrandedHtml escapa HTML malicioso del cuerpo', () => {
  const html = buildBrandedHtml({ kicker: 'x', title: '<script>', bodyText: '<img src=x onerror=alert(1)>' })
  assert.ok(!html.includes('<script>'), 'no escapó el title')
  assert.ok(!html.includes('<img'), 'no escapó el body')
})
test('EMAIL_TYPES incluye rejection_thanks', () => {
  assert.ok(EMAIL_TYPES.rejection_thanks)
})

// ── ventana de recordatorio 20-28h ──
const NOW = Date.parse('2026-09-07T15:00:00Z')
const hoursAhead = h => new Date(NOW + h * 3600000).toISOString()

test(`constantes de ventana: ${WINDOW_MIN_H}-${WINDOW_MAX_H}h`, () => {
  assert.equal(WINDOW_MIN_H, 20)
  assert.equal(WINDOW_MAX_H, 28)
})
test('24h en el futuro → dentro de la ventana', () => {
  assert.equal(inReminderWindow(hoursAhead(24), NOW), true)
})
test('bordes exactos 20h y 28h → dentro', () => {
  assert.equal(inReminderWindow(hoursAhead(20), NOW), true)
  assert.equal(inReminderWindow(hoursAhead(28), NOW), true)
})
test('19h59m → fuera (aún no es "mañana")', () => {
  assert.equal(inReminderWindow(new Date(NOW + (20 * 3600000 - 60000)).toISOString(), NOW), false)
})
test('28h01m → fuera (demasiado lejos)', () => {
  assert.equal(inReminderWindow(new Date(NOW + (28 * 3600000 + 60000)).toISOString(), NOW), false)
})
test('entrevista en el pasado → fuera', () => {
  assert.equal(inReminderWindow(hoursAhead(-2), NOW), false)
})
test('fecha inválida → fuera (nunca truena)', () => {
  assert.equal(inReminderWindow('no-es-fecha', NOW), false)
  assert.equal(inReminderWindow(null, NOW), false)
})
test('ancho de ventana (8h) > cadencia del cron (1h) → ninguna entrevista se escapa', () => {
  assert.ok(WINDOW_MAX_H - WINDOW_MIN_H > 1)
})

// ── formatCdmx ──
test('formatCdmx convierte UTC → CDMX (UTC-6)', () => {
  // 2026-09-08T16:30:00Z = 10:30am CDMX
  const s = formatCdmx('2026-09-08T16:30:00Z')
  assert.ok(/10:30/.test(s), `esperaba 10:30 CDMX en "${s}"`)
  assert.ok(/septiembre/i.test(s), `esperaba el mes en español en "${s}"`)
})
test('formatCdmx no truena con fecha inválida', () => {
  assert.equal(typeof formatCdmx('garbage'), 'string')
})

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ' (con fallas)' : ''}`)
