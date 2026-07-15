// Netlify serverless function: genera un mensaje de outreach PERSONALIZADO
// para un candidato, con IA (Anthropic Haiku). El reclutador lo revisa y envía
// (semi-automático → riesgo cero de ban en LinkedIn).
//
// Env (Netlify): ANTHROPIC_API_KEY
// POST body: { candidate, vacancy, channel, tone?, recruiter? }
//   channel: 'linkedin_note' | 'linkedin_message' | 'email' | 'whatsapp'
// Devuelve: { ok, subject?, body }
// Called at /api/outreach-draft

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5-20251001'

const CHANNEL_RULES = {
  linkedin_note: 'Nota de solicitud de conexión de LinkedIn. MÁXIMO 280 caracteres. Sin asunto. Cálida, directa, 1 sola idea + por qué le escribes.',
  linkedin_message: 'Mensaje/InMail de LinkedIn. 4-6 líneas. Sin asunto. Personalizado a su rol, con el gancho de la vacante y un CTA suave (¿te interesa platicar?).',
  email: 'Correo en frío. Devuelve asunto (≤55 caract, sin clickbait) y cuerpo de 5-8 líneas. Profesional pero humano.',
  whatsapp: 'Mensaje de WhatsApp. 3-5 líneas, tono cercano y respetuoso. Sin asunto.',
}

const SYSTEM = `Eres un reclutador senior mexicano experto en headhunting. Escribes mensajes de acercamiento en frío que consiguen respuesta.

Reglas:
- Español de México, natural y humano (NO robótico, NO corporativo acartonado).
- PERSONALIZA con el puesto/empresa actual del candidato (menciónalo con naturalidad).
- Conecta su perfil con el valor de la vacante; no vendas de más, despierta curiosidad.
- CTA claro y de baja fricción (una pregunta abierta).
- NADA de: "espero que este mensaje te encuentre bien", emojis excesivos, MAYÚSCULAS, promesas exageradas, ni sonar a spam.
- No inventes datos que no te dieron (sueldo, nombre de cliente si es confidencial).
- Respeta ESTRICTAMENTE el formato y largo del canal.

Devuelve SOLO un objeto JSON: {"subject": "<solo para email, si no aplica pon "">", "body": "<mensaje>"}`

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOT_CONFIGURED', hint: 'Define ANTHROPIC_API_KEY en Netlify.' }) }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const c = body.candidate || {}
  const v = body.vacancy || {}
  const channel = CHANNEL_RULES[body.channel] ? body.channel : 'linkedin_message'
  const tone = body.tone || 'cálido y profesional'
  if (!c.full_name && !c.current_title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'candidate requerido' }) }

  const userMsg = `CANAL: ${CHANNEL_RULES[channel]}
TONO: ${tone}

CANDIDATO:
- Nombre: ${c.full_name || '(desconocido)'}
- Puesto actual: ${c.current_title || '(no especificado)'}
- Empresa actual: ${c.current_company || '(no especificada)'}
- Ubicación: ${c.location || '(no especificada)'}
- Perfil/headline: ${(c.snippet || c.headline || '').slice(0, 400)}

VACANTE:
- Puesto: ${v.title || '(no especificado)'}
- Empresa/cliente: ${v.company_name || 'nuestra empresa cliente'}
- Ubicación: ${v.location || ''}
- Descripción: ${(v.description || '').slice(0, 600)}
${body.recruiter ? `\nFIRMA (reclutador): ${body.recruiter}` : ''}

Redacta el mensaje.`

  try {
    const client = new Anthropic({ apiKey })
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      temperature: 0.7,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    })
    const text = resp.content.map(b => (b.type === 'text' ? b.text : '')).join('')
    let out
    try {
      const m = text.match(/\{[\s\S]*\}/)
      out = JSON.parse(m ? m[0] : text)
    } catch {
      out = { subject: '', body: text.trim() }
    }
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: true, channel, subject: out.subject || '', body: (out.body || '').trim() }),
    }
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'LLM_ERROR', hint: err.message?.slice(0, 160) }) }
  }
}
