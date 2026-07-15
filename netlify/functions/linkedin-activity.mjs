// Netlify serverless function: actividad de LinkedIn (outreach) vía Unipile.
// Devuelve las invitaciones ENVIADAS (pendientes) con su mensaje, fecha y a
// quién — para el tablero de la sección de sourcing.
//
// Env (Netlify): UNIPILE_API_KEY, UNIPILE_DSN, UNIPILE_ACCOUNT_ID
// GET /api/linkedin-activity   (o POST { account_id? })

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  const KEY = process.env.UNIPILE_API_KEY
  const DSN = process.env.UNIPILE_DSN
  let accountId = process.env.UNIPILE_ACCOUNT_ID
  try { const b = JSON.parse(event.body || '{}'); if (b.account_id) accountId = b.account_id } catch { /* GET */ }
  if (event.queryStringParameters?.account_id) accountId = event.queryStringParameters.account_id
  if (!KEY || !DSN || !accountId) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOT_CONFIGURED', hint: 'Faltan credenciales de Unipile.' }) }
  }

  const base = `https://${DSN}/api/v1`
  try {
    const res = await fetch(`${base}/users/invite/sent?account_id=${accountId}&limit=100`, {
      headers: { 'X-API-KEY': KEY, accept: 'application/json' },
      signal: AbortSignal.timeout(25000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'UNIPILE_ERROR', hint: data.detail || data.message || `HTTP ${res.status}` }) }

    const invitations = (data.items || []).map(it => ({
      id: it.id,
      name: it.invited_user,
      public_id: it.invited_user_public_id,
      provider_id: it.invited_user_id,
      photo: it.invited_user_profile_picture_url || null,
      message: it.invitation_text || '',
      date: it.parsed_datetime || it.date,
      status: 'pending', // en la lista "sent" solo hay pendientes; al aceptarse salen
    }))
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count: invitations.length, invitations }) }
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'UNIPILE_ERROR', hint: err.message?.slice(0, 160) }) }
  }
}
