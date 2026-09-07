// Envío de correo transaccional vía Resend (fetch puro, sin dependencias).
// Mismo diseño defensivo que server/src/email.js: si no hay RESEND_API_KEY o
// falla el envío, NO lanza — devuelve { ok:false, skipped/error } y el flujo
// que lo llamó sigue vivo.
//
// Env (Netlify): RESEND_API_KEY, EMAIL_FROM (remitente verificado),
//                EMAIL_REPLY_TO (opcional)

/**
 * @param {{to:string|string[], subject:string, html:string, from?:string, replyTo?:string}} params
 * @returns {Promise<{ok:boolean, skipped?:boolean, reason?:string, id?:string, error?:string}>}
 */
export async function sendEmail({ to, subject, html, from, replyTo } = {}) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, skipped: true, reason: 'no_resend_key' }
  if (!to) return { ok: false, skipped: true, reason: 'no_recipient' }

  const body = {
    from: from || process.env.EMAIL_FROM || 'Enlace 468 <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  }
  const rt = replyTo || process.env.EMAIL_REPLY_TO
  if (rt) body.reply_to = rt

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`resend_${res.status}: ${t.slice(0, 160)}`)
    }
    const data = await res.json().catch(() => ({}))
    return { ok: true, id: data.id }
  } catch (e) {
    console.warn('[resend] no se pudo enviar el correo:', e.message)
    return { ok: false, error: e.message }
  }
}
