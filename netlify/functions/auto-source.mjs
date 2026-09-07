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

// Señales de que un perfil /in/ es una EMPRESA/marca, no una persona
// (reporte de Karina 2026-08-28/31: "me manda consultorías, no personas" —
// se colaban "Medios Inmobiliaria", "Neo Credit", "Tu Asesor Hipotecario",
// agencias de reclutamiento…). Se checa contra el NOMBRE (no el headline, que
// sí puede decir "servicios financieros" en un individuo). Tres capas:
//
// 1. FRASES/TOKENS FUERTES: jamás aparecen en el nombre de una persona.
// 2. Prefijos de marca ("Tu X", "Mi X", "Somos X").
// 3. PALABRAS DE GIRO: sí pueden aparecer en el slug de una persona que se
//    "brandea" (luis-hernandez-asesor-hipotecario) → se QUITAN del nombre y
//    si no queda un nombre humano (2+ palabras), es una marca.
const STRONG_PHRASES = [
  'sa de cv', 's a de c v', 's de rl', 'servicios financieros', 'financial group',
  'grupo financiero', 'bienes raices', 'real estate', 'recursos humanos',
  'casa de bolsa', 'firma ',
]
const STRONG_TOKENS = new Set([
  'consulting', 'consultores', 'consultoria', 'corporativo', 'corporation', 'corporate',
  'holding', 'holdings', 'despacho', 'asociados', 'solutions', 'soluciones', 'group',
  'grupo', 'capital', 'global', 'partners', 'advisory', 'financialgroup', 'company',
  'internacional', 'international', 'financiera', 'financieras', 'asesores', 'brokers',
  'broker', 'inmobiliaria', 'inmobiliarias', 'hipotecaria', 'hipotecarias', 'seguros',
  'aseguradora', 'afianzadora', 'agencia', 'agency', 'agencias', 'staffing',
  'headhunter', 'headhunters', 'headhunting', 'reclutamiento', 'recruitment',
  'recruiting', 'realty', 'properties', 'propiedades', 'inc', 'llc', 'ltd', 'sapi',
  'corp', 'promotoria', 'inversiones', 'firm',
])
const TRADE_TOKENS = new Set([
  // giro/oficio que la gente pone en su slug — no bastan solos para ser persona
  'asesor', 'asesora', 'asesoria', 'consultor', 'consultora', 'hipotecario', 'hipotecarios',
  'inmobiliario', 'inmobiliarios', 'credito', 'creditos', 'credit', 'financiero',
  'financieros', 'finanzas', 'finance', 'financial', 'patrimonial', 'ejecutivo',
  'ejecutiva', 'agente', 'gerente', 'director', 'directora', 'general',
  'vendedor', 'vendedora', 'ventas', 'marketing', 'digital', 'medios', 'legal',
  'juridico', 'fiscal', 'contable', 'experto', 'experta', 'coach', 'oficial',
  'equipo', 'team', 'servicios', 'services', 'solutions', 'express', 'online',
  // giros/marcas frecuentes en páginas de empresa con URL /in/
  'negocios', 'centro', 'bolsa', 'hipoteca', 'hipotecas', 'patrimonio',
  'vivienda', 'inmuebles', 'propiedades', 'invierte', 'inversion', 'academia',
  'instituto', 'escuela', 'cursos', 'seguro', 'prestamos', 'prestamo',
  // conectores y genéricos
  'tu', 'mi', 'su', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'para',
  'con', 'sin', 'desde', 'cero', 'mx', 'mexico', 'cdmx', 'and', 'the', 'casa',
  'hogar', 'punto',
])
export function looksLikeCompany(name) {
  const n = normalizeText(name).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!n) return false
  if (STRONG_PHRASES.some(h => n.includes(h))) return true
  const toks = n.split(' ')
  if (toks.some(t => STRONG_TOKENS.has(t))) return true
  if (/^(tu|mi|somos)\s/.test(n)) return true
  // Slug de marca concatenado ("brokerhipotecario", "creditosfacilmx"): en
  // nombres de UN solo token las palabras fuertes cuentan como substring.
  if (toks.length === 1 && ['broker', 'inmobiliaria', 'hipotecaria', 'seguros', 'consultoria', 'agencia', 'financiera', 'creditos', 'staffing', 'realty'].some(h => toks[0].includes(h))) return true
  // "Neo Credit" → quita 'credit' → queda "Neo" (1) → marca.
  // "Luis Hernandez Asesor Hipotecario" → quedan "Luis Hernandez" (2) → persona.
  const rest = toks.filter(t => !TRADE_TOKENS.has(t))
  if (rest.length < 2 && rest.length < toks.length) return true
  return false
}

