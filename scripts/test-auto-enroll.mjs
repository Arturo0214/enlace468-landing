#!/usr/bin/env node
// Tests del círculo completo de outreach automático:
//   - auto-promoción con umbral (cron-auto-source.mjs → autoPromote)
//     · respeta cuarentena (verify_status) — jamás promueve no-visibles
//     · auto-inscripción SOLO con exactamente 1 secuencia activa de la vacante
//     · 0 o 2 secuencias → no inscribe; duplicado → no re-inscribe ni truena
//   - cosecha de contacto (cron-activity-sync.mjs)
//     · extractContactInfo tolera variantes del shape de Unipile
//     · applyContactHarvest NUNCA pisa email/phone existentes
//
// Sin framework (el repo no tiene Vitest): node scripts/test-auto-enroll.mjs
// TODO con stub in-memory de Supabase — jamás toca la red, ni Unipile, ni la
// BD real.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { autoPromote } from '../netlify/functions/cron-auto-source.mjs'
import { extractContactInfo, applyContactHarvest } from '../netlify/functions/cron-activity-sync.mjs'

let passed = 0
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  ok  ${name}`) })
    .catch(e => { console.error(`FAIL  ${name}\n${e.stack || e}`); process.exitCode = 1 })
}

// ============================================================
// Stub in-memory de Supabase (mismo patrón que test-sequence-runner.mjs)
// + opts.uniques: { tabla: [[col, col], …] } simula índices únicos
//   parciales devolviendo error 23505 (como Postgres) en conflicto.
// ============================================================
function createStubSupabase(store, opts = {}) {
  const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)))

  function matches(row, filters) {
    return filters.every(f => {
      const v = row[f.col]
      switch (f.op) {
        case 'eq': return v === f.val
        case 'neq': return v !== f.val
        case 'not_is_null': return v != null
        case 'is_null': return v == null
        default: throw new Error(`op no soportado: ${f.op}`)
      }
    })
  }

  function from(table) {
    const st = { table, action: 'select', filters: [], limit: null, single: false, maybe: false, payload: null, returning: false }
    const api = {}
    const filter = op => (col, val) => { st.filters.push({ op, col, val }); return api }
    api.select = () => { if (st.action !== 'select') st.returning = true; return api }
    api.insert = rows => { st.action = 'insert'; st.payload = rows; return api }
    api.update = patch => { st.action = 'update'; st.payload = patch; return api }
    api.eq = filter('eq'); api.neq = filter('neq')
    api.is = (col, val) => { st.filters.push({ op: val === null ? 'is_null' : 'eq', col, val }); return api }
    api.not = (col, op, val) => { st.filters.push({ op: op === 'is' && val === null ? 'not_is_null' : 'neq', col, val }); return api }
    api.limit = n => { st.limit = n; return api }
    api.maybeSingle = () => { st.maybe = true; return api }
    api.single = () => { st.single = true; return api }

    function exec() {
      const rows = store[st.table] || (store[st.table] = [])
      const matched = rows.filter(r => matches(r, st.filters))
      if (st.action === 'select') {
        const out = st.limit != null ? matched.slice(0, st.limit) : matched
        if (st.single || st.maybe) {
          if (st.single && out.length === 0) return { data: null, error: { message: 'no rows' } }
          return { data: clone(out[0] ?? null), error: null }
        }
        return { data: clone(out), error: null }
      }
      if (st.action === 'update') {
        matched.forEach(r => Object.assign(r, clone(st.payload)))
        return { data: st.returning ? clone(matched) : null, error: null }
      }
      // insert
      const list = Array.isArray(st.payload) ? st.payload : [st.payload]
      const uniques = (opts.uniques || {})[st.table] || []
      const inserted = []
      for (const raw of list) {
        const row = { id: randomUUID(), ...clone(raw) }
        for (const cols of uniques) {
          if (cols.every(c => row[c] != null) && rows.some(r => cols.every(c => r[c] === row[c]))) {
            return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint (${cols.join(',')})` } }
          }
        }
        rows.push(row); inserted.push(row)
      }
      const data = st.returning || st.single ? (st.single ? clone(inserted[0] ?? null) : clone(inserted)) : null
      return { data, error: null }
    }

    api.then = (res, rej) => Promise.resolve().then(exec).then(res, rej)
    return api
  }

  return { from }
}

// ============================================================
// Fixtures — auto-promoción / auto-inscripción
// ============================================================
const UNIQUES = { sequence_enrollments: [['sequence_id', 'sourcing_bank_id']] }

function makeVacancy(threshold = 70) {
  return { id: 'V1', organization_id: 'O1', title: 'Gerente RAP', auto_promote_min_score: threshold }
}

