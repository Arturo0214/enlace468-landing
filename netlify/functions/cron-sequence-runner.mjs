// Netlify Scheduled Function — motor de secuencias multi-touch (FASE 5).
//
// Schedule (netlify.toml): "*/20 14-23 * * 1-5" = cada 20 min de 8am a 5pm
// CDMX (UTC-6 fijo), L-V — SOLO horario laboral (anti-ban: nunca enviar de
// madrugada ni en fin de semana).
//
// Cada tick hace dos pasos idempotentes:
//   PASO A (avanzar): toma hasta 10 enrollments activos vencidos, materializa
//     el mensaje del paso siguiente (plantilla o IA) y lo ENCOLA en
//     scheduled_messages con jitter aleatorio de 0-90 min (anti-patrón de
//     envíos robóticos a hora exacta). Avanza current_step/next_run_at.
//   PASO B (despachar): toma hasta 5 mensajes 'queued' vencidos y los envía
//     (Unipile para LinkedIn, Resend para email). Lock optimista
//     (UPDATE ... WHERE status='queued') → dos ticks no envían dos veces.
//     Cuota anti-ban por org (lib/quotas.mjs): al toparla, los mensajes de
//     LinkedIn se quedan en cola hasta mañana.
//
// Salvaguardas (no negociables):
//   - Kill-switch: organizations.settings->>'sequences_paused' = 'true'
//   - Cuotas duras LinkedIn (5/día arrancando, 80/semana)
//   - Enrollment 'replied'/'paused'/'stopped' → sus mensajes en cola se cancelan
//   - DRY-RUN: env SEQUENCES_DRY_RUN truthy → loggea "[DRY] would send…" y
//     marca sent con external_id='dry-run'. Los tests locales SIEMPRE así.
//
// La lógica core (advanceEnrollments / dispatchOutbox) recibe el cliente y
// los senders inyectados → scripts/test-sequence-runner.mjs la prueba con
// stubs sin tocar la red.

import { getServiceClient } from './lib/supabase.mjs'
import { getUnipileConfig, createUnipile } from './lib/unipile.mjs'
import { sendEmail } from './lib/resend.mjs'
import { generateDraft } from './lib/draft.mjs'
import { getLinkedInQuota, LINKEDIN_DAILY_LIMIT, LINKEDIN_WEEKLY_LIMIT } from './lib/quotas.mjs'

export const ADVANCE_LIMIT = 10
export const DISPATCH_LIMIT = 5
export const JITTER_MAX_MS = 90 * 60 * 1000 // 0-90 min
const DAY_MS = 24 * 60 * 60 * 1000

/** SEQUENCES_DRY_RUN truthy → no se envía nada real. */
export function isDryRun(env = process.env) {
  const v = env.SEQUENCES_DRY_RUN
  return Boolean(v && v !== 'false' && v !== '0')
}

/** Reemplaza {{nombre}} {{vacante}} {{puesto}} en la plantilla. */
export function renderTemplate(tpl, vars = {}) {
  return String(tpl || '')
    .replace(/\{\{\s*nombre\s*\}\}/gi, vars.nombre || '')
    .replace(/\{\{\s*vacante\s*\}\}/gi, vars.vacante || '')
    .replace(/\{\{\s*puesto\s*\}\}/gi, vars.puesto || '')
    .trim()
}

/** ¿El paso aplica según el estado de conexión del candidato (banco)? */
export function conditionMet(condition, bank) {
  const connected = bank?.contact_status === 'connected'
  if (condition === 'if_connected') return connected
  if (condition === 'if_not_connected') return !connected
  return true // 'always' (o condición desconocida → no bloquear)
}

/** Canal de step → canal del generador de IA (lib/draft.mjs). */
function draftChannelFor(stepChannel) {
  if (stepChannel === 'linkedin_connect') return 'linkedin_note'
  if (stepChannel === 'linkedin_message' || stepChannel === 'linkedin_inmail') return 'linkedin_message'
  if (stepChannel === 'whatsapp_manual') return 'whatsapp'
  return 'email'
}

