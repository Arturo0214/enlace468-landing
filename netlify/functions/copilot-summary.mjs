// Netlify function: resumen en lenguaje natural del COPILOTO (FASE B, §2.4).
//
// POST /api/copilot-summary
// Headers: Authorization: Bearer <access_token de Supabase del usuario>
// Body: {
//   organization_id: uuid,   // debe coincidir con el profile del token
//   focusList: [{ type, severity, candidateName, message, ... }],  (máx 200)
//   pace?: { sentToday, neededPerDay, status, ... },
// }
// Devuelve: { ok, summary, source: 'ai'|'template' }
//
// La lista priorizada la calcula el motor DETERMINISTA (src/lib/copilot.js) en
// el cliente; aquí solo se REDACTA un párrafo de 2-3 frases en español con
// Anthropic Haiku. Sin ANTHROPIC_API_KEY → resumen por template (graceful).
//
// Seguridad: JWT validado con supabase.auth.getUser(token) + pertenencia a la
// organization_id (mismo patrón que send-email.mjs). Nunca se confía en el body.

import Anthropic from '@anthropic-ai/sdk'
import { getServiceClient } from './lib/supabase.mjs'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_FOCUS = 200

const TYPE_LABEL = {
  sla_breach: 'atorado(s) por tiempo en etapa',
  no_response: 'sin respuesta a tu mensaje',
  psychometric_pending: 'psicométrico(s) pendiente(s)',
  docs_incomplete: 'con documentos incompletos',
  cnsf_unpaid: 'sin pago del examen CNSF',
  cnsf_no_date: 'sin fecha de examen CNSF',
}

/** Cuenta focos por tipo y por severidad. Puro y reutilizable en el template. */
export function tallyFocus(focusList) {
  const byType = {}
  const bySeverity = { alta: 0, media: 0, baja: 0 }
  for (const f of Array.isArray(focusList) ? focusList : []) {
    if (!f || !f.type) continue
    byType[f.type] = (byType[f.type] || 0) + 1
    if (f.severity && bySeverity[f.severity] != null) bySeverity[f.severity]++
  }
  return { total: (Array.isArray(focusList) ? focusList : []).length, byType, bySeverity }
}

/** Resumen de respaldo sin IA — frases armadas por template. */
export function templateSummary(focusList, pace) {
  const t = tallyFocus(focusList)
  if (t.total === 0) {
    const paceLine = paceSentence(pace)
    return `No tienes focos pendientes por ahora.${paceLine ? ' ' + paceLine : ''}`.trim()
  }
  const parts = Object.entries(t.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${n} ${TYPE_LABEL[type] || type}`)
  const head = t.total === 1
    ? `Hoy tienes 1 foco: ${parts[0]}.`
    : `Hoy tienes ${t.total} focos: ${parts.slice(0, 3).join(', ')}${parts.length > 3 ? '…' : ''}.`
  const sev = t.bySeverity.alta > 0
    ? ` ${t.bySeverity.alta} de severidad alta — atiéndelos primero.`
    : ''
  const paceLine = paceSentence(pace)
  return `${head}${sev}${paceLine ? ' ' + paceLine : ''}`.trim()
}

function paceSentence(pace) {
  if (!pace || pace.neededPerDay == null) return ''
  const { sentToday = 0, neededPerDay, status } = pace
  if (status === 'verde') return `Vas al ritmo de conexiones del mes (${sentToday}/${neededPerDay} hoy).`
  const gap = Math.max(0, neededPerDay - sentToday)
  return `Vas ${status === 'rojo' ? 'muy por debajo' : 'algo abajo'} del ritmo de conexiones: ${sentToday}/${neededPerDay} hoy, te faltan ${gap}.`
}

const SYSTEM = `Eres el copiloto de una plataforma de reclutamiento en México. Resumes en 2-3 frases, en español de México, natural y directo, en qué debe enfocarse HOY el reclutador.

Reglas:
- Máximo 3 frases. Concreto y accionable, sin relleno ni saludos.
- Prioriza lo de severidad alta y menciona el ritmo de conexiones si viene.
- No inventes datos que no estén en el resumen que te doy.
- Tono de colega experto, ni robótico ni corporativo.

Devuelve SOLO el párrafo, sin viñetas ni JSON.`

async function aiSummary({ tally, pace, sample, apiKey }) {
  const client = new Anthropic({ apiKey })
  const paceStr = pace && pace.neededPerDay != null
    ? `Ritmo de conexiones hoy: ${pace.sentToday ?? 0}/${pace.neededPerDay} (semáforo ${pace.status}).`
    : 'Sin dato de ritmo de conexiones.'
  const typeStr = Object.entries(tally.byType)
    .map(([type, n]) => `${n} ${TYPE_LABEL[type] || type}`)
    .join('; ') || 'ninguno'

  const userMsg = `FOCOS DE HOY (${tally.total} en total; ${tally.bySeverity.alta} alta, ${tally.bySeverity.media} media, ${tally.bySeverity.baja} baja):
${typeStr}.
${paceStr}

Ejemplos de focos concretos:
${sample.map(s => `- ${s}`).join('\n') || '(sin ejemplos)'}

Redacta el resumen del día.`

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    temperature: 0.4,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMsg }],
  })
  return resp.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
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

  if (!body.organization_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'organization_id requerido' }) }
  const focusList = (Array.isArray(body.focusList) ? body.focusList : []).slice(0, MAX_FOCUS)
  const pace = body.pace || null

  // ── Auth: JWT del usuario + pertenencia a la organización ──
  const token = (event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authorization Bearer requerido' }) }

  const supabase = getServiceClient()
  const { data: userData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !userData?.user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido o expirado' }) }

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, organization_id, is_active')
    .eq('id', userData.user.id)
    .single()
  if (pErr || !profile) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Perfil no encontrado' }) }
  if (!profile.is_active || profile.organization_id !== body.organization_id) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'No perteneces a esa organización' }) }
  }

  // ── Sin key de Anthropic: resumen por template (graceful) ──
  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, summary: templateSummary(focusList, pace), source: 'template' }) }
  }

  const tally = tallyFocus(focusList)
  const sample = focusList
    .slice(0, 6)
    .map(f => `${f.candidateName || 'Candidato'} — ${f.message || f.type}`)

  try {
    const summary = await aiSummary({ tally, pace, sample, apiKey: process.env.ANTHROPIC_API_KEY })
    if (!summary) throw new Error('respuesta vacía')
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, summary, source: 'ai' }) }
  } catch (err) {
    // Fallback silencioso al template si el LLM falla.
    console.error('[copilot-summary] LLM falló, usando template:', err.message?.slice(0, 160))
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, summary: templateSummary(focusList, pace), source: 'template' }) }
  }
}