function makeWorld({ sequences = 1 } = {}) {
  const seqs = []
  for (let i = 1; i <= sequences; i++) {
    seqs.push({ id: `S${i}`, organization_id: 'O1', vacancy_id: 'V1', name: `Secuencia ${i}`, is_active: true })
  }
  // + una inactiva y una de otra vacante: NO deben contar
  seqs.push({ id: 'S-off', organization_id: 'O1', vacancy_id: 'V1', name: 'Apagada', is_active: false })
  seqs.push({ id: 'S-other', organization_id: 'O1', vacancy_id: 'V2', name: 'Otra vacante', is_active: true })
  return {
    outreach_sequences: seqs,
    sourcing_bank: [
      { id: 'B1', organization_id: 'O1', vacancy_id: 'V1', url: 'https://www.linkedin.com/in/analopez', full_name: 'Ana López', current_title: 'Asesora Sr', current_company: 'X', snippet: 'ventas', score: 80, score_details: null, candidate_id: null, verify_status: null, email: null, phone: null },
      { id: 'B2', organization_id: 'O1', vacancy_id: 'V1', url: 'https://www.linkedin.com/in/juanperez', full_name: 'Juan Pérez', current_title: 'Gerente', current_company: 'Y', snippet: 'cartera', score: 85, score_details: null, candidate_id: null, verify_status: 'geo_desconocida', email: null, phone: null },
      { id: 'B3', organization_id: 'O1', vacancy_id: 'V1', url: 'https://www.linkedin.com/in/luismid', full_name: 'Luis Mid', current_title: 'Ejecutivo', current_company: 'Z', snippet: 'ventas', score: 50, score_details: null, candidate_id: null, verify_status: null, email: null, phone: null },
    ],
    candidates: [],
    vacancy_candidates: [],
    sequence_enrollments: [],
  }
}

const INSERTED = [
  { id: 'B1', url: 'https://www.linkedin.com/in/analopez', score: 80 },
  { id: 'B2', url: 'https://www.linkedin.com/in/juanperez', score: 85 },
  { id: 'B3', url: 'https://www.linkedin.com/in/luismid', score: 50 },
]

// ============================================================
// Tests — auto-promoción
// ============================================================
await test('auto-promoción: umbral respeta cuarentena (geo_desconocida NO se promueve)', async () => {
  const world = makeWorld()
  const sb = createStubSupabase(world, { uniques: UNIQUES })
  const counts = await autoPromote(sb, makeVacancy(70), INSERTED)
  // B1 (80, visible) sí; B2 (85, cuarentena) NO; B3 (50, bajo umbral) NO
  assert.equal(counts.promoted, 1)
  assert.equal(world.candidates.length, 1)
  assert.equal(world.candidates[0].full_name, 'Ana López')
  assert.equal(world.candidates[0].source, 'auto-sourced')
  assert.equal(world.vacancy_candidates.length, 1)
  assert.equal(world.vacancy_candidates[0].stage, 'sourced')
  const b1 = world.sourcing_bank.find(b => b.id === 'B1')
  assert.equal(b1.candidate_id, world.candidates[0].id)
  assert.equal(world.sourcing_bank.find(b => b.id === 'B2').candidate_id, null)
})

await test('auto-promoción: auto_promote_min_score null = apagado (no promueve nada)', async () => {
  const world = makeWorld()
  const sb = createStubSupabase(world, { uniques: UNIQUES })
  const counts = await autoPromote(sb, makeVacancy(null), INSERTED)
  assert.deepEqual(counts, { promoted: 0, enrolled: 0 })
  assert.equal(world.candidates.length, 0)
})

await test('auto-enroll: con EXACTAMENTE 1 secuencia activa inscribe al promovido', async () => {
  const world = makeWorld({ sequences: 1 })
  const sb = createStubSupabase(world, { uniques: UNIQUES })
  const counts = await autoPromote(sb, makeVacancy(70), INSERTED)
  assert.equal(counts.promoted, 1)
  assert.equal(counts.enrolled, 1)
  assert.equal(world.sequence_enrollments.length, 1)
  const e = world.sequence_enrollments[0]
  assert.equal(e.organization_id, 'O1')
  assert.equal(e.sequence_id, 'S1')
  assert.equal(e.sourcing_bank_id, 'B1')
  assert.equal(e.vacancy_candidate_id, world.vacancy_candidates[0].id)
  assert.equal(e.status, 'active')
  assert.equal(e.current_step, 0)
  assert.ok(e.next_run_at, 'next_run_at = ahora → el runner lo toma en el próximo tick')
  assert.equal(e.enrolled_by, null) // inscrito por el robot
})

await test('auto-enroll: 0 secuencias activas → promueve pero NO inscribe', async () => {
  const world = makeWorld({ sequences: 0 })
  const sb = createStubSupabase(world, { uniques: UNIQUES })
  const counts = await autoPromote(sb, makeVacancy(70), INSERTED)
  assert.equal(counts.promoted, 1)
  assert.equal(counts.enrolled, 0)
  assert.equal(world.sequence_enrollments.length, 0)
})

