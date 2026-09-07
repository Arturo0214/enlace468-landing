// Netlify serverless function: genera un mensaje de outreach PERSONALIZADO
// para un candidato, con IA (Anthropic Haiku). El reclutador lo revisa y envía
// (semi-automático → riesgo cero de ban en LinkedIn).
//
// Env (Netlify): ANTHROPIC_API_KEY
// POST body: { candidate, vacancy, channel, tone?, recruiter? }
//   channel: 'linkedin_note' | 'linkedin_message' | 'email' | 'whatsapp'
// Devuelve: { ok, subject?, body }
// Called at /api/outreach-draft

import { generateDraft, CHANNEL_RULES } from './lib/draft.mjs'

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
  if (!c.full_name && !c.current_title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'candidate requerido' }) }

  try {
    const draft = await generateDraft(c, v, channel, { tone: body.tone, recruiter: body.recruiter, apiKey })
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: true, channel: draft.channel, subject: draft.subject, body: draft.body }),
    }
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'LLM_ERROR', hint: err.message?.slice(0, 160) }) }
  }
}
