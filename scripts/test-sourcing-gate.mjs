#!/usr/bin/env node
// Tests del GATE DE CALIDAD del sourcing (src/lib/sourcingScore.js) — casos
// REALES de la auditoría 2026-09-07 sobre los 51 auto-sourced del banco.
// Sin framework (el repo no tiene Vitest): node scripts/test-sourcing-gate.mjs
import assert from 'node:assert/strict'
import {
  hasMexicoSignal,
  nameLooksLikeRole,
  isForeignProfile,
  detectForeignLocation,
  checkRoleFit,
  normalizeLinkedInUrl,
} from '../src/lib/sourcingScore.js'

let passed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`) }
  catch (e) { console.error(`FAIL  ${name}\n${e.stack || e}`); process.exitCode = 1 }
}

// ── nameLooksLikeRole: caza perfiles NO humanos que se saltan looksLikeHumanName ──
test('nameLooksLikeRole: "Trade Finance Consultant" es rol, no persona', () => {
  assert.equal(nameLooksLikeRole('Trade Finance Consultant'), true)
})

test('nameLooksLikeRole: "Contfie Control Financiero Y" es giro de negocio', () => {
  assert.equal(nameLooksLikeRole('Contfie Control Financiero Y'), true)
})

test('nameLooksLikeRole: "Fundar Centro de Análisis e Investigación" es organización', () => {
  assert.equal(nameLooksLikeRole('Fundar Centro de Análisis e Investigación'), true)
})

test('nameLooksLikeRole: nombres humanos reales NO se marcan', () => {
  for (const n of [
    'Jose Maria Alcantara',       // score 70 en la auditoría — mexicano bueno
    'Luisa Fernanda Murillo',     // score 68
    'Abraham Arcos Cordera',      // score 64
    'Erika García',
    'Hafizza Maricar',            // extranjera, pero su NOMBRE sí es humano
    'Guy Cumbie',
  ]) assert.equal(nameLooksLikeRole(n), false, `"${n}" marcado como rol`)
})

test('nameLooksLikeRole: word boundary — "Financiera" cuenta, "Villafinanz" no truena', () => {
  assert.equal(nameLooksLikeRole('Sofia Financiera Lopez'), true)
  assert.equal(nameLooksLikeRole(''), false)
  assert.equal(nameLooksLikeRole(null), false)
})

// ── hasMexicoSignal: señal POSITIVA de México ──────────────────────────────
test('hasMexicoSignal: "Ciudad de México" en el snippet → true', () => {
  assert.equal(hasMexicoSignal(
    'https://www.linkedin.com/in/erika-garcia',
    'Erika García - Asesora Financiera', 'Location: Ciudad de México · 500+ contactos'
  ), true)
})

test('hasMexicoSignal: subdominio mx.linkedin.com → true aunque el texto no diga nada', () => {
  assert.equal(hasMexicoSignal('https://mx.linkedin.com/in/alguien', 'Consultor', 'sin ubicación'), true)
})

test('hasMexicoSignal: Hafizza Maricar (finexis, Singapur) → sin señal MX', () => {
  assert.equal(hasMexicoSignal(
    'https://www.linkedin.com/in/hafizza-maricar',
    'Hafizza Maricar - Financial Consultant - finexis advisory Pte Ltd', 'Singapore'
  ), false)
})

test('hasMexicoSignal: Jose Maria Alcantara sin ubicación en snippet → false (cuarentena, NO basura)', () => {
  assert.equal(hasMexicoSignal(
    'https://www.linkedin.com/in/jose-maria-alcantara',
    'Jose Maria Alcantara - Consultor Financiero', 'Asesoría en inversiones y planeación patrimonial'
  ), false)
})

test('hasMexicoSignal: word boundary — "mexicano" cuenta, "new mexico"… no aplica falso por substring', () => {
  assert.equal(hasMexicoSignal('', 'Asesor financiero mexicano'), true)
  assert.equal(hasMexicoSignal('', 'Monterrey, Nuevo León'), true)
  assert.equal(hasMexicoSignal('', ''), false)
  assert.equal(hasMexicoSignal(null), false)
})

// ── isForeignProfile: doble candado del gate ───────────────────────────────
test('isForeignProfile: señal de Singapur → true', () => {
  assert.equal(isForeignProfile(
    'https://www.linkedin.com/in/hafizza-maricar',
    'Hafizza Maricar - Financial Consultant', 'finexis advisory Pte Ltd', 'Singapore'
  ), true)
})

test('isForeignProfile: mexicano con experiencia regional NO se descarta', () => {
  // Menciona Perú pero también México → detectForeignLocation lo perdona.
  assert.equal(detectForeignLocation('Responsable de México y Perú, basado en CDMX'), null)
  assert.equal(isForeignProfile('https://www.linkedin.com/in/x', 'Director regional', 'Responsable de México y Perú'), false)
})

// ── checkRoleFit: especializado vs comercial (barrido QA tester sep-2026) ──
// El criterio de descarte MÁS frecuente (13 de ~38): la vacante es COMERCIAL
// pero el sourcing traía Analistas, Backoffice, Contabilidad, PLD, auditoría.
test('checkRoleFit: "Analista de Crédito" → specialized (caso real de la tester)', () => {
  assert.equal(checkRoleFit('Analista de Crédito', '').verdict, 'specialized')
})

test('checkRoleFit: títulos especializados reales del barrido → specialized', () => {
  for (const t of [
    'Backoffice',
    'Contabilidad y Análisis — Analista contable',
    'Especialista en Prevención de Lavado de Dinero (PLD)',
    'Auditor Interno',
    'Analista de Riesgos',
    'Accountant',
    'Compliance Officer',
  ]) assert.equal(checkRoleFit(t, '').verdict, 'specialized', `"${t}" no dio specialized`)
})

test('checkRoleFit: "Ejecutivo Comercial" → commercial', () => {
  assert.equal(checkRoleFit('Ejecutivo Comercial', '').verdict, 'commercial')
})

test('checkRoleFit: "Ejecutivo Comercial con experiencia en análisis" NO se descarta', () => {
  // Señal comercial en el título gana: el análisis es un plus, no el rol.
  const fit = checkRoleFit('Ejecutivo Comercial con experiencia en análisis de riesgos', '')
  assert.equal(fit.verdict, 'commercial')
})

test('checkRoleFit: título comercial + snippet de análisis → NO specialized', () => {
  // "Consultor con experiencia en análisis financiero": el snippet menciona
  // análisis pero el título NO es de rol especializado → no se descarta.
  const fit = checkRoleFit('Consultor', 'Consultor con experiencia en análisis financiero y planeación')
  assert.notEqual(fit.verdict, 'specialized')
})

test('checkRoleFit: señal especializada SOLO en snippet → neutral + snippetSignal (penaliza, no descarta)', () => {
  const fit = checkRoleFit('Consultor independiente', 'Fue analista de riesgos en banca')
  assert.equal(fit.verdict, 'neutral')
  assert.equal(fit.snippetSignal, 'analista')
})

test('checkRoleFit: título neutro sin señales → neutral', () => {
  const fit = checkRoleFit('Consultor Financiero', 'Planeación patrimonial')
  assert.equal(fit.verdict, 'neutral')
  assert.equal(fit.snippetSignal, null)
})

// ── normalizeLinkedInUrl: dedupe canónico (la tester descartó al mismo perfil ~3 veces) ──
test('normalizeLinkedInUrl: variantes http/https/www/mx/slash → misma clave', () => {
  const key = normalizeLinkedInUrl('https://www.linkedin.com/in/juan-perez')
  assert.equal(normalizeLinkedInUrl('http://linkedin.com/in/juan-perez'), key)
  assert.equal(normalizeLinkedInUrl('https://www.linkedin.com/in/juan-perez/'), key)
  assert.equal(normalizeLinkedInUrl('https://mx.linkedin.com/in/juan-perez'), key)
  assert.equal(normalizeLinkedInUrl('https://www.linkedin.com/in/juan-perez?trk=serp'), key)
  assert.equal(key, 'linkedin.com/in/juan-perez')
})

test('normalizeLinkedInUrl: %C3%A1 y á → misma clave', () => {
  assert.equal(
    normalizeLinkedInUrl('https://www.linkedin.com/in/mar%C3%ADa-garc%C3%ADa'),
    normalizeLinkedInUrl('https://mx.linkedin.com/in/maría-garcía/')
  )
})

test('normalizeLinkedInUrl: idempotente y tolerante', () => {
  const once = normalizeLinkedInUrl('HTTPS://WWW.LinkedIn.com/in/Jose-Lopez/')
  assert.equal(normalizeLinkedInUrl(once), once)
  assert.equal(normalizeLinkedInUrl(''), '')
  assert.equal(normalizeLinkedInUrl(null), '')
  // Un %-suelto inválido no truena
  assert.equal(typeof normalizeLinkedInUrl('https://linkedin.com/in/x%zz'), 'string')
})

// ── Semántica del gate completo (mismo orden que cron-auto-source) ─────────
function gate(r) {
  if (nameLooksLikeRole(r.full_name || r.title || '')) return 'garbage'
  if (isForeignProfile(r.url, r.title, r.current_title, r.current_company, r.snippet)) return 'foreign'
  if (checkRoleFit(r.current_title || r.title || '', r.snippet || '').verdict === 'specialized') return 'specialized'
  if (hasMexicoSignal(r.url, r.title, r.current_title, r.current_company, r.snippet)) return 'mx'
  return 'unknown'
}

test('gate: perfil especializado NO se inserta (criterio #1 de la QA tester)', () => {
  assert.equal(gate({
    full_name: 'Laura Jimenez', url: 'https://www.linkedin.com/in/laura',
    current_title: 'Analista de Crédito', snippet: 'Ciudad de México · 500+ contactos',
  }), 'specialized')
  // Comercial con análisis en el snippet pasa normal
  assert.equal(gate({
    full_name: 'Pedro Ruiz', url: 'https://www.linkedin.com/in/pedro',
    current_title: 'Ejecutivo Comercial', snippet: 'Experiencia en análisis financiero · CDMX',
  }), 'mx')
})

test('gate: los 4 destinos con casos reales de la auditoría', () => {
  assert.equal(gate({ full_name: 'Trade Finance Consultant', url: 'https://www.linkedin.com/in/tfc' }), 'garbage')
  assert.equal(gate({
    full_name: 'Hafizza Maricar', url: 'https://www.linkedin.com/in/hafizza',
    title: 'Hafizza Maricar - Financial Consultant - finexis advisory Pte Ltd (Singapore)',
    snippet: 'Financial consultant based in Singapore',
  }), 'foreign')
  assert.equal(gate({
    full_name: 'Erika García', url: 'https://www.linkedin.com/in/erika',
    title: 'Erika García - Asesora Financiera', snippet: 'Ciudad de México · 500+ contactos',
  }), 'mx')
  assert.equal(gate({
    full_name: 'Jose Maria Alcantara', url: 'https://www.linkedin.com/in/jose',
    title: 'Jose Maria Alcantara - Consultor Financiero', snippet: 'Planeación patrimonial e inversiones',
  }), 'unknown') // → cuarentena geo_desconocida, NO basura: verificación lo rescata
})

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ' (con fallas)' : ''}`)
