// Netlify serverless function: envía una CONEXIÓN (con nota) o un INMAIL en
// LinkedIn vía Unipile (API oficial-grade, sin scraping ni navegador). El
// mensaje suele venir del generador de IA (outreach-draft).
//
// Env (Netlify): UNIPILE_API_KEY, UNIPILE_DSN (host:port), UNIPILE_ACCOUNT_ID
// POST body: { url | public_id, message, subject?, action: 'connect'|'inmail', account_id? }
// Called at /api/linkedin-send
//
// OJO: acción hacia afuera e irreversible. La dispara el reclutador (1 clic).

function extractSlug(url = '') {
  const m = String(url).match(/\/in\/([^/?#]+)/i)
  if (m) { try { return decodeURIComponent(m[1]) } catch { return m[1] } }
  const bare = String(url).trim().match(/^([\w\-.%]+)$/)
  return bare ? bare[1] : null
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  const KEY = process.env.UNIPILE_API_KEY
  const DSN = process.env.UNIPILE_DSN
  const accountId = (JSON.parse(event.body || '{}').account_id) || process.env.UNIPILE_ACCOUNT_ID
  if (!KEY || !DSN || !accountId) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOT_CONFIGURED', hint: 'Faltan UNIPILE_API_KEY / UNIPILE_DSN / UNIPILE_ACCOUNT_ID.' }) }
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const action = body.action === 'inmail' ? 'inmail' : 'connect'
  const message = (body.message || '').trim()
  const subject = (body.subject || '').trim()
  const identifier = body.public_id || extractSlug(body.url || '')
  if (!identifier) return { statusCode: 400, headers, body: JSON.stringify({ error: 'INVALID_URL', hint: 'Falta URL/identificador de LinkedIn.' }) }
  if (action === 'connect' && message.length > 200) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'NOTE_TOO_LONG', hint: `La nota de conexión no puede exceder 200 caracteres (tiene ${message.length}).` }) }
  }

  const base = `https://${DSN}/api/v1`
  const uni = (path, opts = {}) => fetch(`${base}${path}`, {
    ...opts,
    headers: { 'X-API-KEY': KEY, 'accept': 'application/json', 'content-type': 'application/json', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(25000),
  })

  try {
    // 1) Resolver el perfil → provider_id + distancia de red
    const uRes = await uni(`/users/${encodeURIComponent(identifier)}?account_id=${accountId}`)
    const user = await uRes.json().catch(() => ({}))
    if (!uRes.ok || !user.provider_id) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'RESOLVE_FAILED', hint: user.detail || user.message || 'No se pudo leer el perfil en LinkedIn.' }) }
    }
    const providerId = user.provider_id
    const name = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()

    // Ya conectado → no reenviar solicitud
    if (action === 'connect' && (user.network_distance === 'FIRST_DEGREE' || user.is_relationship)) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, alreadyConnected: true, name, hint: 'Ya es contacto de primer grado — mándale mensaje directo en vez de conexión.' }) }
    }

    if (action === 'connect') {
      // 2a) Enviar solicitud de conexión con nota
      const res = await uni('/users/invite', {
        method: 'POST',
        body: JSON.stringify({ provider_id: providerId, account_id: accountId, message: message || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'INVITE_FAILED', hint: data.detail || data.message || `Unipile ${res.status}`, name }) }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, action: 'connect', name, providerId, result: data }) }
    }

    // 2b) InMail (mensaje sin conexión) → nuevo chat. Requiere Premium/Sales Nav.
    const res = await uni('/chats', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, attendees_ids: [providerId], text: message, subject: subject || undefined, inmail: true }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'INMAIL_FAILED', hint: data.detail || data.message || `Unipile ${res.status} (¿la cuenta tiene InMail/Sales Navigator?)`, name }) }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, action: 'inmail', name, providerId, result: data }) }
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'UNIPILE_ERROR', hint: err.message?.slice(0, 160) }) }
  }
}
