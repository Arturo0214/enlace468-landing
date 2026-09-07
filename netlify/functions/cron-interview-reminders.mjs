// Netlify Scheduled Function — recordatorios de entrevista (FASE 7).
//
// Schedule (netlify.toml): "0 14-23 * * *" = cada hora de 8am a 5pm CDMX
// (UTC-6 fijo). Busca entrevistas status='scheduled' con reminder_sent
// false/null cuya scheduled_at cae entre 20h y 28h en el futuro ("mañana")
// y manda recordatorio al candidato (si tiene email) Y a los reclutadores
// admin/recruiter activos de la organización — un email POR persona.
//
// reminder_sent=true SOLO se marca cuando al menos un email salió de verdad.
// Sin RESEND_API_KEY se loggea y se sale SIN marcar — reintentar cada hora es
// barato y así el recordatorio sale solo cuando exista la key (la ventana de
// 8h de ancho nunca deja escapar una entrevista mientras el cron corra).
//
// Tolerante a esquema: si la tabla/relación no coincide en prod, log y 200.

import { getServiceClient } from './lib/supabase.mjs'
import { sendEmail } from './lib/resend.mjs'

const NAVY = '#071B49'
const TEAL = '#00A99D'

// Ventana "mañana": entre 20 y 28 horas en el futuro. Con corridas cada hora
// (ancho 8h > 1h) toda entrevista cae en al menos una corrida.
export const WINDOW_MIN_H = 20
export const WINDOW_MAX_H = 28

export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** ¿scheduled_at cae en la ventana [now+20h, now+28h]? (ISO strings o Date) */
export function inReminderWindow(scheduledAt, now = Date.now()) {
  const t = new Date(scheduledAt).getTime()
  const n = new Date(now).getTime()
  if (!Number.isFinite(t) || !Number.isFinite(n)) return false
  const diffH = (t - n) / 3600000
  return diffH >= WINDOW_MIN_H && diffH <= WINDOW_MAX_H
}

/** Fecha/hora legible en CDMX, p.ej. "lunes 8 de septiembre, 10:30 a.m." */
export function formatCdmx(scheduledAt) {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      weekday: 'long', day: 'numeric', month: 'long',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(scheduledAt))
  } catch {
    return String(scheduledAt)
  }
}

