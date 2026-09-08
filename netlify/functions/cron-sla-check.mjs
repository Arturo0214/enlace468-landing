// Netlify Scheduled Function — vigilante de SLAs por etapa (FASE 6).
//
// Schedule (netlify.toml): "30 13 * * 1-5" = 7:30am CDMX (UTC-6 fijo), L-V —
// media hora después del digest matutino para no empalmar envíos de Resend.
//
// Por cada organización con reglas activas en sla_rules revisa los candidatos
// de vacantes ABIERTAS cuya etapa no sea terminal (hired/rejected): si llevan
// más días en la etapa que el max_days de su regla, crea una notificación
// in-app type='sla_breach' dirigida a toda la org (recipient_id NULL) — la
// campana del Topbar (NotificationBell.jsx) la pinta.
//
// DEDUPE: no se re-notifica un mismo vacancy_candidate si ya tiene una
// sla_breach en las últimas 72h (RECENT_WINDOW_MS) — un candidato atorado
// genera a lo más una alerta cada 3 días, no una diaria.
//
// Al final, si hubo notificaciones nuevas y existe RESEND_API_KEY, manda UN
// email resumen por organización a los admin/recruiter activos y marca
// emailed_at. Sin key, lib/resend.mjs hace skip silencioso.
//
// La lógica de vencimiento/dedupe vive en funciones PURAS exportadas
// (daysInStage, evaluateSlaBreaches) — se prueban con
// scripts/test-sla-logic.mjs sin tocar red ni BD.

import { getServiceClient } from './lib/supabase.mjs'
import { sendEmail } from './lib/resend.mjs'
import { getStageLabel } from '../../src/lib/stageLabels.js'

const NAVY = '#071B49'
const TEAL = '#00A99D'

/** Ventana de dedupe: no repetir la alerta del mismo candidato en 72h. */
export const RECENT_WINDOW_MS = 72 * 3600 * 1000

const DAY_MS = 86400000
const PAGE = 1000 // paginación de lecturas (jamás .in() con listas largas)
const CHUNK = 80 // tope duro para .in() (regla del repo: nunca >80 ids)

/**
 * Días COMPLETOS que el candidato lleva en su etapa actual.
 * Cae en created_at si stage_changed_at viene null (filas viejas).
 * @param {{stage_changed_at?:string, created_at?:string}} vc
 * @param {number} [now] epoch ms (inyectable para pruebas)
 */
export function daysInStage(vc, now = Date.now()) {
  const ref = vc?.stage_changed_at || vc?.created_at
  if (!ref) return 0
  const t = new Date(ref).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((now - t) / DAY_MS))
}

/**
 * Lógica PURA de vencimiento + dedupe. No toca red ni BD.
 *
 * @param {object} params
 * @param {Array} params.candidates filas de vacancy_candidates con embeds
 *   candidates(full_name) y vacancies(title); solo etapas no terminales.
 * @param {Array<{stage:string,max_days:number,is_active?:boolean}>} params.rules
 * @param {Set<string>|Array<string>} params.alreadyNotified entity_ids con
 *   sla_breach reciente (ventana de 72h) — se saltan.
 * @param {object|null} params.labels overrides de etiquetas de la org
 *   (organizations.settings.stage_labels) o null para defaults.
 * @param {string} params.orgId
 * @param {number} [params.now] epoch ms (inyectable para pruebas)
 * @returns {Array<object>} filas listas para insertar en notifications.
 */
