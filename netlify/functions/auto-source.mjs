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
import { buildTargets, scoreProspect, detectForeignLocation } from '../../src/lib/sourcingScore.js'

// Señales de que un perfil /in/ es una EMPRESA/marca, no una persona.
// Se checa contra el NOMBRE (no el headline, que sí puede decir "servicios
// financieros" en un individuo). Substrings elegidos que no aparecen en
// nombres de personas mexicanas.
const COMPANY_HINTS = [
  'consulting', 'consultores', 'consultoria', 'corporativo', 'corporation', 'corporate',
  'holding', 'holdings', 'despacho', 'asociados', 'solutions', 'soluciones', 'group',
  'grupo', 'capital', 'global', 'partners', 'advisory', 'financialgroup', 'company',
  'firma ', 'internacional', 'international', 'sa de cv', 's a de c v', 'servicios financieros',
  'financiera ', 'financial group', 'grupo financiero', 'asesores', 'brokers', 'broker',
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

// LinkedIn indexa cada perfil bajo el subdominio de su país (mx., pe., cl., ar…).
// Restringir a mx.linkedin.com es el filtro geográfico más confiable: evita que
// "México" como palabra clave traiga perfiles de toda LatAm.
const PLATFORM_PREFIX = {
  linkedin: 'site:mx.linkedin.com/in',
  occ: 'site:occ.com.mx',
  indeed: 'site:mx.indeed.com',
  computrabajo: 'site:computrabajo.com.mx',
}

/** Build DIVERSE queries from the vacancy so el listado no se repite: variantes
 *  por ubicación, seniority y cada competencia → más perfiles distintos. Sin
 *  operadores negativos (las aseguradoras se filtran después). */
function buildQueries(vacancy, prefix, max = 5) {
  const loc = vacancy.location || 'México'
  const t = (vacancy.title || '').trim()
  const raw = []
  if (t) {
    raw.push(`${t} ${loc}`)
    raw.push(`${t} México`)         // más amplio que la ciudad
    raw.push(t)                      // sin ubicación (máxima cobertura)
    raw.push(`senior ${t} ${loc}`)   // variante seniority
  }
  if (vacancy.department) raw.push(`${t} ${vacancy.department} ${loc}`.trim())
  // Una query por cada competencia (surfacean gente distinta)
  ;(vacancy.competencies || []).map(c => c?.name).filter(Boolean).slice(0, 3)
    .forEach(c => raw.push(`${t} ${c} ${loc}`.trim()))
  if (!raw.length) raw.push(loc)
  return [...new Set(raw.map(s => s.trim()).filter(Boolean))].slice(0, max).map(base => `${prefix} ${base}`.trim())
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

/** País del perfil según el subdominio ORIGINAL del SERP (pe., cl., ar., mx…),
 *  antes de normalizar a www. 'www' = desconocido. */
function countryOfHref(href) {
  const m = String(href).match(/https?:\/\/([a-z]{2,3})\.linkedin\.com/i)
  return m ? m[1].toLowerCase() : 'www'
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
export function parseSerpProfiles(html) {
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
    out.push({ url, name, headline, description, country: countryOfHref(hrefM[1]) })
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
    out.push({ url, name, headline, description: '', country: countryOfHref(m[1]) })
  }
  return out
}

/** Lazily build an undici ProxyAgent dispatcher if PROXY_URL is configured. */
export async function getDispatcher() {
  if (!process.env.PROXY_URL) return undefined
  try {
    const { ProxyAgent } = await import('undici')
    return new ProxyAgent(process.env.PROXY_URL)
  } catch {
    return undefined
  }
}

/** Pool of dispatchers rotating the proxy port (Decodo …:10001-10010) so the
 *  concurrent per-profile verification requests salen por IPs distintas y no
 *  se rate-limitan. */
async function buildProxyPool(size) {
  const base = process.env.PROXY_URL
  if (!base) return [undefined]
  let ProxyAgent
  try { ({ ProxyAgent } = await import('undici')) } catch { return [undefined] }
  const m = base.match(/^(.*:)(\d{4,5})$/)
  const pool = []
  for (let i = 0; i < size; i++) {
    let url = base
    if (m) url = m[1] + (10001 + (i % 10))
    try { pool.push(new ProxyAgent(url)) } catch { pool.push(undefined) }
  }
  return pool
}

function slugOf(url = '') {
  const m = String(url).match(/\/in\/([^/?#]+)/i)
  return m ? m[1] : ''
}

/** Targeted search for ONE profile → richer headline/description (often reveals
 *  the current employer, e.g. an insurer, que el listado amplio no muestra).
 *  Prioriza Brave (el motor que devuelve datos server-side) y reintenta. */
async function enrichProfile(slug, dispatcher) {
  if (!slug) return null
  const engines = buildSearchEngines(`site:linkedin.com/in/${slug}`)
    .sort((a, b) => (a.name === 'Brave' ? -1 : 0) - (b.name === 'Brave' ? -1 : 0))
  const key = slug.slice(0, 12).toLowerCase()
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const engine of engines) {
      try {
        const res = await fetch(engine.url, { headers: engine.headers, dispatcher, signal: AbortSignal.timeout(8000) })
        if (!res.ok) continue
        const html = await res.text()
        if (html.length < 500) continue
        const profs = parseSerpProfiles(html)
        const p = profs.find(x => x.url.toLowerCase().includes(key)) || profs[0]
        if (p && (p.headline || p.description)) return p
      } catch { /* siguiente motor */ }
    }
  }
  return null
}

/** Scrape one query across the rotating engines, merging candidates from any
 *  engine that yields them. We trust the extraction result, NOT block-word
 *  heuristics (Brave's HTML contains benign "captcha" strings yet returns great
 *  results). Engines that genuinely block simply return 0 candidates. */
async function scrapeQuery(query, dispatcher) {
  // Brave primero (es el que devuelve datos server-side) → evita perder segundos
  // en motores que fallan antes de llegar a él.
  const engines = buildSearchEngines(query)
    .sort((a, b) => (a.name === 'Brave' ? -1 : 0) - (b.name === 'Brave' ? -1 : 0))
  const merged = []
  const seen = new Set()
  for (const engine of engines) {
    try {
      const res = await fetch(engine.url, {
        headers: engine.headers,
        dispatcher,
        signal: AbortSignal.timeout(7000),
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
  const t0 = Date.now()
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
  // Exclusión sector asegurador/inversiones: ON por defecto (crítico para
  // Prudential); el front puede apagarla cuando SÍ quieren gente del sector.
  const excludeSector = body.excludeSector !== false
  // Filtro geográfico: fuera perfiles de otros países (Perú, Chile, Argentina…).
  // ON por defecto; el front puede apagarlo para vacantes fuera de México.
  const excludeForeign = body.excludeForeign !== false
  // URLs ya conocidas (banco/bloqueados) → se excluyen server-side para devolver
  // solo candidatos NUEVOS (clave cuando el banco ya tiene decenas de perfiles).
  const known = new Set((Array.isArray(body.excludeUrls) ? body.excludeUrls : [])
    .map(u => String(u).split('?')[0].replace(/\/$/, '')))

  const queries = buildQueries(vacancy, prefix)
  const targets = buildTargets(vacancy)
  const dispatcher = await getDispatcher()

  const seen = new Set()
  const scored = []
  const counts = { found: 0, known: 0, excluded: 0, companies: 0, foreign: 0, belowThreshold: 0, returned: 0 }

  // Búsquedas base en PARALELO (cada una por una IP distinta) → mucho más rápido.
  const pool = await buildProxyPool(Math.max(queries.length, 8))
  const perQuery = await Promise.all(
    queries.map((q, i) => scrapeQuery(q, pool[i % pool.length] || dispatcher).catch(() => []))
  )
  const allProfiles = []
  for (const list of perQuery) {
    for (const p of list) {
      if (!seen.has(p.url)) { seen.add(p.url); allProfiles.push(p) }
    }
  }

  {
    for (const p of allProfiles) {
      counts.found++

      // Salta los ya conocidos (banco/bloqueados) → solo devolvemos nuevos.
      if (known.has((p.url || '').split('?')[0].replace(/\/$/, ''))) { counts.known++; continue }

      // Filtro geográfico: (1) subdominio del SERP ≠ mx/www → vive en otro país;
      // (2) el texto menciona otro país de LatAm/España sin mencionar México.
      if (excludeForeign) {
        const foreignSubdomain = p.country && p.country !== 'mx' && p.country !== 'www'
        const foreignText = detectForeignLocation(`${p.headline || ''} ${p.description || ''}`)
        if (foreignSubdomain || foreignText) { counts.foreign++; continue }
      }

      // El headline suele venir "Nombre - Puesto - Empresa"; sepáralo.
      const parts = (p.headline || '').split(/\s*[-–—·|]\s*/).map(s => s.trim()).filter(Boolean)
      const current_title = parts[1] || null
      const current_company = parts[2] || null
      const full_name = p.name || parts[0] || 'Perfil de LinkedIn'
      // Ubicación desde la descripción ("... Location: Miguel Hidalgo ...")
      const locM = (p.description || '').match(/(?:Location|Ubicaci[oó]n|Ubicaci[oó]n actual)\s*[:：]\s*([^.·|]{2,40})/i)
      const location = locM ? locM[1].trim() : null

      // Exclusión sector asegurador / inversiones (ahora también sobre la descripción)
      if (excludeSector && matchExcludedCompany(current_company, current_title, p.headline, p.description, full_name)) {
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
  let results = scored.slice(0, maxResults)

  // ── Verificación por perfil (sin Apollo) ──────────────────────
  // Muchos que trabajan en aseguradoras (New York Life/SMNYL) NO muestran a su
  // empleador en el listado amplio (descripción bloqueada). Hacemos una búsqueda
  // dirigida a cada uno de los que van a salir para revelar su empresa real y
  // re-aplicar la exclusión. Concurrente, con IPs rotadas, acotado por tiempo.
  // Guarda de tiempo: si la búsqueda base ya tardó mucho, saltamos la
  // verificación para no exceder el límite de Netlify (~26s).
  const elapsed = Date.now() - t0
  if (excludeSector && dispatcher && results.length && elapsed < 16000) {
    const ENRICH_CAP = 6
    const toCheck = results.slice(0, ENRICH_CAP)
    const settled = await Promise.allSettled(
      toCheck.map((r, i) => enrichProfile(slugOf(r.url), pool[i % pool.length]))
    )
    const dropped = new Set()
    settled.forEach((e, i) => {
      if (e.status !== 'fulfilled' || !e.value) return
      const r = toCheck[i]
      const p = e.value
      const parts = (p.headline || '').split(/\s*[-–—·|]\s*/).map(s => s.trim()).filter(Boolean)
      const ct = parts[1] || r.current_title
      const cc = parts[2] || r.current_company
      // La búsqueda dirigida puede revelar que vive en otro país → bloqueado.
      if (excludeForeign && detectForeignLocation(`${p.headline || ''} ${p.description || ''}`)) {
        dropped.add(r.url)
        counts.foreign++
        return
      }
      if (matchExcludedCompany(cc, ct, p.headline, p.description, r.full_name)) {
        dropped.add(r.url)
        counts.excluded++
      } else {
        // Aprovecha para enriquecer los datos mostrados
        if (parts[1]) r.current_title = parts[1]
        if (parts[2]) r.current_company = parts[2]
      }
    })
    if (dropped.size) results = results.filter(r => !dropped.has(r.url))
  }

  counts.returned = results.length

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      results, counts, minScore, queries, excludeSector, excludeForeign,
      proxied: !!dispatcher,
      ...(counts.found === 0 ? { hint: dispatcher ? 'Los buscadores no devolvieron perfiles (revisa el proxy).' : 'Sin resultados — los buscadores pudieron bloquear la IP del servidor. Configura PROXY_URL residencial para mayor confiabilidad.' } : {}),
    }),
  }
}
