// Netlify Scheduled Function — digest matutino "Candidatos de hoy" (FASE 1).
//
// Schedule (netlify.toml): "0 13 * * 1-5" = 7:00am CDMX (UTC-6 fijo), L-V —
// justo después de las 3 corridas nocturnas de cron-auto-source (4/5/6am).
//
// Junta lo upserteado a sourcing_bank en las últimas 24h con
// source='auto-sourced', lo agrupa por organización → vacante (orden score
// desc) y manda un email de resumen (Resend) a los perfiles admin/recruiter
// activos de cada organización. Las orgs con sourcing nocturno activo reciben
// el digest aunque el neto sea 0 (transparencia: sin caps silenciosos).
//
// Sin RESEND_API_KEY, lib/resend.mjs hace skip silencioso y aquí solo se
// loggea — todo queda listo para cuando exista la key.

import { getServiceClient } from './lib/supabase.mjs'
import { sendEmail } from './lib/resend.mjs'

const NAVY = '#071B49'
const TEAL = '#00A99D'
const DAILY_GOAL = 30 // meta de la Fase 1: "30 candidatos cada mañana"

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function buildHtml({ total, groups, appUrl }) {
  const scoreColor = s => (s >= 75 ? TEAL : s >= 60 ? '#b45309' : '#6b7280')

  const vacancyBlocks = groups.map(g => `
    <h3 style="margin:24px 0 8px;font-size:15px;color:${NAVY};">${esc(g.title)} · ${g.items.length} candidato${g.items.length === 1 ? '' : 's'}</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
      <tr style="text-align:left;color:#6b7280;">
        <th style="padding:6px 8px;border-bottom:2px solid ${TEAL};">Candidato</th>
        <th style="padding:6px 8px;border-bottom:2px solid ${TEAL};">Puesto actual</th>
        <th style="padding:6px 8px;border-bottom:2px solid ${TEAL};text-align:center;">Score</th>
        <th style="padding:6px 8px;border-bottom:2px solid ${TEAL};">Perfil</th>
      </tr>
      ${g.items.map(it => `
      <tr>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;">${esc(it.full_name || it.title || '—')}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#374151;">${esc([it.current_title, it.current_company].filter(Boolean).join(' · ') || '—')}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:center;"><span style="display:inline-block;min-width:30px;padding:2px 8px;border-radius:999px;background:${scoreColor(Number(it.score) || 0)};color:#ffffff;font-weight:700;">${it.score != null ? Math.round(Number(it.score)) : '—'}</span></td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;"><a href="${esc(it.url)}" style="color:${TEAL};">Ver LinkedIn</a></td>
      </tr>`).join('')}
    </table>`).join('')

  // Línea honesta cuando los motores gratuitos rinden menos que la meta.
  const shortNote = total < DAILY_GOAL
    ? `<p style="margin:20px 0 0;padding:12px 14px;background:#fffbeb;border-left:3px solid #f59e0b;color:#92400e;font-size:13px;border-radius:0 8px 8px 0;">Hoy los motores gratuitos rindieron ${total}; corre una búsqueda manual si necesitas más.</p>`
    : ''

  const cta = appUrl
    ? `<p style="margin:24px 0 0;font-size:13px;"><a href="${esc(appUrl)}/dashboard" style="display:inline-block;background:${TEAL};color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Abrir "Candidatos de hoy"</a></p>`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:${NAVY};border-radius:12px 12px 0 0;padding:20px 24px;">
      <p style="margin:0;color:${TEAL};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Enlace 468 · Sourcing nocturno</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;">Candidatos de hoy — ${total} nuevo${total === 1 ? '' : 's'}</h1>
    </div>
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:8px 24px 24px;">
      ${total ? vacancyBlocks : '<p style="margin:20px 0 0;color:#374151;font-size:14px;">El sourcing nocturno no encontró candidatos nuevos en las últimas 24 horas.</p>'}
      ${shortNote}
      ${cta}
    </div>
    <p style="margin:16px 0 0;text-align:center;color:#9ca3af;font-size:11px;">El sourcing corre L-V a las 4, 5 y 6am (CDMX) · este digest sale a las 7am.</p>
  </div>
</body></html>`
}

export async function handler() {
  const supabase = getServiceClient()
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  // Netlify inyecta URL (dominio principal del sitio) en el runtime.
  const appUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')

  // 1. Lo upserteado por el sourcing nocturno en las últimas 24h, ya rankeado.
  const { data: allRows, error } = await supabase
    .from('sourcing_bank')
    .select('organization_id, vacancy_id, full_name, title, current_title, current_company, url, score, verify_status, vacancies(title)')
    .eq('source', 'auto-sourced')
    .gte('created_at', since)
    .order('score', { ascending: false, nullsFirst: false })
  if (error) {
    console.error('[cron-daily-digest] no se pudo leer sourcing_bank:', error.message)
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) }
  }

  // Solo CONFIRMADOS de México: la cuarentena geográfica del gate de calidad
  // (geo_desconocida) y los extranjeros no se presumen en el digest — el cron
  // de verificación los rescata o los manda a la basura. Filtro en JS (el set
  // de 24h es chico) para no depender de sintaxis not.in de PostgREST.
  const HIDDEN_STATUSES = new Set(['geo_desconocida', 'extranjero'])
  const rows = (allRows || []).filter(r => !HIDDEN_STATUSES.has(r.verify_status))
  const quarantinedCount = (allRows || []).length - rows.length
  if (quarantinedCount) console.log(`[cron-daily-digest] ${quarantinedCount} fila(s) en cuarentena geográfica fuera del digest`)

  // 2. Orgs con sourcing nocturno activo — reciben digest aunque N=0.
  const { data: enabledVacs, error: vErr } = await supabase
    .from('vacancies')
    .select('organization_id')
    .eq('auto_source_enabled', true)
    .eq('status', 'open')
  if (vErr) console.error('[cron-daily-digest] no se pudieron leer vacantes activas:', vErr.message)

  const orgIds = new Set([
    ...(rows || []).map(r => r.organization_id),
    ...(enabledVacs || []).map(x => x.organization_id),
  ].filter(Boolean))

  if (!orgIds.size) {
    console.log('[cron-daily-digest] sin candidatos nuevos ni orgs con sourcing activo — nada que enviar')
    return { statusCode: 200, body: JSON.stringify({ ok: true, orgs: [] }) }
  }

  const summary = []
  for (const orgId of orgIds) {
    try {
      const orgRows = (rows || []).filter(r => r.organization_id === orgId)
      // Agrupar por vacante conservando el orden global (score desc).
      const byVac = new Map()
      for (const r of orgRows) {
        if (!byVac.has(r.vacancy_id)) byVac.set(r.vacancy_id, { title: r.vacancies?.title || 'Vacante', items: [] })
        byVac.get(r.vacancy_id).items.push(r)
      }
      const groups = [...byVac.values()]

      const { data: recipients, error: pErr } = await supabase
        .from('profiles')
        .select('email, full_name, role')
        .eq('organization_id', orgId)
        .in('role', ['admin', 'recruiter'])
        .eq('is_active', true)
      if (pErr) throw new Error(pErr.message)

      const to = [...new Set((recipients || []).map(p => p.email).filter(Boolean))]
      if (!to.length) {
        console.log(`[cron-daily-digest] org ${orgId}: sin destinatarios admin/recruiter activos`)
        continue
      }

      const total = orgRows.length
      const html = buildHtml({ total, groups, appUrl })
      const sent = await sendEmail({
        to,
        subject: `Candidatos de hoy — ${total} nuevo${total === 1 ? '' : 's'}`,
        html,
      })
      console.log(`[cron-daily-digest] org ${orgId}: ${total} candidatos → ${to.length} destinatarios · ${sent.ok ? `enviado (${sent.id})` : sent.skipped ? `skip (${sent.reason})` : `error (${sent.error})`}`)
      summary.push({ org: orgId, total, recipients: to.length, sent: !!sent.ok, skipped: !!sent.skipped })
    } catch (e) {
      console.error(`[cron-daily-digest] error en org ${orgId}: ${e.message}`)
      summary.push({ org: orgId, error: e.message })
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, orgs: summary }) }
}