function buildReminderHtml({ vacancyTitle, candidateName, whenCdmx, meetLink, forRecruiter }) {
  const intro = forRecruiter
    ? `<p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.6;">Tienes una entrevista agendada <strong>mañana</strong> con <strong>${esc(candidateName || 'el candidato')}</strong> para la vacante <strong>${esc(vacancyTitle)}</strong>.</p>`
    : `<p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.6;">Hola ${esc(candidateName || '')}, te recordamos tu entrevista de <strong>mañana</strong> para la posición de <strong>${esc(vacancyTitle)}</strong>.</p>`

  const meet = meetLink
    ? `<p style="margin:0 0 14px;font-size:14px;"><a href="${esc(meetLink)}" style="display:inline-block;background:${TEAL};color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Unirse a la videollamada</a></p>`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:${NAVY};border-radius:12px 12px 0 0;padding:20px 24px;">
      <p style="margin:0;color:${TEAL};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Enlace 468 · Recordatorio de entrevista</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:18px;">${esc(vacancyTitle)} — mañana</h1>
    </div>
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px;">
      ${intro}
      <p style="margin:0 0 14px;padding:12px 14px;background:#f0fdfa;border-left:3px solid ${TEAL};color:#134e4a;font-size:14px;border-radius:0 8px 8px 0;"><strong>${esc(whenCdmx)}</strong> (hora CDMX)</p>
      ${meet}
      <p style="margin:0;color:#6b7280;font-size:12px;">Si necesitas reagendar, responde a este correo.</p>
    </div>
    <p style="margin:16px 0 0;text-align:center;color:#9ca3af;font-size:11px;">Enviado con Enlace 468</p>
  </div>
</body></html>`
}

export async function handler() {
  const supabase = getServiceClient()
  const now = Date.now()

  // Sin key no hay envío posible: loggear y salir SIN marcar reminder_sent
  // (reintenta cada hora; cuando exista la key el recordatorio sale solo).
  if (!process.env.RESEND_API_KEY) {
    console.log('[cron-interview-reminders] sin RESEND_API_KEY — skip sin marcar reminder_sent')
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true, reason: 'no_resend_key' }) }
  }

  const from = new Date(now + WINDOW_MIN_H * 3600000).toISOString()
  const to = new Date(now + WINDOW_MAX_H * 3600000).toISOString()

  let interviews
  try {
    const { data, error } = await supabase
      .from('interviews')
      .select(`id, scheduled_at, meet_link, status, reminder_sent,
        vacancy_candidates(id, candidate_id,
          candidates(id, full_name, email),
          vacancies(id, title, organization_id))`)
      .eq('status', 'scheduled')
      .or('reminder_sent.is.null,reminder_sent.eq.false')
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)
    if (error) throw new Error(error.message)
    interviews = data || []
  } catch (e) {
    // Tolerante a esquema distinto en prod: log y 200 — jamás tirar el cron.
    console.error('[cron-interview-reminders] no se pudieron leer interviews:', e.message)
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) }
  }

  if (!interviews.length) {
    console.log('[cron-interview-reminders] sin entrevistas en la ventana 20-28h')
    return { statusCode: 200, body: JSON.stringify({ ok: true, reminders: 0 }) }
  }

  const recruitersByOrg = new Map() // orgId → [{email, full_name}]
  async function getRecruiters(orgId) {
    if (!recruitersByOrg.has(orgId)) {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('organization_id', orgId)
        .in('role', ['admin', 'recruiter'])
        .eq('is_active', true)
      if (error) console.error(`[cron-interview-reminders] profiles org ${orgId}:`, error.message)
      recruitersByOrg.set(orgId, (data || []).filter(p => p.email))
    }
    return recruitersByOrg.get(orgId)
  }

  const summary = []
  for (const iv of interviews) {
    try {
      // Defensa extra en JS por si el filtro SQL y el reloj del runtime difieren.
      if (!inReminderWindow(iv.scheduled_at, now)) continue

      const vc = iv.vacancy_candidates
      const candidate = vc?.candidates
      const vacancy = vc?.vacancies
      const orgId = vacancy?.organization_id
      if (!orgId) {
        console.warn(`[cron-interview-reminders] entrevista ${iv.id} sin organización resoluble — skip`)
        continue
      }

      const vacancyTitle = vacancy?.title || 'la vacante'
      const whenCdmx = formatCdmx(iv.scheduled_at)
      const subject = `Recordatorio: entrevista ${vacancyTitle} mañana ${whenCdmx}`
      let sentCount = 0

      // 1. Candidato (si tiene email).
      let candidateSent = null
      if (candidate?.email) {
        candidateSent = await sendEmail({
          to: candidate.email,
          subject,
          html: buildReminderHtml({ vacancyTitle, candidateName: candidate.full_name, whenCdmx, meetLink: iv.meet_link, forRecruiter: false }),
        })
        if (candidateSent.ok) sentCount++
      }

      // 2. Reclutadores admin/recruiter activos de la org — uno por persona.
      const recruiters = await getRecruiters(orgId)
      for (const rec of recruiters) {
        const res = await sendEmail({
          to: rec.email,
          subject,
          html: buildReminderHtml({ vacancyTitle, candidateName: candidate?.full_name, whenCdmx, meetLink: iv.meet_link, forRecruiter: true }),
        })
        if (res.ok) sentCount++
      }

      // 3. Marcar SOLO si algo salió de verdad (si Resend hizo skip/falló todo,
      //    la siguiente corrida horaria reintenta mientras siga en ventana).
      if (sentCount > 0) {
        const { error: uErr } = await supabase.from('interviews').update({ reminder_sent: true }).eq('id', iv.id)
        if (uErr) console.error(`[cron-interview-reminders] no se pudo marcar reminder_sent en ${iv.id}:`, uErr.message)

        // Log en communications (el email del candidato; los reclutadores van
        // en metadata — communications modela la conversación con el candidato).
        const { error: cErr } = await supabase.from('communications').insert({
          organization_id: orgId,
          candidate_id: candidate?.id || vc?.candidate_id || null,
          vacancy_candidate_id: vc?.id || null,
          channel: 'email',
          direction: 'outbound',
          template_key: 'interview_reminder',
          subject,
          body: `Recordatorio de entrevista para ${vacancyTitle}: ${whenCdmx} (CDMX)${iv.meet_link ? ` · ${iv.meet_link}` : ''}`,
          status: candidateSent?.ok ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
          metadata: { interview_id: iv.id, candidate_emailed: !!candidateSent?.ok, recruiters_emailed: sentCount - (candidateSent?.ok ? 1 : 0) },
        })
        if (cErr) console.error(`[cron-interview-reminders] no se pudo loggear communications (${iv.id}):`, cErr.message)
      }

      console.log(`[cron-interview-reminders] entrevista ${iv.id} (${vacancyTitle}): ${sentCount} email(s) enviados${sentCount ? ', reminder_sent=true' : ' — reintenta la próxima hora'}`)
      summary.push({ interview: iv.id, sent: sentCount, marked: sentCount > 0 })
    } catch (e) {
      console.error(`[cron-interview-reminders] error en entrevista ${iv.id}: ${e.message}`)
      summary.push({ interview: iv.id, error: e.message })
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, reminders: summary.length, summary }) }
}
