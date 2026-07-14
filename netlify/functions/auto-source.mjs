// Netlify serverless function: automated per-vacancy sourcing.
//
// Runs SERVER-SIDE (from Netlify, not the user's browser) so the search never
// goes through the recruiter's local proxy/VPN — which is what Google blocks.
// It (1) builds boolean queries from the vacancy, (2) scrapes public SERPs
// (DuckDuckGo / Bing / Google — reusing the extractor from search-candidates),
// (3) drops insurance/investment firms, (4) dedupes, (5) scores each profile vs
// the vacancy and (6) returns only the ranked prospects above a threshold.
//
// Cost: $0 (no search API). Works "best-effort" without a proxy; set PROXY_URL
// to a residential proxy for reliability at volume — no code change needed.
//
// Env (Netlify › Site settings › Environment variables), all OPTIONAL:
//   PROXY_URL   e.g. http://user:pass@gate.smartproxy.com:7000  (residential)
//
// POST body: { vacancy, platform?, minScore?, maxResults? }
// Called by the front at  /api/auto-source  (see netlify.toml redirect).

import { buildSearchEngines } from './search-candidates.mjs'
import { matchExcludedCompany, normalizeText } from '../../src/lib/excludedCompanies.js'
import { buildTargets, scoreProspect } from '../../src/lib/sourcingScore.js'

// Señales de que un perfil /in/ es una EMPRESA/marca, no una persona.
// Se checa contra el NOMBRE (no el headline, que sí puede decir "servicios
// financieros" en un individuo). Substrings elegidos que no aparecen en
// nombres de personas mexicanas.
const COMPANY_HINTS = [
  'consulting', 'consultores', 'consultoria', 'corporativo', 'corporation', 'corporate',
  'holding', 'holdings', 'despacho', 'asociados', 'solutions', 'soluciones', 'group',
  'grupo', 'capital', 'global', 'partners', 'advisory', 'financialgroup', 'company',
  'firma ', 'internacional', 'international', 'sa de cv', 's a de c v', 'servicios financieros',
]
function looksLikeCompany(name) {
  const n = normalizeText(name)
  if (!n) return false
  return COMPANY_HINTS.some(h => n.includes(h))
}

// La descripción a veces es una OFERTA DE EMPLEO que el perfil publicó, no su
// bio → no debe inflar el score. Se detecta y se ignora para el matching.
function looksLikeJobPosting(desc) {
  const d = normalizeText(desc)
  if (!d) return false
  return /\bvacante\b|lo que haras|lo que buscamos|responsabilidades|requisitos|postulate|te ofrecemos|ofrecemos|buscamos|sueldo|prestaciones|contratacion|aplica ahora|configurar y dar soporte/.test(d)
    || /\d{1,2} de \w+ de 20\d\d\s*-/.test(desc) // "18 de abril de 2023 - ..." (fecha de posteo)
}

const PLATFORM_PREFIX = {
  linkedin: 'site:linkedin.com/in',
  occ: 'site:occ.com.mx',
  indeed: 'site:mx.indeed.com',
  computrabajo: 'site:computrabajo.com.mx',
}

/** Build up to 3 complementary queries from the vacancy (no negative operators —
 *  excluded firms are filtered post-fetch, keeping queries scraper-friendly). */
function buildQueries(vacancy, prefix) {
  const loc = vacancy.location || 'México'
  const raw = []
  if (vacancy.title) raw.push(`${vacancy.title} ${loc}`)
  if (vacancy.department) raw.push(`${vacancy.title || ''} ${vacancy.department} ${loc}`.trim())
  const comps = (vacancy.competencies || []).map(c => c?.name).filter(Boolean).slice(0, 2)
  if (comps.length) raw.push(`${vacancy.title || ''} ${comps.join(' ')} ${loc}`.trim())
  if (!raw.length) raw.push(loc)
  return [...new Set(raw)].map(base => `${prefix} ${base}`.trim())
}