function slugOfUrl(url = '') {
  const m = String(url).match(/\/in\/([^/?#]+)/i)
  if (!m) return null
  try { return decodeURIComponent(m[1]) } catch { return m[1] }
}

/** ¿La org tiene el kill-switch de secuencias puesto? */
function orgPaused(org) {
  const v = org?.settings?.sequences_paused
  return v === true || v === 'true'
}

async function getCached(cache, key, loader) {
  if (!key) return null
  if (!cache.has(key)) cache.set(key, await loader())
  return cache.get(key)
}

// ============================================================
// PASO A — avanzar enrollments y encolar mensajes
// ============================================================
export async function advanceEnrollments(supabase, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date()
  const rand = opts.rand || Math.random
  const draftFn = opts.draftFn ?? null // (candidate, vacancy, draftChannel) => {subject, body}
  const log = opts.log || console.log
  const summary = { scanned: 0, queued: 0, skippedSteps: 0, completed: 0, orgPaused: 0, errors: 0 }

  const { data: enrollments, error } = await supabase
    .from('sequence_enrollments').select('*')
    .eq('status', 'active')
    .lte('next_run_at', now.toISOString())
    .order('next_run_at', { ascending: true })
    .limit(ADVANCE_LIMIT)
  if (error) { log(`[sequence-runner] no se pudieron leer enrollments: ${error.message}`); summary.errors++; return summary }

  const orgCache = new Map()
  const seqCache = new Map()
  const stepsCache = new Map()
  const vacCache = new Map()

  for (const e of enrollments || []) {
    summary.scanned++
    try {
      // Kill-switch por organización
      const org = await getCached(orgCache, e.organization_id, async () => {
        const { data } = await supabase.from('organizations').select('id, settings').eq('id', e.organization_id).maybeSingle()
        return data
      })
      if (orgPaused(org)) { summary.orgPaused++; continue }

      const seq = await getCached(seqCache, e.sequence_id, async () => {
        const { data } = await supabase.from('outreach_sequences').select('*').eq('id', e.sequence_id).maybeSingle()
        return data
      })
      if (!seq) {
        await supabase.from('sequence_enrollments')
          .update({ status: 'stopped', paused_reason: 'sequence_missing', updated_at: now.toISOString() }).eq('id', e.id)
        continue
      }
      if (!seq.is_active) {
        await supabase.from('sequence_enrollments')
          .update({ status: 'paused', paused_reason: 'sequence_inactive', updated_at: now.toISOString() }).eq('id', e.id)
        continue
      }

      const steps = await getCached(stepsCache, e.sequence_id, async () => {
        const { data } = await supabase.from('sequence_steps').select('*')
          .eq('sequence_id', e.sequence_id).order('step_order', { ascending: true })
        return data || []
      })
      const idx = e.current_step || 0
      const step = steps[idx]
      if (!step) {
        await supabase.from('sequence_enrollments')
          .update({ status: 'completed', next_run_at: null, updated_at: now.toISOString() }).eq('id', e.id)
        summary.completed++
        continue
      }

      // Datos del candidato (banco y/o pipeline)
      let bank = null, vc = null, cand = null
      if (e.sourcing_bank_id) {
        const { data } = await supabase.from('sourcing_bank').select('*').eq('id', e.sourcing_bank_id).maybeSingle()
        bank = data
      }
      if (e.vacancy_candidate_id) {
        const { data } = await supabase.from('vacancy_candidates').select('*').eq('id', e.vacancy_candidate_id).maybeSingle()
        vc = data
        if (vc?.candidate_id) {
          const { data: cd } = await supabase.from('candidates').select('*').eq('id', vc.candidate_id).maybeSingle()
          cand = cd
        }
      }
      if (!bank && !vc) {
        // El target ya no existe (ON DELETE CASCADE debería cubrirlo, pero defensivo)
        await supabase.from('sequence_enrollments')
          .update({ status: 'stopped', paused_reason: 'target_missing', updated_at: now.toISOString() }).eq('id', e.id)
        continue
      }

      const vacancyId = seq.vacancy_id || bank?.vacancy_id || vc?.vacancy_id || null
      const vacancy = (await getCached(vacCache, vacancyId, async () => {
        const { data } = await supabase.from('vacancies')
          .select('id, title, company_name, location, description').eq('id', vacancyId).maybeSingle()
        return data
      })) || {}

      // Avance compartido: day_offset es absoluto → delta entre pasos consecutivos.
      const nextStep = steps[idx + 1]
      const deltaDays = nextStep ? Math.max(0, (Number(nextStep.day_offset) || 0) - (Number(step.day_offset) || 0)) : null
      const advancePatch = nextStep
        ? { current_step: idx + 1, next_run_at: new Date(now.getTime() + deltaDays * DAY_MS).toISOString(), updated_at: now.toISOString() }
        : { current_step: idx + 1, next_run_at: null, status: 'completed', updated_at: now.toISOString() }

      const skipStep = async (reason) => {
        await supabase.from('scheduled_messages').insert({
          organization_id: e.organization_id, enrollment_id: e.id, step_id: step.id,
          channel: step.channel, recipient: {}, status: 'skipped', error: reason,
          scheduled_for: now.toISOString(),
        })
        await supabase.from('sequence_enrollments').update(advancePatch).eq('id', e.id)
        summary.skippedSteps++
        if (!nextStep) summary.completed++
      }

      // Condición del paso (if_connected / if_not_connected vía banco)
      if (!conditionMet(step.condition, bank)) { await skipStep(`condition_not_met:${step.condition}`); continue }

      // Destinatario
      const person = {
        full_name: bank?.full_name || bank?.title || cand?.full_name || '',
        current_title: bank?.current_title || cand?.current_title || '',
        current_company: bank?.current_company || cand?.current_company || '',
        location: cand?.location || '',
        snippet: bank?.snippet || cand?.notes || '',
      }
      const linkedinUrl = (bank?.url && String(bank.url).includes('linkedin.com') ? bank.url : null) || cand?.linkedin_url || null
      const recipient = {
        full_name: person.full_name || null,
        url: linkedinUrl,
        public_id: slugOfUrl(linkedinUrl || ''),
        provider_id: bank?.provider_id || null,
        email: cand?.email || null,
      }
      const isLinkedIn = step.channel.startsWith('linkedin')
      if (isLinkedIn && !recipient.url && !recipient.provider_id) { await skipStep('no_linkedin_url'); continue }
      if (step.channel === 'email' && !recipient.email) { await skipStep('no_email'); continue }

      // Materializar mensaje: IA si el paso lo pide y hay generador; si no, plantilla.
      const vars = { nombre: (person.full_name || '').split(' ')[0], vacante: vacancy.title || '', puesto: person.current_title || '' }
      let subject = renderTemplate(step.template_subject, vars)
      let body = renderTemplate(step.template_body, vars)
      if (step.ai_generate && draftFn && person.full_name) {
        try {
          const d = await draftFn(person, vacancy, draftChannelFor(step.channel))
          if (d?.body) { body = d.body; subject = d.subject || subject }
        } catch (err) {
          log(`[sequence-runner] IA falló (${e.id} paso ${step.step_order}): ${err.message} — uso plantilla`)
        }
      }
      if (!body) { await skipStep('empty_body'); continue }

      // Encolar con jitter 0-90 min (anti-ban: nada de horas exactas)
      const jitter = Math.floor(rand() * JITTER_MAX_MS)
      const { error: insErr } = await supabase.from('scheduled_messages').insert({
        organization_id: e.organization_id, enrollment_id: e.id, step_id: step.id,
        channel: step.channel, recipient, subject: subject || null, body,
        status: 'queued', scheduled_for: new Date(now.getTime() + jitter).toISOString(),
      })
      if (insErr) { log(`[sequence-runner] no se pudo encolar (${e.id}): ${insErr.message}`); summary.errors++; continue }
      await supabase.from('sequence_enrollments').update(advancePatch).eq('id', e.id)
      summary.queued++
      if (!nextStep) summary.completed++
    } catch (err) {
      summary.errors++
      log(`[sequence-runner] enrollment ${e.id} falló: ${err.message}`)
    }
  }
  return summary
}

// ============================================================
// PASO B — despachar el outbox
// ============================================================

/** Sender real de LinkedIn vía Unipile (misma lógica que linkedin-send.mjs). */
function makeLinkedInSender() {
  return async (m) => {
    const { key, dsn, accountId, configured } = getUnipileConfig()
    if (!configured) return { ok: false, error: 'unipile_not_configured' }
    const { request: uni } = createUnipile({ key, dsn })
    const r = m.recipient || {}

    // Resolver provider_id si no lo tenemos
    let providerId = r.provider_id
    if (!providerId) {
      const identifier = r.public_id || slugOfUrl(r.url || '')
      if (!identifier) return { ok: false, error: 'no_linkedin_identifier' }
      const uRes = await uni(`/users/${encodeURIComponent(identifier)}?account_id=${accountId}`)
      const user = await uRes.json().catch(() => ({}))
      if (!uRes.ok || !user.provider_id) return { ok: false, error: `resolve_failed: ${user.detail || user.message || uRes.status}` }
      providerId = user.provider_id
      if (m.channel === 'linkedin_connect' && (user.network_distance === 'FIRST_DEGREE' || user.is_relationship)) {
        // Ya conectado — no reenviar solicitud; el paso se da por cubierto.
        return { ok: true, alreadyConnected: true, provider_id: providerId, external_id: 'already-connected' }
      }
    }

    if (m.channel === 'linkedin_connect') {
      const res = await uni('/users/invite', {
        method: 'POST',
        body: JSON.stringify({ provider_id: providerId, account_id: accountId, message: (m.body || '').slice(0, 200) || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: `invite_failed: ${data.detail || data.message || res.status}` }
      return { ok: true, provider_id: providerId, invitation_id: data.invitation_id || null, external_id: data.invitation_id || `invite-${providerId}` }
    }

    // linkedin_message (1er grado) o linkedin_inmail (Premium/Sales Nav)
    const res = await uni('/chats', {
      method: 'POST',
      body: JSON.stringify({
        account_id: accountId, attendees_ids: [providerId], text: m.body,
        subject: m.subject || undefined,
        ...(m.channel === 'linkedin_inmail' ? { inmail: true } : {}),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: `chat_failed: ${data.detail || data.message || res.status}` }
    return { ok: true, provider_id: providerId, external_id: data.chat_id || data.id || `chat-${providerId}` }
  }
}

/** Sender real de email vía Resend (lib/resend hace skip sin API key). */
function makeEmailSender() {
  return async (m) => {
    const to = m.recipient?.email
    const html = String(m.body || '').split('\n').map(l => `<p style="margin:0 0 10px;">${l}</p>`).join('')
    const res = await sendEmail({ to, subject: m.subject || 'Oportunidad profesional', html })
    if (res.skipped) return { ok: false, skipped: true, error: res.reason }
    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, external_id: res.id || 'resend' }
  }
}

export async function dispatchOutbox(supabase, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date()
  const dry = opts.dry ?? isDryRun()
  const log = opts.log || console.log
  const senders = {
    linkedin: opts.senders?.linkedin || makeLinkedInSender(),
    email: opts.senders?.email || makeEmailSender(),
  }
  const summary = { scanned: 0, sent: 0, failed: 0, canceled: 0, skipped: 0, quotaBlocked: 0, lockMissed: 0 }

  const { data: msgs, error } = await supabase
    .from('scheduled_messages').select('*')
    .eq('status', 'queued')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(DISPATCH_LIMIT)
  if (error) { log(`[sequence-runner] no se pudo leer el outbox: ${error.message}`); return summary }

  const orgCache = new Map()
  const quotaCache = new Map()     // orgId → { dayUsed, weekUsed } (+ envíos locales del tick)
  const linkedinBlocked = new Set() // orgs que ya toparon cuota este tick

  for (const m of msgs || []) {
    summary.scanned++
    try {
      const isLinkedIn = String(m.channel).startsWith('linkedin')
      if (isLinkedIn && linkedinBlocked.has(m.organization_id)) { summary.quotaBlocked++; continue }

      // Lock optimista: solo procesa quien logre el UPDATE queued→sending.
      const { data: locked, error: lockErr } = await supabase
        .from('scheduled_messages').update({ status: 'sending' })
        .eq('id', m.id).eq('status', 'queued').select()
      if (lockErr || !locked || locked.length === 0) { summary.lockMissed++; continue }

      const revert = (patch) => supabase.from('scheduled_messages').update(patch).eq('id', m.id)

      // Guard: enrollment debe seguir vivo (active o completed con cola pendiente).
      const { data: enr } = await supabase.from('sequence_enrollments')
        .select('*').eq('id', m.enrollment_id).maybeSingle()
      if (!enr || !['active', 'completed'].includes(enr.status)) {
        await revert({ status: 'canceled', error: `enrollment_${enr?.status || 'missing'}` })
        summary.canceled++
        continue
      }

      // Kill-switch también en despacho (pudo activarse después de encolar)
      const org = await getCached(orgCache, m.organization_id, async () => {
        const { data } = await supabase.from('organizations').select('id, settings').eq('id', m.organization_id).maybeSingle()
        return data
      })
      if (orgPaused(org)) { await revert({ status: 'queued' }); summary.quotaBlocked++; continue }

      // whatsapp_manual: no hay envío automatizado — queda como pendiente manual.
      // (La tabla notifications llega en Fase 6; por ahora solo log.)
      if (m.channel === 'whatsapp_manual') {
        await revert({ status: 'skipped', error: 'manual_channel' })
        log(`[sequence-runner] whatsapp_manual pendiente de envío MANUAL → ${m.recipient?.full_name || m.id}`)
        summary.skipped++
        continue
      }

      // Cuota anti-ban de LinkedIn (dura, por org)
      if (isLinkedIn) {
        let q = quotaCache.get(m.organization_id)
        if (!q) { q = await getLinkedInQuota(supabase, m.organization_id, now.getTime()); quotaCache.set(m.organization_id, q) }
        if (q.dayUsed >= LINKEDIN_DAILY_LIMIT || q.weekUsed >= LINKEDIN_WEEKLY_LIMIT) {
          await revert({ status: 'queued' }) // se reintenta cuando haya presupuesto
          linkedinBlocked.add(m.organization_id)
          summary.quotaBlocked++
          log(`[sequence-runner] cuota LinkedIn topada (org ${m.organization_id}: ${q.dayUsed}/día, ${q.weekUsed}/sem) — LinkedIn en pausa este tick`)
          continue
        }
      }

      // Envío (o dry-run)
      let result
      if (dry) {
        log(`[DRY] would send ${m.channel} → ${m.recipient?.full_name || m.recipient?.email || m.recipient?.url || '?'} :: ${(m.body || '').slice(0, 80)}`)
        result = { ok: true, external_id: 'dry-run' }
      } else if (isLinkedIn) {
        result = await senders.linkedin(m)
      } else if (m.channel === 'email') {
        result = await senders.email(m)
      } else {
        result = { ok: false, error: `unknown_channel:${m.channel}` }
      }

      if (!result.ok) {
        if (result.skipped) { await revert({ status: 'skipped', error: result.error || 'skipped' }); summary.skipped++ }
        else { await revert({ status: 'failed', error: (result.error || 'send_failed').slice(0, 300) }); summary.failed++ }
        continue
      }

      await revert({ status: 'sent', sent_at: now.toISOString(), external_id: result.external_id || null, error: null })
      summary.sent++
      if (isLinkedIn) {
        const q = quotaCache.get(m.organization_id)
        if (q) { q.dayUsed++; q.weekUsed++ }
      }

      // Registro de contacto en el banco (mismo upsert semántico que hace
      // SourcingTab al enviar a mano): estado + mensaje + provider_id.
      if (enr.sourcing_bank_id && isLinkedIn && !dry) {
        const patch = {
          contact_channel: draftChannelFor(m.channel), contacted_at: now.toISOString(),
          contact_message: m.body,
          ...(result.provider_id ? { provider_id: result.provider_id } : {}),
          ...(result.invitation_id ? { invitation_id: result.invitation_id } : {}),
        }
        // linkedin_message va a gente YA conectada → no pisar 'connected'.
        if (m.channel === 'linkedin_connect' && !result.alreadyConnected) patch.contact_status = 'invited'
        if (m.channel === 'linkedin_inmail') patch.contact_status = 'inmail_sent'
        await supabase.from('sourcing_bank').update(patch).eq('id', enr.sourcing_bank_id)
      }

      // Timeline del candidato (si está en pipeline). external_id determinista
      // por mensaje → reintentos jamás duplican (unique parcial + ignore).
      if (enr.vacancy_candidate_id) {
        await supabase.from('candidate_interactions').upsert({
          vacancy_candidate_id: enr.vacancy_candidate_id,
          type: isLinkedIn ? 'linkedin_message' : m.channel,
          direction: 'outbound',
          content: (m.subject ? `${m.subject}\n\n` : '') + (m.body || ''),
          source: 'sequence',
          external_id: `seqmsg-${m.id}`,
        }, { onConflict: 'external_id', ignoreDuplicates: true })
      }
    } catch (err) {
      summary.failed++
      log(`[sequence-runner] mensaje ${m.id} falló: ${err.message}`)
      try { await supabase.from('scheduled_messages').update({ status: 'failed', error: String(err.message).slice(0, 300) }).eq('id', m.id).eq('status', 'sending') } catch { /* best effort */ }
    }
  }
  return summary
}

// ============================================================
// Handler del cron
// ============================================================
export async function handler() {
  const t0 = Date.now()
  const supabase = getServiceClient()
  const dry = isDryRun()

  // IA solo si hay key; si no, los pasos ai_generate caen a su plantilla.
  const draftFn = process.env.ANTHROPIC_API_KEY
    ? (candidate, vacancy, channel) => generateDraft(candidate, vacancy, channel)
    : null

  const advance = await advanceEnrollments(supabase, { draftFn })
  const dispatch = await dispatchOutbox(supabase, { dry })

  console.log(`[cron-sequence-runner] listo en ${Date.now() - t0}ms${dry ? ' (DRY-RUN)' : ''} · avance=${JSON.stringify(advance)} · despacho=${JSON.stringify(dispatch)}`)
  return { statusCode: 200, body: JSON.stringify({ ok: true, dry, advance, dispatch }) }
}
