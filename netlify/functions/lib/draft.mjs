// Generación de mensajes de outreach personalizados con IA (Anthropic Haiku).
// Extraído de outreach-draft.mjs sin cambiar comportamiento, para reuso en
// crons/secuencias (Fases 1 y 5).
//
// Env: ANTHROPIC_API_KEY

import Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'claude-haiku-4-5-20251001'

export const CHANNEL_RULES = {
  linkedin_note: 'Nota de solicitud de conexión de LinkedIn. MÁXIMO 195 caracteres (LinkedIn corta en 200). MUY concisa: 1 idea + por qué le escribes + tu nombre. Sin asunto.',
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

/**
 * Genera un borrador de outreach para un candidato/vacante/canal.
 * Lanza si la llamada al LLM falla (el caller decide la respuesta HTTP).
 *
 * @param {object} candidate  { full_name, current_title, current_company, location, snippet|headline }
 * @param {object} vacancy    { title, company_name, location, description }
 * @param {string} channel    'linkedin_note' | 'linkedin_message' | 'email' | 'whatsapp'
 * @param {{tone?:string, recruiter?:string, apiKey?:string}} [opts]
 * @returns {Promise<{channel:string, subject:string, body:string}>}
 */
export async function generateDraft(candidate = {}, vacancy = {}, channel, opts = {}) {
  const c = candidate
  const v = vacancy
  const chan = CHANNEL_RULES[channel] ? channel : 'linkedin_message'
  const tone = opts.tone || 'cálido y profesional'

  const userMsg = `CANAL: ${CHANNEL_RULES[chan]}
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
${opts.recruiter ? `\nFIRMA (reclutador): ${opts.recruiter}` : ''}

Redacta el mensaje.`

  const client = new Anthropic({ apiKey: opts.apiKey || process.env.ANTHROPIC_API_KEY })
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
  let finalBody = (out.body || '').trim()
  // Garantiza el límite de LinkedIn (nota de conexión ≤200) recortando en
  // frontera de palabra, ya que el modelo a veces se pasa.
  if (chan === 'linkedin_note' && finalBody.length > 200) {
    const head = finalBody.slice(0, 200)
    // Prefiere terminar en frase completa (., ? o !); si no, en palabra.
    const ends = [head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '),
                  head.lastIndexOf('.'), head.lastIndexOf('?'), head.lastIndexOf('!')]
    const sentenceCut = Math.max(...ends)
    if (sentenceCut > 110) finalBody = head.slice(0, sentenceCut + 1)
    else { const w = head.lastIndexOf(' '); finalBody = head.slice(0, w > 110 ? w : 197).replace(/[\s,.-]+$/, '') + '…' }
  }
  return { channel: chan, subject: out.subject || '', body: finalBody }
}
