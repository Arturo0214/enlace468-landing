// Netlify serverless function: searches LinkedIn profiles via multiple search engines
// with fallback rotation, randomized User-Agents, retry logic, and pagination support

// Company exclusion list (insurance / investment sector) — single source of truth
// shared with the front-end sourcing surfaces. See src/lib/excludedCompanies.js.
import { matchExcludedCompany, NEGATIVE_QUERY } from '../../src/lib/excludedCompanies.js'
import { isForeignProfile, detectForeignLocation } from '../../src/lib/sourcingScore.js'
// Import circular con auto-source (él importa buildSearchEngines de aquí):
// seguro en ESM porque solo se usan declaraciones de función en runtime.
import { scrapeQuery, buildProxyPool, getDispatcher, looksLikeCompany } from './auto-source.mjs'

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
]

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Fetch with retry and exponential backoff
async function fetchWithRetry(url, options, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) })
      if (res.ok || res.status < 500) return res
      // Server error - retry
    } catch (err) {
      if (attempt === maxRetries) throw err
    }
    await sleep(1000 * Math.pow(2, attempt)) // 1s, 2s, 4s
  }
  return null
}

// Extract LinkedIn profile URLs and metadata from raw HTML
export function extractCandidatesFromHTML(html, stats = { excluded: 0 }) {
  const candidates = []

  // DDG entrega los URLs dentro de redirects codificados (?uddg=https%3A%2F%2F…)
  // que el scan de URLs no veía → decodifícalos y agrégalos al HTML escaneado.
  const ddgDecoded = [...html.matchAll(/[?&]uddg=(https?%3A%2F%2F[^&"']+)/gi)]
    .map(m => { try { return decodeURIComponent(m[1]) } catch { return '' } })
    .filter(u => /linkedin\.com\/in\//i.test(u))
  if (ddgDecoded.length) html = html + '\n' + ddgDecoded.join('\n')

  // Clean HTML for text extraction
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Extract LinkedIn profile URLs (keeping the ORIGINAL country subdomain so we
  // can block foreign profiles: pe., cl., ar. → not Mexico)
  const urlPattern = /https?:\/\/[a-z]{2,3}\.linkedin\.com\/in\/[a-z0-9\-_%]+/gi
  const urls = new Set()
  const originalUrls = new Map() // normalized → original (con subdominio de país)
  let match
  while ((match = urlPattern.exec(html)) !== null) {
    const original = match[0].split('?')[0].split('#')[0].replace(/\/$/, '')
    // Normalize to www.linkedin.com
    const url = original.replace(/https?:\/\/[a-z]{2,3}\.linkedin\.com/, 'https://www.linkedin.com')
    if (!url.includes('login') && !url.includes('signup') && !url.includes('404') && !url.includes('jobs') && !url.includes('company')) {
      urls.add(url)
      if (!originalUrls.has(url)) originalUrls.set(url, original)
    }
  }

  for (const profileUrl of urls) {
    const slug = profileUrl.split('/in/')[1]
    if (!slug || slug.length < 3) continue

    let decodedSlug
    try { decodedSlug = decodeURIComponent(slug) } catch (e) { decodedSlug = slug }

    const nameParts = decodedSlug
      .split('-')
      .filter(p => p.length > 0 && !/^\d+$/.test(p) && !/^[a-f0-9]{6,}$/i.test(p))
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())

    if (nameParts.length < 2) continue
    const fullName = nameParts.slice(0, 4).join(' ')

    if (candidates.some(c => c.linkedin_url === profileUrl)) continue

    // Try to extract title/company from surrounding text
    let currentTitle = null
    let currentCompany = null

    const urlIdx = cleanHtml.indexOf(profileUrl)
    if (urlIdx > -1) {
      const surrounding = cleanHtml
        .substring(Math.max(0, urlIdx - 400), Math.min(cleanHtml.length, urlIdx + 400))
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // Look for "Name - Title - Company | LinkedIn" or similar patterns
      const linkedinTitleMatch = surrounding.match(
        new RegExp(nameParts[0] + '[^|]*', 'i')
      )
      if (linkedinTitleMatch) {
        const titleStr = linkedinTitleMatch[0]
        const segments = titleStr.split(/\s*[-–—]\s*/).map(s => s.trim()).filter(s =>
          s.length > 1 &&
          !s.includes('LinkedIn') &&
          !s.includes('linkedin') &&
          !s.includes('<') &&
          !s.includes('>') &&
          !s.includes('svelte') &&
          !s.includes('class=') &&
          !s.includes('http') &&
          !s.includes('img') &&
          s.length < 80
        )
        if (segments.length >= 2) currentTitle = segments[1] || null
        if (segments.length >= 3) currentCompany = segments[2] || null
      }
    }

    // Clean any remaining HTML artifacts
    if (currentTitle && (currentTitle.includes('<') || currentTitle.includes('svelte') || currentTitle.includes('class'))) currentTitle = null
    if (currentCompany && (currentCompany.includes('<') || currentCompany.includes('svelte') || currentCompany.includes('class'))) currentCompany = null

    // Try to extract snippet
    let snippet = null
    if (urlIdx > -1) {
      const afterUrl = cleanHtml
        .substring(urlIdx, Math.min(cleanHtml.length, urlIdx + 600))
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      // Look for descriptive text that might be a snippet
      const snippetMatch = afterUrl.match(/(?:experience|experiencia|about|acerca|skills|habilidades|profile|perfil)[^.]{10,120}\./i)
      if (snippetMatch) snippet = snippetMatch[0].trim()
    }

    // Try to extract location
    let location = null
    if (urlIdx > -1) {
      const nearUrl = cleanHtml
        .substring(Math.max(0, urlIdx - 200), Math.min(cleanHtml.length, urlIdx + 500))
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
      const locMatch = nearUrl.match(/(?:ubicaci[oó]n|location|area|[áa]rea)[:\s]*([A-ZÁÉÍÓÚÑa-záéíóúñ\s,]{3,40}?)(?:\s*[-·|]|\s{2,}|$)/i)
      if (locMatch) location = locMatch[1].trim()
    }

    // Skip candidates from excluded firms (insurance / investment sector).
    // Check every text signal we have, including the raw surrounding context,
    // since company parsing from search HTML is unreliable.
    const excludeContext = urlIdx > -1
      ? cleanHtml.substring(Math.max(0, urlIdx - 400), Math.min(cleanHtml.length, urlIdx + 400)).replace(/<[^>]+>/g, ' ')
      : ''
    if (matchExcludedCompany(currentCompany, currentTitle, snippet, fullName, excludeContext)) {
      stats.excluded++
      continue
    }

    // Bloquea perfiles ubicados fuera de México (subdominio de país del URL
    // original, o mención de otro país en el texto extraído).
    if (isForeignProfile(originalUrls.get(profileUrl) || profileUrl, currentTitle, snippet, location)) {
      stats.foreign = (stats.foreign || 0) + 1
      continue
    }

    candidates.push({
      full_name: fullName,
      current_title: currentTitle,
      current_company: currentCompany,
      linkedin_url: profileUrl,
      snippet,
      location,
    })
  }

  return candidates
}

// Search engine definitions - each returns a URL to fetch
export function buildSearchEngines(searchQuery, offset = 0) {
  const encoded = encodeURIComponent(searchQuery)
  // Randomize order each time for rotation
  const engines = [
    {
      name: 'DuckDuckGo',
      url: `https://html.duckduckgo.com/html/?q=${encoded}`,
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' },
    },
    {
      name: 'Brave',
      url: `https://search.brave.com/search?q=${encoded}&source=web${offset ? `&offset=${offset}` : ''}`,
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' },
    },
    {
      name: 'Bing',
      url: `https://www.bing.com/search?q=${encoded}&count=50${offset ? `&first=${offset + 1}` : ''}`,
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' },
    },
    {
      name: 'Google',
      url: `https://www.google.com/search?q=${encoded}&num=100&hl=es${offset ? `&start=${offset}` : ''}`,
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' },
    },
  ]
  // Shuffle the array for rotation
  for (let i = engines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [engines[i], engines[j]] = [engines[j], engines[i]]
  }
  return engines
}

export async function handler(event) {
  const query = event.queryStringParameters?.q
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10)
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (!query) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing q parameter' }) }
  }

  try {
    // 4 variantes de la query en PARALELO → objetivo 50+ perfiles únicos.
    // Una sola query da ~20 (Brave) + ~10 (DDG); el outreach necesita volumen,
    // así que se amplía con ubicación/seniority y se fusiona deduplicando.
    // Diversidad geográfica: en roles comerciales/financieros los SERPs vienen
    // dominados por gente de aseguradoras (SMNYL/GNP…) que la exclusión tira —
    // más variantes distintas = más perfiles únicos netos que más páginas de
    // la misma query.
    const seenVariant = new Set()
    const variants = [query, `${query} México`, `${query} Ciudad de México`, `${query} Monterrey`, `${query} Guadalajara`, `senior ${query}`]
      .map(v => v.trim())
      .filter(v => { const k = v.toLowerCase(); if (seenVariant.has(k)) return false; seenVariant.add(k); return true })
      .map(v => `site:linkedin.com/in ${v} ${NEGATIVE_QUERY}`.trim())

    const allCandidates = []
    const errors = []
    const stats = { excluded: 0, foreign: 0 }
    const dbg = event.queryStringParameters?.debug ? [] : null

    const dispatcher = await getDispatcher()
    let pool = await buildProxyPool(Math.max(variants.length, 4))
    if (dispatcher) {
      try {
        await fetch('https://example.com/', { dispatcher, signal: AbortSignal.timeout(6000) })
      } catch { pool = [undefined] } // proxy caído → directo desde Netlify
    }

    // Cada variante se pide en 2 páginas de Brave (20 c/u). En OLEADAS de 4 con
    // pausa: lanzar todo junto dispara el rate-limit de Brave (429 masivo) y
    // termina dando MENOS. Se corta al juntar ~90 crudos — las queries
    // "tóxicas" (Asesor Financiero) pierden ~60% a la exclusión de aseguradoras
    // y aun así llegan a 50+.
    const jobs = variants.flatMap(v => [0, 1].map(o => ({ v, o })))
    const raw = []
    const seen = new Set()
    const CHUNK = 4
    for (let i = 0; i < jobs.length; i += CHUNK) {
      const wave = jobs.slice(i, i + CHUNK)
      const lists = await Promise.all(
        wave.map((j, k) => scrapeQuery(j.v, pool[(i + k) % pool.length], dbg, j.o).catch(err => { errors.push(err.message); return [] }))
      )
      for (const list of lists) {
        for (const p of list) {
          if (!seen.has(p.url)) { seen.add(p.url); raw.push(p) }
        }
      }
      if (raw.length >= 120 || i + CHUNK >= jobs.length) break
      await new Promise(r => setTimeout(r, 1200))
    }

    {
      for (const p of raw) {
        // El headline suele venir "Nombre - Puesto - Empresa"; sepáralo.
        const parts = (p.headline || '').split(/\s*[-–—·|]\s*/).map(s => s.trim()).filter(Boolean)
        const full_name = p.name || parts[0] || 'Perfil de LinkedIn'
        const current_title = parts[1] || null
        const current_company = parts[2] || null
        if (looksLikeCompany(full_name)) continue // páginas de empresa/marca, no personas
        // Perfiles "fantasma" (~20 contactos, cuentas muertas): el snippet trae
        // "N connections/contactos"; menos de 50 exactos → fuera.
        const connM = `${p.description || ''} ${p.headline || ''}`.match(/(\d+)\s*\+?\s*(?:connections?|conexiones|contactos)\b/i)
        if (connM && !connM[0].includes('+') && +connM[1] < 50) { stats.ghost = (stats.ghost || 0) + 1; continue }
        const exclLabel = matchExcludedCompany(current_company, current_title, p.headline, p.description, full_name)
        if (exclLabel) { stats.excluded++; dbg?.push(`EXCL [${exclLabel}] ${full_name} | ${(p.headline || '').slice(0, 60)}`); continue }
        const foreign = (p.country && p.country !== 'mx' && p.country !== 'www')
          || detectForeignLocation(`${p.headline || ''} ${p.description || ''}`)
        if (foreign) { stats.foreign++; continue }
        allCandidates.push({
          full_name,
          current_title,
          current_company,
          linkedin_url: p.url,
          snippet: p.description || null,
          location: null,
        })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        results: allCandidates.slice(0, 100),
        count: allCandidates.length,
        excluded: stats.excluded,
        foreign: stats.foreign,
        ghost: stats.ghost || 0,
        query,
        variants,
        offset,
        ...(dbg ? { engineLog: dbg } : {}),
        ...(allCandidates.length === 0 && errors.length > 0 ? { debug: errors } : {}),
      }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, results: [] }),
    }
  }
}
