// Netlify serverless function: genera un link de Unipile (hosted auth) para
// CONECTAR / cambiar la cuenta de LinkedIn del reclutador. Se abre en el
// navegador, el reclutador inicia sesión y su cuenta queda conectada.
//
// Env (Netlify): UNIPILE_API_KEY, UNIPILE_DSN
// POST /api/linkedin-connect  → { ok, url }

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
  if (!KEY || !DSN) return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOT_CONFIGURED', hint: 'Faltan credenciales de Unipile.' }) }

  const apiUrl = `https://${DSN}`
  const expiresOn = new Date(Date.now() + 2 * 86400000).toISOString().replace(/\.\d+Z$/, '.000Z')

  let successRedirect
  try { successRedirect = (JSON.parse(event.body || '{}').redirect_url) } catch { /* opcional */ }

  try {
    const res = await fetch(`${apiUrl}/api/v1/hosted/accounts/link`, {
      method: 'POST',
      headers: { 'X-API-KEY': KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        type: 'create',
        providers: ['LINKEDIN'],
        api_url: apiUrl,
        expiresOn,
        ...(successRedirect ? { success_redirect_url: successRedirect } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.url) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'CONNECT_FAILED', hint: data.detail || data.message || `HTTP ${res.status}` }) }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, url: data.url }) }
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'UNIPILE_ERROR', hint: err.message?.slice(0, 160) }) }
  }
}
