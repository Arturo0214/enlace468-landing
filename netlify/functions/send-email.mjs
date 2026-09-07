// Netlify function: envío de correos transaccionales desde la plataforma
// (FASE 7 — email de agradecimiento/rechazo vía Resend, fuera del mailto:).
//
// POST /api/send-email
// Headers: Authorization: Bearer <access_token de Supabase del usuario>
// Body: {
//   type: 'rejection_thanks',
//   recipients: [{ email, name, candidate_id?, vacancy_candidate_id? }],  (máx 100)
//   subject: string,
//   body: string,          // texto plano con {{nombre}} para personalizar
//   vacancy_id?: uuid,
//   organization_id: uuid, // debe coincidir con el profile del token
// }
// Devuelve: { ok, sent, skipped, failed, reason? }
//
// Seguridad: el JWT se valida con supabase.auth.getUser(token) y el usuario
// debe pertenecer (profile activo) a la organization_id del body — jamás se
// confía en el body sin ese cruce.
//
// Envío: UN email POR destinatario (nada de BCC masivo — personalización
// {{nombre}} + privacidad entre candidatos). Cada envío se loggea en
// `communications` (channel='email', direction='outbound', template_key=type).
//
// Sin RESEND_API_KEY: lib/resend hace skip — aquí se corta ANTES del loop y
// se devuelve { sent:0, skipped:N, reason:'no_resend_key' } sin loggear nada,
// para que el frontend ofrezca el fallback mailto:.

import { getServiceClient } from './lib/supabase.mjs'
import { sendEmail } from './lib/resend.mjs'

const NAVY = '#071B49'
const TEAL = '#00A99D'
const MAX_RECIPIENTS = 100

// Tipos permitidos → texto del kicker en el header del email.
export const EMAIL_TYPES = {
  rejection_thanks: 'Proceso de selección',
}

export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Sustituye {{nombre}} por el primer nombre del destinatario (o fallback). */
export function personalize(template, fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0]
  return String(template || '').replace(/\{\{\s*nombre\s*\}\}/g, first || 'candidato/a')
}

/** Texto plano → HTML con la marca (navy #071B49 / turquesa #00A99D). */
export function buildBrandedHtml({ kicker, title, bodyText }) {
  const paragraphs = String(bodyText || '')
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.6;">${esc(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:${NAVY};border-radius:12px 12px 0 0;padding:20px 24px;">
      <p style="margin:0;color:${TEAL};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Enlace 468 · ${esc(kicker)}</p>
      ${title ? `<h1 style="margin:6px 0 0;color:#ffffff;font-size:18px;">${esc(title)}</h1>` : ''}
    </div>
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px;">
      ${paragraphs}
    </div>
    <p style="margin:16px 0 0;text-align:center;color:#9ca3af;font-size:11px;">Enviado con Enlace 468</p>
  </div>
</body></html>`
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const type = body.type
  if (!EMAIL_TYPES[type]) return { statusCode: 400, headers, body: JSON.stringify({ error: 'type inválido', allowed: Object.keys(EMAIL_TYPES) }) }
  if (!body.subject || !body.body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'subject y body son requeridos' }) }
  if (!body.organization_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'organization_id requerido' }) }

  const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
    .filter(r => r && typeof r.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
  if (!recipients.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'recipients vacío o sin emails válidos' }) }
  if (recipients.length > MAX_RECIPIENTS) return { statusCode: 400, headers, body: JSON.stringify({ error: `máximo ${MAX_RECIPIENTS} destinatarios por request` }) }

  // ── Auth: JWT del usuario + pertenencia a la organización ──
  const token = (event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authorization Bearer requerido' }) }

  const supabase = getServiceClient()
  const { data: userData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !userData?.user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido o expirado' }) }

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, organization_id, full_name, is_active')
    .eq('id', userData.user.id)
    .single()
  if (pErr || !profile) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Perfil no encontrado' }) }
  if (!profile.is_active || profile.organization_id !== body.organization_id) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'No perteneces a esa organización' }) }
  }

  // ── Sin key de Resend: skip limpio (el frontend ofrece mailto:) ──
  if (!process.env.RESEND_API_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: 0, skipped: recipients.length, failed: 0, reason: 'no_resend_key' }) }
  }

  // ── Envío: 1 email por destinatario + log en communications ──
  let sent = 0, skipped = 0, failed = 0
  const commRows = []
  for (const r of recipients) {
    const text = personalize(body.body, r.name)
    const subject = personalize(body.subject, r.name)
    const html = buildBrandedHtml({ kicker: EMAIL_TYPES[type], title: subject, bodyText: text })

    const res = await sendEmail({ to: r.email, subject, html })
    if (res.ok) sent++
    else if (res.skipped) skipped++
    else failed++

    commRows.push({
      organization_id: body.organization_id,
      candidate_id: r.candidate_id || null,
      vacancy_candidate_id: r.vacancy_candidate_id || null,
      channel: 'email',
      direction: 'outbound',
      template_key: type,
      subject,
      body: text,
      status: res.ok ? 'sent' : 'failed',
      sent_at: res.ok ? new Date().toISOString() : null,
      sent_by: profile.id,
      metadata: { to: r.email, resend_id: res.id || null, vacancy_id: body.vacancy_id || null, error: res.error || res.reason || null },
    })
  }

  const { error: cErr } = await supabase.from('communications').insert(commRows)
  if (cErr) console.error('[send-email] no se pudo loggear en communications:', cErr.message)

  console.log(`[send-email] ${type} por ${profile.id} (org ${body.organization_id}): ${sent} enviados, ${skipped} skip, ${failed} fallidos`)
  return { statusCode: 200, headers, body: JSON.stringify({ ok: failed === 0, sent, skipped, failed }) }
}
