#!/usr/bin/env node
// Tests del motor de secuencias (netlify/functions/cron-sequence-runner.mjs).
// Sin framework (el repo no tiene Vitest): node scripts/test-sequence-runner.mjs
//
// TODO se prueba con un stub in-memory de Supabase y en DRY-RUN — jamás toca
// la red, ni Unipile, ni Resend, ni la BD real.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  advanceEnrollments,
  dispatchOutbox,
  renderTemplate,
  conditionMet,
  isDryRun,
  JITTER_MAX_MS,
} from '../netlify/functions/cron-sequence-runner.mjs'
import { getLinkedInQuota, LINKEDIN_DAILY_LIMIT } from '../netlify/functions/lib/quotas.mjs'

let passed = 0
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  ok  ${name}`) })
    .catch(e => { console.error(`FAIL  ${name}\n${e.stack || e}`); process.exitCode = 1 })
}

// ============================================================
// Stub in-memory de Supabase: soporta el subconjunto de PostgREST
// que usa el runner (select/insert/update/upsert/delete + eq, lte,
// gte, like, not-is-null, order, limit, range, single, count/head).
// ============================================================
function createStubSupabase(store, opts = {}) {
  const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)))

  function matches(row, filters) {
    return filters.every(f => {
      const v = row[f.col]
      switch (f.op) {
        case 'eq': return v === f.val
        case 'neq': return v !== f.val
        case 'lte': return v != null && v <= f.val
        case 'gte': return v != null && v >= f.val
        case 'like': {
          const re = new RegExp('^' + String(f.val).replace(/[.*+?^${}()|[\]\\]/g, m => '\\' + m).replace(/%/g, '.*') + '$')
          return typeof v === 'string' && re.test(v)
        }
        case 'not_is_null': return v != null
        case 'is_null': return v == null
        default: throw new Error(`op no soportado: ${f.op}`)
      }
    })
  }

  function from(table) {
    const st = { table, action: 'select', filters: [], order: null, limit: null, range: null, single: false, maybe: false, head: false, count: null, payload: null, upsertOpts: null, returning: false }
    const api = {}
    const filter = op => (col, val) => { st.filters.push({ op, col, val }); return api }
    api.select = (cols, o) => {
      if (st.action === 'select') { st.count = o?.count || null; st.head = !!o?.head } else { st.returning = true }
      return api
    }
    api.insert = rows => { st.action = 'insert'; st.payload = rows; return api }
    api.update = patch => { st.action = 'update'; st.payload = patch; return api }
    api.upsert = (rows, o) => { st.action = 'upsert'; st.payload = rows; st.upsertOpts = o; return api }
    api.delete = () => { st.action = 'delete'; return api }
    api.eq = filter('eq'); api.neq = filter('neq'); api.lte = filter('lte'); api.gte = filter('gte'); api.like = filter('like')
    api.not = (col, op, val) => { st.filters.push({ op: op === 'is' && val === null ? 'not_is_null' : 'neq', col, val }); return api }
    api.is = (col, val) => { st.filters.push({ op: val === null ? 'is_null' : 'eq', col, val }); return api }
    api.order = (col, o) => { st.order = { col, asc: o?.ascending !== false }; return api }
    api.limit = n => { st.limit = n; return api }
    api.range = (a, b) => { st.range = [a, b]; return api }
    api.maybeSingle = () => { st.maybe = true; return api }
    api.single = () => { st.single = true; return api }

    function exec() {
      const rows = store[st.table] || (store[st.table] = [])
      let matched = rows.filter(r => matches(r, st.filters))
      if (st.action === 'select') {
        if (st.order) {
          const { col, asc } = st.order
          matched = [...matched].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1))
        }
        if (st.range) matched = matched.slice(st.range[0], st.range[1] + 1)
        else if (st.limit != null) matched = matched.slice(0, st.limit)
        if (st.head) return { data: null, error: null, count: matched.length }
        if (st.single || st.maybe) {
          if (st.single && matched.length === 0) return { data: null, error: { message: 'no rows' } }
          return { data: clone(matched[0] ?? null), error: null }
        }
        return { data: clone(matched), error: null, count: st.count ? matched.length : null }
      }
      if (st.action === 'update') {
        matched.forEach(r => Object.assign(r, clone(st.payload)))
        return { data: st.returning ? clone(matched) : null, error: null }
      }
      if (st.action === 'delete') {
        store[st.table] = rows.filter(r => !matched.includes(r))
        return { data: null, error: null }
      }
      // insert / upsert
      const list = Array.isArray(st.payload) ? st.payload : [st.payload]
      const inserted = []
      for (const raw of list) {
        const row = { id: randomUUID(), ...clone(raw) }
        if (st.action === 'upsert' && st.upsertOpts?.onConflict) {
          const key = st.upsertOpts.onConflict
          const existing = rows.find(r => r[key] != null && r[key] === row[key])
          if (existing) {
            if (st.upsertOpts.ignoreDuplicates) continue // ON CONFLICT DO NOTHING
            Object.assign(existing, row); inserted.push(existing); continue
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

  return { from, rpc: opts.rpc || (async () => ({ data: null, error: null })) }
}

// ============================================================
// Fixtures
// ============================================================
const NOW = new Date('2026-09-07T16:00:00.000Z') // lunes, horario laboral CDMX
const PAST = new Date(NOW.getTime() - 60000).toISOString()
const DAY_MS = 86400000

function makeWorld({ bankStatus = null, currentStep = 0, orgSettings = {} } = {}) {
  return {
    organizations: [{ id: 'O1', settings: orgSettings }],
    vacancies: [{ id: 'V1', title: 'Gerente RAP', company_name: 'Cliente X', location: 'CDMX', description: 'Reclutar asesores' }],
    outreach_sequences: [{ id: 'S1', organization_id: 'O1', vacancy_id: 'V1', name: 'RAP básica', is_active: true, stop_on_reply: true }],
    sequence_steps: [
      { id: 'st1', sequence_id: 'S1', step_order: 1, day_offset: 0, channel: 'linkedin_connect', template_subject: '', template_body: 'Hola {{nombre}}, te busco por {{vacante}}.', ai_generate: false, condition: 'always' },
      { id: 'st2', sequence_id: 'S1', step_order: 2, day_offset: 3, channel: 'linkedin_message', template_subject: '', template_body: 'Follow-up {{nombre}} ({{puesto}})', ai_generate: false, condition: 'if_connected' },
      { id: 'st3', sequence_id: 'S1', step_order: 3, day_offset: 7, channel: 'email', template_subject: 'Oportunidad {{vacante}}', template_body: 'Correo final para {{nombre}}', ai_generate: false, condition: 'always' },
    ],
    sourcing_bank: [{ id: 'B1', organization_id: 'O1', vacancy_id: 'V1', url: 'https://www.linkedin.com/in/analopez', full_name: 'Ana López', current_title: 'Asesora Sr', current_company: 'Aseguradora Y', snippet: '10 años en ventas', contact_status: bankStatus, provider_id: null }],
    candidates: [{ id: 'C1', full_name: 'Ana López', email: 'ana@example.com', linkedin_url: 'https://www.linkedin.com/in/analopez' }],
    vacancy_candidates: [{ id: 'VC1', vacancy_id: 'V1', candidate_id: 'C1', stage: 'sourced' }],
    sequence_enrollments: [{ id: 'E1', organization_id: 'O1', sequence_id: 'S1', sourcing_bank_id: 'B1', vacancy_candidate_id: null, status: 'active', current_step: currentStep, next_run_at: PAST }],
    scheduled_messages: [],
    candidate_interactions: [],
  }
}

const silentLog = () => {}

// ============================================================
// Tests
// ============================================================
await test('renderTemplate reemplaza {{nombre}} {{vacante}} {{puesto}}', () => {
  assert.equal(
    renderTemplate('Hola {{nombre}}, la vacante {{ vacante }} pide {{PUESTO}}.', { nombre: 'Ana', vacante: 'RAP', puesto: 'Asesor' }),
    'Hola Ana, la vacante RAP pide Asesor.'
  )
})

await test('conditionMet evalúa contra contact_status del banco', () => {
  assert.equal(conditionMet('always', null), true)
  assert.equal(conditionMet('if_connected', { contact_status: 'connected' }), true)
  assert.equal(conditionMet('if_connected', { contact_status: 'invited' }), false)
  assert.equal(conditionMet('if_not_connected', { contact_status: 'connected' }), false)
  assert.equal(conditionMet('if_not_connected', null), true)
})

await test('isDryRun respeta SEQUENCES_DRY_RUN', () => {
  assert.equal(isDryRun({}), false)
  assert.equal(isDryRun({ SEQUENCES_DRY_RUN: '1' }), true)
  assert.equal(isDryRun({ SEQUENCES_DRY_RUN: 'false' }), false)
  assert.equal(isDryRun({ SEQUENCES_DRY_RUN: '0' }), false)
})

await test('PASO A: enrollment activo avanza y encola con jitter 0-90 min', async () => {
  const world = makeWorld()
  const sb = createStubSupabase(world)
  const summary = await advanceEnrollments(sb, { now: NOW, rand: () => 0.5, log: silentLog })
  assert.equal(summary.queued, 1)

  const [msg] = world.scheduled_messages
  assert.ok(msg, 'debe encolar 1 mensaje')
  assert.equal(msg.status, 'queued')
  assert.equal(msg.channel, 'linkedin_connect')
  assert.equal(msg.body, 'Hola Ana, te busco por Gerente RAP.') // plantilla renderizada
  assert.equal(msg.recipient.url, 'https://www.linkedin.com/in/analopez')
  // jitter: rand()=0.5 → exactamente now + 45 min, dentro de [0, 90min]
  const delta = new Date(msg.scheduled_for) - NOW
  assert.equal(delta, Math.floor(0.5 * JITTER_MAX_MS))
  assert.ok(delta >= 0 && delta <= JITTER_MAX_MS)

  const enr = world.sequence_enrollments[0]
  assert.equal(enr.current_step, 1)
  assert.equal(enr.status, 'active')
  // siguiente paso: día 3 − día 0 = 3 días desde ahora
  assert.equal(new Date(enr.next_run_at) - NOW, 3 * DAY_MS)
})

await test('PASO A: condition if_connected salta el paso (skipped en outbox) y avanza', async () => {
  // Paso 2 pide if_connected; el banco NO está conectado → skip auditable.
  const world = makeWorld({ currentStep: 1, bankStatus: 'invited' })
  const sb = createStubSupabase(world)
  const summary = await advanceEnrollments(sb, { now: NOW, rand: () => 0, log: silentLog })
  assert.equal(summary.queued, 0)
  assert.equal(summary.skippedSteps, 1)

  const [msg] = world.scheduled_messages
  assert.equal(msg.status, 'skipped')
  assert.equal(msg.error, 'condition_not_met:if_connected')

  const enr = world.sequence_enrollments[0]
  assert.equal(enr.current_step, 2)
  // siguiente paso: día 7 − día 3 = 4 días
  assert.equal(new Date(enr.next_run_at) - NOW, 4 * DAY_MS)
})

await test('PASO A: kill-switch (settings.sequences_paused) salta la org sin tocar nada', async () => {
  const world = makeWorld({ orgSettings: { sequences_paused: 'true' } })
  const sb = createStubSupabase(world)
  const summary = await advanceEnrollments(sb, { now: NOW, log: silentLog })
  assert.equal(summary.orgPaused, 1)
  assert.equal(world.scheduled_messages.length, 0)
  assert.equal(world.sequence_enrollments[0].current_step, 0) // intacto
})

await test('PASO A: último paso → enrollment completed (el mensaje igual se despacha)', async () => {
  const world = makeWorld({ currentStep: 2 }) // paso 3 = email, es el último
  // el email sale del candidato en pipeline (el banco no guarda correo)
  world.sequence_enrollments[0].vacancy_candidate_id = 'VC1'
  const sb = createStubSupabase(world)
  await advanceEnrollments(sb, { now: NOW, rand: () => 0, log: silentLog })
  const enr = world.sequence_enrollments[0]
  assert.equal(enr.status, 'completed')
  assert.equal(enr.next_run_at, null)
  const [msg] = world.scheduled_messages
  assert.equal(msg.status, 'queued')
  assert.equal(msg.channel, 'email')
  assert.equal(msg.subject, 'Oportunidad Gerente RAP')
})

await test('cuota: getLinkedInQuota cuenta solo linkedin sent y bloquea al límite', async () => {
  const world = makeWorld()
  // 4 enviados hoy → aún permitido; el 5º topa el límite diario (5)
  for (let i = 0; i < LINKEDIN_DAILY_LIMIT - 1; i++) {
    world.scheduled_messages.push({ id: `sent${i}`, organization_id: 'O1', channel: 'linkedin_connect', status: 'sent', sent_at: NOW.toISOString() })
  }
  // ruido que NO debe contar: email enviado + linkedin en cola
  world.scheduled_messages.push({ id: 'em', organization_id: 'O1', channel: 'email', status: 'sent', sent_at: NOW.toISOString() })
  world.scheduled_messages.push({ id: 'qd', organization_id: 'O1', channel: 'linkedin_connect', status: 'queued', scheduled_for: PAST })
  const sb = createStubSupabase(world)
  const q = await getLinkedInQuota(sb, 'O1', NOW.getTime())
  assert.equal(q.dayUsed, LINKEDIN_DAILY_LIMIT - 1)
  assert.equal(q.allowed, true)
})

await test('PASO B: la cuota diaria bloquea el 6º envío de LinkedIn (se queda en cola)', async () => {
  const world = makeWorld()
  // 5 ya enviados HOY (día CDMX) → cuota diaria agotada
  for (let i = 0; i < LINKEDIN_DAILY_LIMIT; i++) {
    world.scheduled_messages.push({ id: `sent${i}`, organization_id: 'O1', channel: 'linkedin_connect', status: 'sent', sent_at: NOW.toISOString() })
  }
  world.scheduled_messages.push({
    id: 'M6', organization_id: 'O1', enrollment_id: 'E1', step_id: 'st1', channel: 'linkedin_connect',
    recipient: { full_name: 'Ana López', url: 'https://www.linkedin.com/in/analopez' },
    body: 'Hola', status: 'queued', scheduled_for: PAST,
  })
  const sb = createStubSupabase(world)
  const summary = await dispatchOutbox(sb, { now: NOW, dry: true, log: silentLog })
  assert.equal(summary.sent, 0)
  assert.equal(summary.quotaBlocked, 1)
  const m6 = world.scheduled_messages.find(m => m.id === 'M6')
  assert.equal(m6.status, 'queued') // devuelto a la cola, no failed
})

await test('PASO B: bajo cuota, el mensaje sale (dry-run marca sent/external_id=dry-run)', async () => {
  const world = makeWorld()
  world.scheduled_messages.push({
    id: 'M1', organization_id: 'O1', enrollment_id: 'E1', step_id: 'st1', channel: 'linkedin_connect',
    recipient: { full_name: 'Ana López', url: 'https://www.linkedin.com/in/analopez' },
    body: 'Hola Ana', status: 'queued', scheduled_for: PAST,
  })
  const sb = createStubSupabase(world)
  const summary = await dispatchOutbox(sb, { now: NOW, dry: true, log: silentLog })
  assert.equal(summary.sent, 1)
  const m1 = world.scheduled_messages.find(m => m.id === 'M1')
  assert.equal(m1.status, 'sent')
  assert.equal(m1.external_id, 'dry-run')
  assert.ok(m1.sent_at)
})

await test('PASO B: lock optimista — dos ticks concurrentes no envían dos veces', async () => {
  const world = makeWorld()
  world.scheduled_messages.push({
    id: 'M1', organization_id: 'O1', enrollment_id: 'E1', step_id: 'st1', channel: 'linkedin_connect',
    recipient: { full_name: 'Ana López', url: 'https://www.linkedin.com/in/analopez' },
    body: 'Hola Ana', status: 'queued', scheduled_for: PAST,
  })
  const sb = createStubSupabase(world)
  const [a, b] = await Promise.all([
    dispatchOutbox(sb, { now: NOW, dry: true, log: silentLog }),
    dispatchOutbox(sb, { now: NOW, dry: true, log: silentLog }),
  ])
  assert.equal(a.sent + b.sent, 1, `un solo envío total (a=${a.sent}, b=${b.sent})`)
  assert.equal(world.scheduled_messages.find(m => m.id === 'M1').status, 'sent')
  // la interacción outbound tampoco se duplica (external_id determinista)
  assert.ok(world.candidate_interactions.length <= 1)
})

await test('PASO B: enrollment replied → su mensaje en cola se cancela, no se envía', async () => {
  const world = makeWorld()
  world.sequence_enrollments[0].status = 'replied' // el trigger de BD lo puso así
  world.scheduled_messages.push({
    id: 'M1', organization_id: 'O1', enrollment_id: 'E1', step_id: 'st2', channel: 'linkedin_message',
    recipient: { full_name: 'Ana López', url: 'https://www.linkedin.com/in/analopez' },
    body: 'Follow-up', status: 'queued', scheduled_for: PAST,
  })
  const sb = createStubSupabase(world)
  const summary = await dispatchOutbox(sb, { now: NOW, dry: true, log: silentLog })
  assert.equal(summary.sent, 0)
  assert.equal(summary.canceled, 1)
  const m1 = world.scheduled_messages.find(m => m.id === 'M1')
  assert.equal(m1.status, 'canceled')
  assert.equal(m1.error, 'enrollment_replied')
})

await test('PASO B: registra interacción outbound (source=sequence) cuando hay vacancy_candidate', async () => {
  const world = makeWorld()
  world.sequence_enrollments[0].sourcing_bank_id = null
  world.sequence_enrollments[0].vacancy_candidate_id = 'VC1'
  world.scheduled_messages.push({
    id: 'M1', organization_id: 'O1', enrollment_id: 'E1', step_id: 'st3', channel: 'email',
    recipient: { full_name: 'Ana López', email: 'ana@example.com' },
    subject: 'Oportunidad', body: 'Correo final', status: 'queued', scheduled_for: PAST,
  })
  const sb = createStubSupabase(world)
  await dispatchOutbox(sb, { now: NOW, dry: true, log: silentLog })
  const [it] = world.candidate_interactions
  assert.ok(it, 'debe registrar la interacción')
  assert.equal(it.vacancy_candidate_id, 'VC1')
  assert.equal(it.direction, 'outbound')
  assert.equal(it.source, 'sequence')
  assert.equal(it.external_id, 'seqmsg-M1')
})

await test('PASO B: whatsapp_manual queda skipped (canal manual, sin envío automatizado)', async () => {
  const world = makeWorld()
  world.scheduled_messages.push({
    id: 'M1', organization_id: 'O1', enrollment_id: 'E1', step_id: null, channel: 'whatsapp_manual',
    recipient: { full_name: 'Ana López' }, body: 'Hola por WhatsApp', status: 'queued', scheduled_for: PAST,
  })
  const sb = createStubSupabase(world)
  const summary = await dispatchOutbox(sb, { now: NOW, dry: true, log: silentLog })
  assert.equal(summary.skipped, 1)
  assert.equal(world.scheduled_messages.find(m => m.id === 'M1').status, 'skipped')
})

console.log(`\n${passed} pruebas OK${process.exitCode ? ' · CON FALLAS' : ''}`)