export function evaluateSlaBreaches({ candidates, rules, alreadyNotified, labels, orgId, now = Date.now() }) {
  const ruleByStage = new Map()
  for (const r of rules || []) {
    if (r?.is_active === false) continue
    if (!r?.stage || !(Number(r.max_days) > 0)) continue
    ruleByStage.set(r.stage, { ...r, max_days: Number(r.max_days) })
  }
  const notified = alreadyNotified instanceof Set ? alreadyNotified : new Set(alreadyNotified || [])

  const out = []
  for (const vc of candidates || []) {
    if (!vc?.id || vc.stage === 'hired' || vc.stage === 'rejected') continue
    const rule = ruleByStage.get(vc.stage)
    if (!rule) continue
    const days = daysInStage(vc, now)
    if (days <= rule.max_days) continue // vence al EXCEDER el límite, no al tocarlo
    if (notified.has(vc.id)) continue // dedupe 72h
    const name = vc.candidates?.full_name || 'Candidato sin nombre'
    const stageLabel = getStageLabel(labels, vc.stage)
    out.push({
      organization_id: orgId,
      recipient_id: null, // toda la org
      type: 'sla_breach',
      title: `SLA vencido: ${name} lleva ${days}d en ${stageLabel}`,
      body: `Límite de la etapa: ${rule.max_days} día${rule.max_days === 1 ? '' : 's'} · Vacante: ${vc.vacancies?.title || '—'}`,
      entity_type: 'vacancy_candidate',
      entity_id: vc.id,
      // _meta NO se inserta — solo para armar el email resumen.
      _meta: { name, stageLabel, days, maxDays: rule.max_days, vacancyTitle: vc.vacancies?.title || '—' },
    })
  }
  return out
}

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function buildEmailHtml({ breaches, appUrl }) {
  // Tope: con backlog grande el email lista las 30 mas vencidas + conteo del resto.
  const shown = breaches.slice(0, 30)
  const rows = shown.map(b => `
      <tr>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;">${esc(b._meta.name)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#374151;">${esc(b._meta.vacancyTitle)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#374151;">${esc(b._meta.stageLabel)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:center;"><span style="display:inline-block;min-width:30px;padding:2px 8px;border-radius:999px;background:#dc2626;color:#ffffff;font-weight:700;">${b._meta.days}d</span> <span style="color:#6b7280;font-size:11px;">/ ${b._meta.maxDays}d</span></td>
      </tr>`).join('')

  const cta = appUrl
    ? `<p style="margin:24px 0 0;font-size:13px;"><a href="${esc(appUrl)}/dashboard/vacancies" style="display:inline-block;background:${TEAL};color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Revisar pipeline</a></p>`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:${NAVY};border-radius:12px 12px 0 0;padding:20px 24px;">
      <p style="margin:0;color:${TEAL};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Enlace 468 · SLAs del pipeline</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;">${breaches.length} candidato${breaches.length === 1 ? '' : 's'} con SLA vencido</h1>
    </div>
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:8px 24px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin-top:12px;">
        <tr style="text-align:left;color:#6b7280;">
          <th style="padding:6px 8px;border-bottom:2px solid ${TEAL};">Candidato</th>
          <th style="padding:6px 8px;border-bottom:2px solid ${TEAL};">Vacante</th>
          <th style="padding:6px 8px;border-bottom:2px solid ${TEAL};">Etapa</th>
          <th style="padding:6px 8px;border-bottom:2px solid ${TEAL};text-align:center;">Días</th>
        </tr>
        ${rows}
      </table>
      ${breaches.length > 30 ? `<p style="margin:10px 0 0;color:#6b7280;font-size:12px;">…y ${breaches.length - 30} más — revisa los badges SLA en el pipeline.</p>` : ''}
      ${cta}
    </div>
    <p style="margin:16px 0 0;text-align:center;color:#9ca3af;font-size:11px;">Un candidato atorado se re-alerta cada 72h como máximo · configura los límites en Configuración → SLAs.</p>
  </div>
</body></html>`
}

/** Candidatos activos de vacantes abiertas de la org, paginado (sin .in()). */
async function loadOrgCandidates(supabase, orgId) {
  const all = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('vacancy_candidates')
      .select('id, stage, stage_changed_at, created_at, candidates(full_name), vacancies!inner(title, organization_id, status)')
      .eq('vacancies.organization_id', orgId)
      .eq('vacancies.status', 'open')
      .not('stage', 'in', '(hired,rejected)')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`vacancy_candidates: ${error.message}`)
    all.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return all
}

/** entity_ids con sla_breach reciente (dedupe), paginado. */
async function loadRecentlyNotified(supabase, orgId, sinceIso) {
  const ids = new Set()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('notifications')
      .select('entity_id')
      .eq('organization_id', orgId)
      .eq('type', 'sla_breach')
      .gte('created_at', sinceIso)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`notifications(dedupe): ${error.message}`)
    for (const n of data || []) if (n.entity_id) ids.add(n.entity_id)
    if (!data || data.length < PAGE) break
  }
  return ids
}

export async function handler() {
  const supabase = getServiceClient()
  const appUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
  const sinceIso = new Date(Date.now() - RECENT_WINDOW_MS).toISOString()

  // 1. Reglas activas — agrupadas por organización.
  const { data: rules, error: rErr } = await supabase
    .from('sla_rules')
    .select('organization_id, stage, max_days, is_active')
    .eq('is_active', true)
  if (rErr) {
    // Tabla aún sin migrar en prod → no-op limpio (mismo criterio que la UI).
    if (rErr.code === '42P01' || /sla_rules/.test(rErr.message || '')) {
      console.log('[cron-sla-check] sla_rules no existe todavía — aplica la migración 20260908020000')
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'no_table' }) }
    }
    console.error('[cron-sla-check] no se pudieron leer sla_rules:', rErr.message)
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: rErr.message }) }
  }

  const rulesByOrg = new Map()
  for (const r of rules || []) {
    if (!rulesByOrg.has(r.organization_id)) rulesByOrg.set(r.organization_id, [])
    rulesByOrg.get(r.organization_id).push(r)
  }
  if (!rulesByOrg.size) {
    console.log('[cron-sla-check] sin reglas activas — nada que revisar')
    return { statusCode: 200, body: JSON.stringify({ ok: true, orgs: [] }) }
  }

  // 2. Etiquetas de etapa por org (organizations.settings.stage_labels).
  const labelsByOrg = new Map()
  const orgIds = [...rulesByOrg.keys()]
  for (let i = 0; i < orgIds.length; i += CHUNK) {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, settings')
      .in('id', orgIds.slice(i, i + CHUNK))
    if (error) console.error('[cron-sla-check] no se pudieron leer organizations:', error.message)
    for (const o of orgs || []) labelsByOrg.set(o.id, o.settings?.stage_labels || null)
  }

  const summary = []
  for (const [orgId, orgRules] of rulesByOrg) {
    try {
      const candidates = await loadOrgCandidates(supabase, orgId)
      const alreadyNotified = await loadRecentlyNotified(supabase, orgId, sinceIso)
      const breaches = evaluateSlaBreaches({
        candidates,
        rules: orgRules,
        alreadyNotified,
        labels: labelsByOrg.get(orgId) || null,
        orgId,
      })

      if (!breaches.length) {
        console.log(`[cron-sla-check] org ${orgId}: ${candidates.length} candidatos activos · 0 SLAs vencidos nuevos`)
        summary.push({ org: orgId, candidates: candidates.length, breaches: 0 })
        continue
      }

      // 3. Insertar notificaciones (sin _meta) — CON TOPE anti-inundación:
      // el backlog histórico puede traer cientos de vencidos de golpe (el
      // primer run real detectó ~314). Se notifican las 20 más vencidas por
      // corrida + 1 resumen con el resto; el dedupe de 72h hace que las
      // siguientes corridas drenen el backlog gradualmente.
      const MAX_DETAIL_PER_ORG = 20
      breaches.sort((a, b) => (b._meta?.days || 0) - (a._meta?.days || 0))
      const toInsert = breaches.slice(0, MAX_DETAIL_PER_ORG).map(({ _meta, ...row }) => row)
      if (breaches.length > MAX_DETAIL_PER_ORG) {
        const rest = breaches.length - MAX_DETAIL_PER_ORG
        toInsert.push({
          organization_id: orgId,
          recipient_id: null,
          type: 'sla_breach',
          title: `SLA: ${rest} candidato${rest === 1 ? '' : 's'} más con etapa vencida`,
          body: 'Revisa los badges SLA rojos en el pipeline; se notificarán 20 por día hasta drenar el backlog.',
          entity_type: null,
          entity_id: null,
        })
      }
      const insertedIds = []
      for (let i = 0; i < toInsert.length; i += 100) {
        const batch = toInsert.slice(i, i + 100)
        const { data: inserted, error } = await supabase
          .from('notifications')
          .insert(batch)
          .select('id')
        if (error) throw new Error(`notifications(insert): ${error.message}`)
        insertedIds.push(...(inserted || []).map(n => n.id))
      }

      // 4. UN email resumen por org (Resend hace skip sin key).
      const { data: recipients, error: pErr } = await supabase
        .from('profiles')
        .select('email')
        .eq('organization_id', orgId)
        .in('role', ['admin', 'recruiter'])
        .eq('is_active', true)
      if (pErr) throw new Error(`profiles: ${pErr.message}`)
      const to = [...new Set((recipients || []).map(p => p.email).filter(Boolean))]

      let sent = { ok: false, skipped: true, reason: 'no_recipients' }
      if (to.length) {
        sent = await sendEmail({
          to,
          subject: `SLA vencido: ${breaches.length} candidato${breaches.length === 1 ? '' : 's'} atorado${breaches.length === 1 ? '' : 's'} en el pipeline`,
          html: buildEmailHtml({ breaches, appUrl }),
        })
        if (sent.ok) {
          const emailedAt = new Date().toISOString()
          for (let i = 0; i < insertedIds.length; i += CHUNK) {
            await supabase
              .from('notifications')
              .update({ emailed_at: emailedAt })
              .in('id', insertedIds.slice(i, i + CHUNK))
          }
        }
      }

      console.log(`[cron-sla-check] org ${orgId}: ${candidates.length} candidatos activos · ${breaches.length} SLAs vencidos nuevos → ${to.length} destinatarios · ${sent.ok ? `email enviado (${sent.id})` : sent.skipped ? `email skip (${sent.reason})` : `email error (${sent.error})`}`)
      summary.push({ org: orgId, candidates: candidates.length, breaches: breaches.length, emailed: !!sent.ok })
    } catch (e) {
      console.error(`[cron-sla-check] error en org ${orgId}: ${e.message}`)
      summary.push({ org: orgId, error: e.message })
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, orgs: summary }) }
}