/** Derive a display name from a LinkedIn slug (…/in/carlos-alvarado-103b4a215). */
function nameFromSlug(url) {
  const m = String(url).match(/\/in\/([^/?#]+)/i)
  if (!m) return ''
  let slug
  try { slug = decodeURIComponent(m[1]) } catch { slug = m[1] }
  return slug.split('-')
    .filter(p => p && !/^\d+$/.test(p) && !/^[a-f0-9]{6,}$/i.test(p))
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .slice(0, 4).join(' ')
}

/** Strip the SERP breadcrumb ("LinkedIn linkedin.com › in › slug") to get the
 *  real headline text ("Carlos Alvarado - Senior Manager Financial - X"). */
function cleanSerpTitle(rawHtml) {
  let t = rawHtml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
  t = t.replace(/^LinkedIn\b/i, '')
  t = t.replace(/[a-z]{0,3}\.?linkedin\.com/gi, '')
  t = t.replace(/›\s*in\s*›\s*[^\s›]+/gi, '')   // › in › slug
  t = t.replace(/›\s*[a-z]{2}\b/gi, '')          // › en / › es
  t = t.replace(/\s*\|\s*(LinkedIn|Professional Profile|Perfil profesional).*$/i, '') // cola "| LinkedIn"
  t = t.replace(/^[\s›|·\-]+/, '').replace(/\s+/g, ' ').trim()
  // Páginas de login/registro no son perfiles útiles → sin headline
  if (/iniciar sesi|inicio de sesi|sign in|log ?in|join linkedin|regist/i.test(t)) return ''
  return t
}

/** Decode a handful of common HTML entities. */
function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
}

/** Normalize the profile URL from a SERP href. */
function normProfileUrl(href) {
  return href.split('?')[0].split('#')[0].replace(/\/$/, '')
    .replace(/https?:\/\/[a-z]{2,3}\.linkedin\.com/i, 'https://www.linkedin.com')
}

/** Strip LinkedIn boilerplate from a result description snippet. */
function cleanDescription(raw) {
  let d = decodeEntities(raw.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  d = d.replace(/View [^.]*?profile on LinkedIn[^.]*?\.?/i, '')
  d = d.replace(/,?\s*(?:a|the world's largest) professional community[^.]*\.?/i, '')
  d = d.replace(/\s*\d[\d.,]*\s*(?:billion|million|mil)\s*members\.?/i, '')
  return d.replace(/\s+/g, ' ').trim()
}

/** Parse LinkedIn profiles from SERP HTML → { url, name, headline, description }.
 *  Primary path parses Brave's result blocks (rich: clean title + description
 *  with role/experience/location). Falls back to a generic anchor scan for
 *  other engines. The description is the free "enrichment" that lets scores
 *  reach 90+ for genuinely strong matches. */
function parseSerpProfiles(html) {
  const out = []
  const seen = new Set()

  // ── Primary: Brave result blocks ──────────────────────────────
  const blocks = html.split(/<div class="snippet /)
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i]
    const hrefM = b.match(/href="([^"]*linkedin\.com\/in\/[^"]*)"/i)
    if (!hrefM) continue
    const url = normProfileUrl(hrefM[1])
    if (!/\/in\/[^/]{3,}/.test(url) || seen.has(url)) continue

    const titleM = b.match(/search-snippet-title[^"]*"[^>]*title="([^"]*)"/i)
    const headline = titleM ? cleanSerpTitle(decodeEntities(titleM[1])) : ''
    const descM = b.match(/class="content[^"]*line-clamp-dynamic[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    const description = descM ? cleanDescription(descM[1]) : ''
    const name = nameFromSlug(url) || (headline.split(/\s*[-–]\s*/)[0] || '').trim()
    if (!name && !headline && !description) continue
    seen.add(url)
    out.push({ url, name, headline, description })
  }
  if (out.length) return out

  // ── Fallback: generic anchor scan (Google/Bing/DDG) ───────────
  const re = /<a[^>]+href="([^"]*linkedin\.com\/in\/[^"?#]*)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const url = normProfileUrl(m[1])
    if (!/\/in\/[^/]{3,}/.test(url) || seen.has(url)) continue
    seen.add(url)
    const headline = cleanSerpTitle(m[2])
    const name = nameFromSlug(url)
    if (!name && !headline) continue
    out.push({ url, name, headline, description: '' })
  }
  return out
}

/** Lazily build an undici ProxyAgent dispatcher if PROXY_URL is configured. */
async function getDispatcher() {
  if (!process.env.PROXY_URL) return undefined
  try {
    const { ProxyAgent } = await import('undici')
    return new ProxyAgent(process.env.PROXY_URL)
  } catch {
    return undefined
  }
}

/** Scrape one query across the rotating engines, merging candidates from any
 *  engine that yields them. We trust the extraction result, NOT block-word
 *  heuristics (Brave's HTML contains benign "captcha" strings yet returns great
 *  results). Engines that genuinely block simply return 0 candidates. */
async function scrapeQuery(query, dispatcher) {
  const engines = buildSearchEngines(query)
  const merged = []
  const seen = new Set()
  for (const engine of engines) {
    try {
      const res = await fetch(engine.url, {
        headers: engine.headers,
        dispatcher,
        signal: AbortSignal.timeout(11000),
      })
      if (!res.ok) continue
      const html = await res.text()
      if (html.length < 500) continue
      for (const p of parseSerpProfiles(html)) {
        if (!seen.has(p.url)) { seen.add(p.url); merged.push(p) }
      }
      // Un motor con buena cosecha basta; evita golpear los demás de más.
      if (merged.length >= 15) break
    } catch {
      // siguiente motor
    }
  }
  return merged
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

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const vacancy = body.vacancy
  if (!vacancy?.title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'vacancy.title requerido' }) }

  const prefix = PLATFORM_PREFIX[body.platform] || PLATFORM_PREFIX.linkedin
  const minScore = Number.isFinite(body.minScore) ? body.minScore : 50
  const maxResults = Math.min(Math.max(parseInt(body.maxResults, 10) || 40, 1), 100)

  const queries = buildQueries(vacancy, prefix)
  const targets = buildTargets(vacancy)
  const dispatcher = await getDispatcher()

  const seen = new Set()
  const scored = []
  const counts = { found: 0, excluded: 0, companies: 0, belowThreshold: 0, returned: 0 }

  for (const query of queries) {
    const profiles = await scrapeQuery(query, dispatcher)
    for (const p of profiles) {
      if (seen.has(p.url)) continue
      seen.add(p.url)
      counts.found++

      // El headline suele venir "Nombre - Puesto - Empresa"; sepáralo.
      const parts = (p.headline || '').split(/\s*[-–—·|]\s*/).map(s => s.trim()).filter(Boolean)
      const current_title = parts[1] || null
      const current_company = parts[2] || null
      const full_name = p.name || parts[0] || 'Perfil de LinkedIn'
      // Ubicación desde la descripción ("... Location: Miguel Hidalgo ...")
      const locM = (p.description || '').match(/(?:Location|Ubicaci[oó]n|Ubicaci[oó]n actual)\s*[:：]\s*([^.·|]{2,40})/i)
      const location = locM ? locM[1].trim() : null

      // Exclusión sector asegurador / inversiones (ahora también sobre la descripción)
      if (matchExcludedCompany(current_company, current_title, p.headline, p.description, full_name)) {
        counts.excluded++
        continue
      }

      // Filtra páginas de EMPRESA/marca (queremos individuos)
      if (looksLikeCompany(full_name)) {
        counts.companies++
        continue
      }

      // El texto de scoring ahora incluye la descripción enriquecida,
      // salvo que la descripción sea una oferta de empleo (ruido).
      const usefulDesc = looksLikeJobPosting(p.description) ? '' : p.description
      const enriched = [p.headline, usefulDesc].filter(Boolean).join(' · ')
      const prospect = {
        title: p.headline || full_name,
        url: p.url,
        linkedin_url: p.url,
        displayUrl: 'linkedin.com',
        snippet: enriched,
        full_name, current_title, current_company, location,
      }
      const s = scoreProspect(vacancy, prospect, targets)
      if (s.score < minScore) { counts.belowThreshold++; continue }
      scored.push({ ...prospect, score: s.score, matchedComps: s.matchedComps, strengths: s.strengths, gaps: s.gaps })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const results = scored.slice(0, maxResults)
  counts.returned = results.length

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      results, counts, minScore, queries,
      proxied: !!dispatcher,
      ...(counts.found === 0 ? { hint: dispatcher ? 'Los buscadores no devolvieron perfiles (revisa el proxy).' : 'Sin resultados — los buscadores pudieron bloquear la IP del servidor. Configura PROXY_URL residencial para mayor confiabilidad.' } : {}),
    }),
  }
}