// ¿El texto parece nombre de PERSONA presentable? (2-6 palabras alfabéticas).
// Los slugs concatenados ("rgamezg", "hdezfr", "pedroalvarezconsultor…") no lo
// son — esas tarjetas sin nombre real son los "perfiles basura" del reporte de
// Karina/Arturo 2026-08-31: no se puede ni saludar al candidato.
export function looksLikeHumanName(s) {
  const n = normalizeText(s || '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!n) return false
  const toks = n.split(' ').filter(t => t.length >= 2)
  if (toks.length < 2 || toks.length > 6) return false
  if (/linkedin|perfil de|profile/.test(n)) return false
  return true
}

// La descripción a veces es una OFERTA DE EMPLEO que el perfil publicó, no su
// bio → no debe inflar el score. Se detecta y se ignora para el matching.
// Señales de EMPRENDEDOR / dueño de negocio en headline+descripción (pedido de
// Ingrid: convierten mejor porque no les da miedo emprender).
const ENTREPRENEUR_RE = /\b(fundador|fundadora|co-?fundador|co-?fundadora|founder|co-?founder|emprendedor|emprendedora|entrepreneur|due[ñn][oa] de|propietari[oa]|business owner|owner at|negocio propio|mi (?:propi[oa] )?(?:negocio|empresa)|socio fundador|director general y fundador)\b/i
function isEntrepreneurProfile(text) {
  return ENTREPRENEUR_RE.test(text || '')
}

function looksLikeJobPosting(desc) {
  const d = normalizeText(desc)
  if (!d) return false
  return /\bvacante\b|lo que haras|lo que buscamos|responsabilidades|requisitos|postulate|te ofrecemos|ofrecemos|buscamos|sueldo|prestaciones|contratacion|aplica ahora|configurar y dar soporte/.test(d)
    || /\d{1,2} de \w+ de 20\d\d\s*-/.test(desc) // "18 de abril de 2023 - ..." (fecha de posteo)
}

// Búsqueda amplia site:linkedin.com/in (mucho más pool: la mayoría de perfiles
// mexicanos están indexados como www.linkedin.com, no bajo el subdominio mx.).
// Los extranjeros se filtran después con isForeignProfile (subdominio pe./cl./ar.
// o mención de otro país en el texto).
const PLATFORM_PREFIX = {
  linkedin: 'site:linkedin.com/in',
  occ: 'site:occ.com.mx',
  indeed: 'site:mx.indeed.com',
  computrabajo: 'site:computrabajo.com.mx',
}

/** Build DIVERSE queries from the vacancy so el listado no se repite: variantes
 *  por ubicación, seniority y cada competencia → más perfiles distintos. Sin
 *  operadores negativos (las aseguradoras se filtran después). */
function buildQueries(vacancy, prefix, max = 5, seeds = [], searchTerms = []) {
  const loc = vacancy.location || 'México'
  const t = (vacancy.title || '').trim()
  const raw = []
  // Términos GANADORES del reclutador (cómo se describe en LinkedIn la gente
  // que SÍ responde — p.ej. los filtros de Karina): van PRIMERO y fijos.
  // Resuelven vacantes con título interno ("FINANCE CONSULTANT") que nadie
  // usa en su perfil.
  const winners = (searchTerms || []).map(s => String(s).trim()).filter(Boolean).slice(0, 4)
  winners.forEach(term => raw.push(/\b(cdmx|m[eé]xico|monterrey|guadalajara|quer[eé]taro)\b/i.test(term) ? term : `${term} ${loc}`))
  // Lookalike: títulos de los candidatos MANUALES de la vacante (los que mejor
  // responden según el equipo) generan sus propias queries.
  ;(seeds || []).map(s => s?.title).filter(Boolean).slice(0, 2)
    .forEach(st => { if (normalizeText(st) !== normalizeText(t)) raw.push(`${st} ${loc}`) })
  if (t) {
    raw.push(`${t} ${loc}`)
    raw.push(`${t} México`)         // más amplio que la ciudad
    raw.push(t)                      // sin ubicación (máxima cobertura)
    raw.push(`senior ${t} ${loc}`)   // variante seniority
  }
  if (t && /ciudad de m[eé]xico|cdmx/i.test(loc)) raw.push(`${t} CDMX`)
  if (vacancy.department) raw.push(`${t} ${vacancy.department} ${loc}`.trim())
  // Una query por cada competencia (surfacean gente distinta)
  ;(vacancy.competencies || []).map(c => c?.name).filter(Boolean).slice(0, 3)
    .forEach(c => raw.push(`${t} ${c} ${loc}`.trim()))
  // Competencia SOLA + ubicación: rescata vacantes cuyo título es un nombre
  // interno/comercial ("CERO HIPOTECA") que nadie usa en su perfil — con puro
  // título esas búsquedas regresan empresas del producto, no candidatos.
  ;(vacancy.competencies || []).map(c => c?.name).filter(Boolean).slice(0, 2)
    .forEach(c => { if (String(c).trim().length >= 4) raw.push(`${String(c).trim()} ${loc}`.trim()) })
  if (!raw.length) raw.push(loc)
  const uniq = [...new Set(raw.map(s => s.trim()).filter(Boolean))]
  // Los términos ganadores (o la 1a variante) van FIJOS; el resto se BARAJA
  // para que corridas sucesivas usen variantes distintas — con queries
  // deterministas cada corrida re-encontraba los mismos perfiles, que ya
  // estaban en el banco (excludeUrls) y el neto de NUEVOS se iba a cero.
  const fixedN = Math.min(Math.max(winners.length, 1), uniq.length)
  const head = uniq.slice(0, fixedN)
  const tail = uniq.slice(fixedN)
  for (let i = tail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tail[i], tail[j]] = [tail[j], tail[i]]
  }
  return [...head, ...tail].slice(0, max).map(base => `${prefix} ${base}`.trim())
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

/** DDG envuelve cada resultado en un redirect (//duckduckgo.com/l/?uddg=<url
 *  codificada>) — el destino real viene URL-encoded, por eso el scan genérico
 *  de anchors nunca lo veía. Regresa el destino decodificado. */
function decodeDdgHref(href) {
  const m = String(href).match(/[?&]uddg=([^&"']+)/i)
  if (!m) return href
  try { return decodeURIComponent(m[1]) } catch { return href }
}

/** Resuelve el destino REAL de un href de SERP: Google envuelve en
 *  /url?q=<url-encoded>, Bing en /ck/a?...&u=a1<base64url>, DDG en ?uddg=.
 *  Sin esto, Google y Bing devuelven 200 con resultados y el parser saca 0. */
function resolveSerpHref(href) {
  let h = decodeDdgHref(href)
  const g = String(h).match(/[?&](?:q|url)=(https?[^&"']+)/i)
  if (g) { try { h = decodeURIComponent(g[1]) } catch { h = g[1] } }
  const b = String(h).match(/[?&]u=a1([A-Za-z0-9_\-=]+)/)
  if (b) {
    try {
      const dec = Buffer.from(b[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
      if (/^https?:\/\//i.test(dec)) h = dec
    } catch { /* href tal cual */ }
  }
  return h
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

  // ── DuckDuckGo (html.duckduckgo.com): cada resultado vive en un bloque
  // links_main con título (result__a) y snippet (result__snippet) ─────────
  const ddgBlocks = html.split(/class="links_main/)
  for (let i = 1; i < ddgBlocks.length; i++) {
    const b = ddgBlocks[i]
    const hrefM = b.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/i)
      || b.match(/<a[^>]+href="([^"]+)"[^>]+class="result__a"/i)
    if (!hrefM) continue
    const real = decodeDdgHref(decodeEntities(hrefM[1]))
    if (!/linkedin\.com\/in\/[^/?#]{3,}/i.test(real)) continue
    const url = normProfileUrl(real)
    if (seen.has(url)) continue
    const titleM = b.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/i)
    const headline = titleM ? cleanSerpTitle(decodeEntities(titleM[1])) : ''
    const snipM = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/i)
    const description = snipM ? cleanDescription(snipM[1]) : ''
    const name = nameFromSlug(url) || (headline.split(/\s*[-–]\s*/)[0] || '').trim()
    if (!name && !headline && !description) continue
    seen.add(url)
    out.push({ url, name, headline, description, country: countryOfHref(real) })
  }
  if (out.length) return out

  // ── Fallback: generic anchor scan (Google/Bing/DDG) ───────────
  // Escanea TODOS los anchors y resuelve el destino real (Google /url?q=,
  // Bing base64) antes de filtrar por linkedin.com/in.
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const real = resolveSerpHref(decodeEntities(m[1]))
    if (!/linkedin\.com\/in\/[^/?#]{3,}/i.test(real)) continue
    const url = normProfileUrl(real)
    if (!/\/in\/[^/]{3,}/.test(url) || seen.has(url)) continue
    seen.add(url)
    const headline = cleanSerpTitle(m[2])
    const name = nameFromSlug(url)
    if (!name && !headline) continue
    out.push({ url, name, headline, description: '', country: countryOfHref(real) })
  }
  return out
}

/** Serper.dev (API de Google, de pago): resultados confiables sin scraping ni
 *  proxy — es la fuente PRIMARIA cuando hay SERPER_API_KEY. 1 crédito por
 *  búsqueda de 10 resultados; num 20-100 usa 2. Si no hay key o falla,
 *  se cae al scraping de motores de siempre. */
let serperBlocked = false // cuentas free rechazan site:/inurl: → no reintentar
export async function serperSearch(query, num = 30) {
  const key = process.env.SERPER_API_KEY
  if (!key || serperBlocked) return null
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'mx', hl: 'es', num }),
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 400) {
      const err = await res.json().catch(() => ({}))
      if (/not allowed for free/i.test(err.message || '')) serperBlocked = true
      return null
    }
    if (!res.ok) return null
    const data = await res.json()
    const out = []
    const seen = new Set()
    for (const r of data.organic || []) {
      if (!/linkedin\.com\/in\/[^/?#]{3,}/i.test(r.link || '')) continue
      const url = normProfileUrl(r.link)
      if (seen.has(url)) continue
      seen.add(url)
      const headline = cleanSerpTitle(decodeEntities(r.title || ''))
      const description = cleanDescription(r.snippet || '')
      const name = nameFromSlug(url) || (headline.split(/\s*[-–]\s*/)[0] || '').trim()
      if (!name && !headline && !description) continue
      out.push({ url, name, headline, description, country: countryOfHref(r.link) })
    }
    return out
  } catch { return null }
}

/** Bing en formato RSS (format=rss): XML limpio con títulos "Nombre - Puesto |
 *  LinkedIn" y links DIRECTOS (con subdominio de país). El HTML normal de Bing
 *  le sirve un cascarón vacío a IPs de datacenter, pero el RSS sí responde y
 *  pesa ~6KB. ~10 items por página; se pagina con first=. */
async function bingRssSearch(query, offset = 0, dispatcher) {
  try {
    const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}&count=50${offset ? `&first=${offset * 10 + 1}` : ''}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      dispatcher,
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    const out = []
    for (const [, it] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const link = decodeEntities((it.match(/<link>([^<]+)<\/link>/) || [])[1] || '')
      if (!/linkedin\.com\/in\/[^/?#]{3,}/i.test(link)) continue
      const purl = normProfileUrl(link)
      const headline = cleanSerpTitle(decodeEntities((it.match(/<title>([^<]+)<\/title>/) || [])[1] || ''))
      const description = cleanDescription((it.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '')
      const name = nameFromSlug(purl) || (headline.split(/\s*[-–]\s*/)[0] || '').trim()
      if (!name && !headline) continue
      out.push({ url: purl, name, headline, description, country: countryOfHref(link) })
    }
    return out
  } catch { return [] }
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
export async function buildProxyPool(size) {
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

export function slugOf(url = '') {
  const m = String(url).match(/\/in\/([^/?#]+)/i)
  return m ? m[1] : ''
}

/** Targeted search for ONE profile → richer headline/description (often reveals
 *  the current employer, e.g. an insurer, que el listado amplio no muestra).
 *  Prioriza Brave (el motor que devuelve datos server-side) y reintenta.
 *  Exportado: lo reutiliza cron-verify-profiles.mjs (Fase 4, higiene de base). */
export async function enrichProfile(slug, dispatcher) {
  if (!slug) return null
  // Serper primero (búsqueda dirigida = 1 crédito, revela empleador real)
  const viaSerper = await serperSearch(`site:linkedin.com/in/${slug}`, 10)
  if (viaSerper?.length) {
    const k = slug.slice(0, 12).toLowerCase()
    const p = viaSerper.find(x => x.url.toLowerCase().includes(k)) || viaSerper[0]
    if (p && (p.headline || p.description)) return p
  }
  const key = slug.slice(0, 12).toLowerCase()
  // Bing RSS dirigido: confiable desde datacenter y trae headline+descripción.
  const viaRss = await bingRssSearch(`site:linkedin.com/in/${slug}`, 0, dispatcher)
  const pr = viaRss.find(x => x.url.toLowerCase().includes(key)) || viaRss[0]
  if (pr && (pr.headline || pr.description)) return pr
  const engines = buildSearchEngines(`site:linkedin.com/in/${slug}`)
    .sort((a, b) => (a.name === 'Brave' ? -1 : 0) - (b.name === 'Brave' ? -1 : 0))
  const deadline = Date.now() + 8000
  // 1a pasada por el proxy; si está caído, 2a pasada directa desde Netlify.
  for (const disp of dispatcher ? [dispatcher, undefined] : [undefined]) {
    for (const engine of engines) {
      if (Date.now() > deadline) return null
      try {
        const res = await fetch(engine.url, { headers: engine.headers, dispatcher: disp, signal: AbortSignal.timeout(5000) })
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
export async function scrapeQuery(query, dispatcher, dbg, offset = 0) {
  // Serper primero: Google real vía API, no se degrada ni bloquea.
  // (solo para la página 1: Serper pagina distinto)
  const viaSerper = offset === 0 ? await serperSearch(query) : null
  if (viaSerper?.length) { dbg?.push(`Serper: ${viaSerper.length} perfiles`); return viaSerper }
  // Brave primero (es el que devuelve datos server-side) → evita perder segundos
  // en motores que fallan antes de llegar a él. offset = página de Brave (0-9).
  const engines = buildSearchEngines(query, offset)
    .sort((a, b) => (a.name === 'Brave' ? -1 : 0) - (b.name === 'Brave' ? -1 : 0))
  const merged = []
  const seen = new Set()
  // Bing RSS primero: barato, confiable desde datacenter y con links directos —
  // garantiza ~10/query aunque Brave esté rate-limitado.
  for (const p of await bingRssSearch(query, offset, dispatcher)) {
    if (!seen.has(p.url)) { seen.add(p.url); merged.push(p) }
  }
  if (merged.length) dbg?.push(`BingRSS: ${merged.length} perfiles`)
  // El front aborta a los 22s y Netlify corta a ~26 → la fase de búsqueda base
  // tiene 10s; el resto del presupuesto es para la verificación por perfil.
  const deadline = Date.now() + 10000
  // 1a pasada por el proxy; si TODO falló (proxy caído/bloqueado), 2a pasada
  // directa desde Netlify — DDG suele responder aun a IPs de datacenter.
  for (const disp of dispatcher ? [dispatcher, undefined] : [undefined]) {
    const tag = disp ? '+proxy' : ''
    for (const engine of engines) {
      if (Date.now() > deadline) { dbg?.push('deadline'); break }
      try {
        const res = await fetch(engine.url, {
          headers: engine.headers,
          dispatcher: disp,
          signal: AbortSignal.timeout(7000),
        })
        if (!res.ok) { dbg?.push(`${engine.name}${tag}: HTTP ${res.status}`); continue }
        const html = await res.text()
        if (html.length < 500) { dbg?.push(`${engine.name}${tag}: ${html.length}b`); continue }
        const profs = parseSerpProfiles(html)
        dbg?.push(`${engine.name}${tag}: ${html.length}b → ${profs.length} perfiles`)
        for (const p of profs) {
          if (!seen.has(p.url)) { seen.add(p.url); merged.push(p) }
        }
        // Un motor con buena cosecha basta; evita golpear los demás de más.
        if (merged.length >= 15) break
      } catch (e) {
        dbg?.push(`${engine.name}${tag}: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`)
      }
    }
    if (merged.length) break
  }
  return merged
}

/**
 * Motor central de sourcing — compartido por el handler HTTP (front) y el
 * cron nocturno (cron-auto-source.mjs). Busca, filtra, dedupe y puntúa.
 *
 * @param {object} args
 * @param {object}   args.vacancy      { title (requerido), location, department, company_name, description, challenges, competencies }
 * @param {string[]} [args.excludeUrls]  URLs ya conocidas (banco/bloqueados) — solo se devuelven NUEVOS
 * @param {object}   [args.options]    { platform, minScore, maxResults, excludeSector, excludeForeign, seeds, searchTerms, onlyEntrepreneurs, debug }
 * @returns {Promise<{results:Array, counts:object, minScore:number, queries:string[], excludeSector:boolean, excludeForeign:boolean, proxied:boolean, serper:boolean, engineLog:Array|null, hint:string|null}>}
 */
export async function runAutoSource({ vacancy: rawVacancy, excludeUrls = [], options = {} }) {
  const t0 = Date.now()
  if (!rawVacancy?.title) throw new Error('vacancy.title requerido')
  // Títulos internos con marca ("Consultor Inmobiliario Senior | Célula Cero
  // Hipoteca") ensucian queries y scoring: la parte después de | / · es nombre
  // de producto, no de puesto — con ella las búsquedas regresan EMPRESAS del
  // producto (reporte Karina 2026-08-31). Nos quedamos con el puesto.
  const vacancy = { ...rawVacancy, title: String(rawVacancy.title).split(/[|·]/)[0].trim() || rawVacancy.title }

  const prefix = PLATFORM_PREFIX[options.platform] || PLATFORM_PREFIX.linkedin
  const minScore = Number.isFinite(options.minScore) ? options.minScore : 50
  const maxResults = Math.min(Math.max(parseInt(options.maxResults, 10) || 40, 1), 100)
  // Exclusión sector asegurador/inversiones: ON por defecto (crítico para
  // Prudential); el front puede apagarla cuando SÍ quieren gente del sector.
  const excludeSector = options.excludeSector !== false
  // Filtro geográfico: fuera perfiles de otros países (Perú, Chile, Argentina…).
  // ON por defecto; el front puede apagarlo para vacantes fuera de México.
  const excludeForeign = options.excludeForeign !== false
  // URLs ya conocidas (banco/bloqueados) → se excluyen server-side para devolver
  // solo candidatos NUEVOS (clave cuando el banco ya tiene decenas de perfiles).
  const known = new Set((Array.isArray(excludeUrls) ? excludeUrls : [])
    .map(u => String(u).split('?')[0].replace(/\/$/, '')))

  // Semillas lookalike: perfiles manuales de la vacante → queries extra y
  // boost de score a prospectos parecidos (título/empresa).
  const seeds = Array.isArray(options.seeds) ? options.seeds.slice(0, 8) : []
  const seedTokens = new Set(
    seeds.flatMap(s => normalizeText(`${s?.title || ''} ${s?.company || ''}`).split(/\s+/))
      .filter(tk => tk.length > 3)
  )

  const winnerTerms = Array.isArray(options.searchTerms) ? options.searchTerms.map(s => String(s).trim()).filter(Boolean).slice(0, 4) : []
  // Modo emprendedores (Ingrid): solo perfiles con señales de negocio propio;
  // agrega queries dirigidas a fundadores/emprendedores del giro.
  const onlyEntrepreneurs = options.onlyEntrepreneurs === true
  let queries = buildQueries(vacancy, prefix, 7, seeds, winnerTerms)
  if (onlyEntrepreneurs) {
    // Modo emprendedores: las queries van DIRIGIDAS a fundadores/dueños; las
    // genéricas casi no los traen (2 de 114 en pruebas).
    const loc = vacancy.location || 'México'
    const flavor = winnerTerms[0] || (vacancy.title || '').trim()
    queries = [
      `${prefix} fundador ${loc}`,
      `${prefix} emprendedor ${loc}`,
      `${prefix} dueño de negocio ${loc}`,
      `${prefix} fundador ${flavor} ${loc}`,
      `${prefix} emprendedor ${flavor} México`,
    ].map(q => q.replace(/\s+/g, ' ').trim())
  }
  // El scorer debe aceptar los términos ganadores como títulos ALTERNATIVOS:
  // si el reclutador busca "Ejecutivo de ventas", esos perfiles no pueden
  // reprobar por no decir "FINANCE CONSULTANT". Un set de targets por título
  // y se toma el MEJOR score (concatenarlos diluía el ratio de match).
  const targetsList = [vacancy.title, ...winnerTerms].filter(Boolean)
    .map(tt => buildTargets({ ...vacancy, title: tt }))
  if (!targetsList.length) targetsList.push(buildTargets(vacancy))
  const dispatcher = await getDispatcher()

  const seen = new Set()
  const scored = []
  const counts = { found: 0, known: 0, excluded: 0, companies: 0, foreign: 0, ghost: 0, lowQuality: 0, belowThreshold: 0, returned: 0 }

  // Búsquedas base en PARALELO (cada una por una IP distinta) → mucho más rápido.
  const dbg = options.debug ? [] : null
  let pool = await buildProxyPool(Math.max(queries.length + 2, 9))
  let activeDispatcher = dispatcher
  // Proxy caído (suscripción vencida, credenciales…) → detectarlo UNA vez aquí
  // y trabajar directo desde Netlify; si no, cada fetch proxied quema el
  // presupuesto de tiempo de su query y nunca se llega a la pasada directa.
  if (dispatcher) {
    try {
      // 6s: el primer CONNECT de un proxy residencial rotatorio puede tardar.
      await fetch('https://example.com/', { dispatcher, signal: AbortSignal.timeout(6000) })
    } catch (e) {
      const cause = e.cause ? ` (${e.cause.code || e.cause.message || e.cause})` : ''
      dbg?.push(`proxy muerto → modo directo: ${e.message}${cause}`)
      activeDispatcher = undefined
      pool = [undefined]
    }
  }
  // Además de la página 1 de cada query, la página 2 de las 2 primeras (las
  // fijas/ganadoras): más cosecha bruta = más sobrevivientes tras los filtros
  // (Karina veía corridas de 4-7 netos). Todo corre en paralelo con IP rotada.
  const jobs = queries.map(q => ({ q, o: 0 }))
  for (const q of queries.slice(0, 2)) jobs.push({ q, o: 1 })
  const perQuery = await Promise.all(
    jobs.map((j, i) => scrapeQuery(j.q, pool[i % pool.length] || activeDispatcher, dbg, j.o).catch(() => []))
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

      // El headline suele venir "Nombre - Puesto - Empresa"; sepáralo. Los
      // segmentos con "LinkedIn" son basura del SERP ("LinkedIn México"), no
      // un puesto.
      const parts = (p.headline || '').split(/\s*[-–—·|]\s*/).map(s => s.trim())
        .filter(Boolean).filter(s => !/linkedin/i.test(s))
      const current_title = parts[1] || null
      const current_company = parts[2] || null
      let full_name = p.name || parts[0] || ''
      // Slug concatenado sin nombre ("ileanaramirez") pero el título del SERP
      // sí lo trae ("Ileana Ramirez - Real Estate Agent") → usa el del título.
      if (!looksLikeHumanName(full_name) && looksLikeHumanName(parts[0])) full_name = parts[0]
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

      // Tarjeta BASURA: sin nombre humano presentable (slug concatenado que ni
      // el título del SERP resolvió), o sin NINGÚN dato para juzgar (ni puesto,
      // ni empresa, ni descripción). El reclutador no puede hacer nada con eso.
      if (!looksLikeHumanName(full_name)) { counts.lowQuality = (counts.lowQuality || 0) + 1; continue }
      if (!current_title && !current_company && !(p.description || '').trim()) {
        counts.lowQuality = (counts.lowQuality || 0) + 1
        continue
      }

      // Perfiles "fantasma" (cuenta creada y nunca usada: sin foto, ~20
      // contactos — feedback de Karina): el snippet de LinkedIn suele traer
      // "N connections/contactos"; menos de 50 exactos → fuera.
      const connM = `${p.description || ''} ${p.headline || ''}`.match(/(\d+)\s*\+?\s*(?:connections?|conexiones|contactos)\b/i)
      if (connM && !connM[0].includes('+') && +connM[1] < 50) {
        counts.ghost++
        continue
      }

      // El texto de scoring ahora incluye la descripción enriquecida,
      // salvo que la descripción sea una oferta de empleo (ruido).
      const usefulDesc = looksLikeJobPosting(p.description) ? '' : p.description
      const enriched = [p.headline, usefulDesc].filter(Boolean).join(' · ')
      // Señal de emprendedor: etiqueta siempre; en modo onlyEntrepreneurs filtra.
      const entrepreneur = isEntrepreneurProfile(`${p.headline || ''} ${usefulDesc || ''}`)
      if (onlyEntrepreneurs && !entrepreneur) { counts.notEntrepreneur = (counts.notEntrepreneur || 0) + 1; continue }
      const prospect = {
        title: p.headline || full_name,
        url: p.url,
        linkedin_url: p.url,
        displayUrl: 'linkedin.com',
        snippet: enriched,
        full_name, current_title, current_company, location,
        entrepreneur,
      }
      let s = scoreProspect(vacancy, prospect, targetsList[0])
      for (let ti = 1; ti < targetsList.length; ti++) {
        const alt = scoreProspect(vacancy, prospect, targetsList[ti])
        if (alt.score > s.score) s = alt
      }
      // Emprendedores convierten mejor (feedback Ingrid) → boost leve; en modo
      // "solo emprendedores" el rasgo ES el criterio → boost mayor para que
      // no reprueben por no coincidir con el título de la vacante.
      if (entrepreneur) s.score = Math.min(100, s.score + (onlyEntrepreneurs ? 15 : 6))
      // Boost lookalike: ≥2 tokens compartidos con los perfiles manuales → +8.
      if (seedTokens.size) {
        const pTokens = normalizeText(`${current_title || ''} ${current_company || ''} ${p.headline || ''}`).split(/\s+/)
        const overlap = pTokens.filter(tk => seedTokens.has(tk)).length
        if (overlap >= 2) s.score = Math.min(100, s.score + 8)
      }
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
  if (excludeSector && results.length && elapsed < 12000) {
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
    results, counts, minScore, queries, excludeSector, excludeForeign,
    proxied: !!activeDispatcher,
    serper: !!process.env.SERPER_API_KEY,
    engineLog: dbg,
    hint: counts.found === 0
      ? (process.env.SERPER_API_KEY ? 'Serper no devolvió perfiles (¿créditos agotados? revisa serper.dev) y los motores de respaldo tampoco.' : (dispatcher ? 'Los buscadores no devolvieron perfiles (revisa el proxy).' : 'Sin resultados — configura SERPER_API_KEY (serper.dev) o PROXY_URL residencial para mayor confiabilidad.'))
      : null,
  }
}

/** Handler HTTP: wrapper delgado sobre runAutoSource. MISMO contrato que
 *  siempre — mismos params del body, misma forma de la respuesta. */
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
  if (!body.vacancy?.title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'vacancy.title requerido' }) }

  let out
  try {
    out = await runAutoSource({
      vacancy: body.vacancy,
      excludeUrls: body.excludeUrls,
      options: {
        platform: body.platform,
        minScore: body.minScore,
        maxResults: body.maxResults,
        excludeSector: body.excludeSector,
        excludeForeign: body.excludeForeign,
        seeds: body.seeds,
        searchTerms: body.searchTerms,
        onlyEntrepreneurs: body.onlyEntrepreneurs,
        debug: body.debug,
      },
    })
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'auto-source failed' }) }
  }

  const { engineLog, hint, ...rest } = out
  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ...rest,
      ...(engineLog ? { engineLog } : {}),
      ...(hint ? { hint } : {}),
    }),
  }
}