await test('auto-enroll: 2 secuencias activas (ambiguo) → promueve pero NO inscribe', async () => {
  const world = makeWorld({ sequences: 2 })
  const sb = createStubSupabase(world, { uniques: UNIQUES })
  const counts = await autoPromote(sb, makeVacancy(70), INSERTED)
  assert.equal(counts.promoted, 1)
  assert.equal(counts.enrolled, 0)
  assert.equal(world.sequence_enrollments.length, 0)
})

await test('auto-enroll: ya inscrito antes (unique 23505) → no re-inscribe ni truena', async () => {
  const world = makeWorld({ sequences: 1 })
  world.sequence_enrollments.push({
    id: 'E-old', organization_id: 'O1', sequence_id: 'S1', sourcing_bank_id: 'B1',
    vacancy_candidate_id: null, status: 'completed', current_step: 3, next_run_at: null,
  })
  const sb = createStubSupabase(world, { uniques: UNIQUES })
  const counts = await autoPromote(sb, makeVacancy(70), INSERTED)
  assert.equal(counts.promoted, 1) // la promoción sí procede
  assert.equal(counts.enrolled, 0) // pero anti-spam: no se re-inscribe
  assert.equal(world.sequence_enrollments.length, 1)
  assert.equal(world.sequence_enrollments[0].id, 'E-old')
})

// ============================================================
// Tests — cosecha de contacto (Unipile)
// ============================================================
await test('extractContactInfo tolera variantes del shape de Unipile', () => {
  assert.deepEqual(
    extractContactInfo({ contact_info: { emails: ['a@b.com'], phones: ['555 123'] } }),
    { email: 'a@b.com', phone: '555 123' }
  )
  assert.deepEqual(
    extractContactInfo({ contact_info: { emails: [{ email: 'x@y.com' }], phone_numbers: [{ number: '+52 55 1234' }] } }),
    { email: 'x@y.com', phone: '+52 55 1234' }
  )
  assert.deepEqual(
    extractContactInfo({ email: 'top@z.com', phone_numbers: ['+52 81 0000'] }),
    { email: 'top@z.com', phone: '+52 81 0000' }
  )
  assert.deepEqual(
    extractContactInfo({ contact_info: { emails: [{ address: 'addr@w.com' }] } }),
    { email: 'addr@w.com', phone: null }
  )
  // sin contacto / shapes raros → nulls, sin tronar
  assert.deepEqual(extractContactInfo({ provider: 'LINKEDIN', name: 'Ana' }), { email: null, phone: null })
  assert.deepEqual(extractContactInfo(null), { email: null, phone: null })
  assert.deepEqual(extractContactInfo({ contact_info: 'weird' }), { email: null, phone: null })
  assert.deepEqual(extractContactInfo({ contact_info: { emails: ['no-arroba'] } }), { email: null, phone: null })
})

await test('applyContactHarvest llena vacíos en banco y candidato', async () => {
  const world = {
    sourcing_bank: [{ id: 'B1', candidate_id: 'C1', email: null, phone: null }],
    candidates: [{ id: 'C1', email: null, phone: null }],
  }
  const sb = createStubSupabase(world)
  await applyContactHarvest(sb, world.sourcing_bank[0], { email: 'nuevo@x.com', phone: '555' })
  assert.equal(world.sourcing_bank[0].email, 'nuevo@x.com')
  assert.equal(world.sourcing_bank[0].phone, '555')
  assert.equal(world.candidates[0].email, 'nuevo@x.com')
  assert.equal(world.candidates[0].phone, '555')
})

await test('applyContactHarvest NO pisa email/phone existentes', async () => {
  const world = {
    sourcing_bank: [{ id: 'B1', candidate_id: 'C1', email: 'viejo@banco.com', phone: null }],
    candidates: [{ id: 'C1', email: null, phone: '999' }],
  }
  const sb = createStubSupabase(world)
  await applyContactHarvest(sb, world.sourcing_bank[0], { email: 'nuevo@x.com', phone: '555' })
  // banco: email existente intacto; phone vacío sí se llena
  assert.equal(world.sourcing_bank[0].email, 'viejo@banco.com')
  assert.equal(world.sourcing_bank[0].phone, '555')
  // candidato: phone existente intacto; email vacío sí se llena
  assert.equal(world.candidates[0].email, 'nuevo@x.com')
  assert.equal(world.candidates[0].phone, '999')
})

await test('applyContactHarvest sin candidate_id solo toca el banco', async () => {
  const world = {
    sourcing_bank: [{ id: 'B1', candidate_id: null, email: null, phone: null }],
    candidates: [{ id: 'C1', email: null, phone: null }],
  }
  const sb = createStubSupabase(world)
  await applyContactHarvest(sb, world.sourcing_bank[0], { email: 'solo@banco.com', phone: null })
  assert.equal(world.sourcing_bank[0].email, 'solo@banco.com')
  assert.equal(world.candidates[0].email, null)
})

console.log(`\n${passed} pruebas OK${process.exitCode ? ' · CON FALLAS' : ''}`)
