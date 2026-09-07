// Helpers compartidos para la API de Unipile (LinkedIn sin scraping).
// Env (Netlify): UNIPILE_API_KEY, UNIPILE_DSN (host:port), UNIPILE_ACCOUNT_ID

/** Lee la config de Unipile del entorno (con account_id opcional del request). */
export function getUnipileConfig(overrideAccountId) {
  const key = process.env.UNIPILE_API_KEY
  const dsn = process.env.UNIPILE_DSN
  const accountId = overrideAccountId || process.env.UNIPILE_ACCOUNT_ID
  return { key, dsn, accountId, configured: Boolean(key && dsn && accountId) }
}

/**
 * Crea helpers de fetch atados a una config { key, dsn }:
 *  - request(path, opts): fetch crudo con headers de auth + timeout 25s
 *  - getJson(path): GET que resuelve a { ok, data } (data = {} si el JSON falla)
 */
export function createUnipile({ key, dsn }) {
  const base = `https://${dsn}/api/v1`
  const request = (path, opts = {}) => fetch(`${base}${path}`, {
    ...opts,
    headers: { 'X-API-KEY': key, 'accept': 'application/json', 'content-type': 'application/json', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(25000),
  })
  const getJson = (path) => request(path)
    .then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
  return { base, request, getJson }
}
