// Netlify serverless function: import a LinkedIn profile by its URL.
//
// Given a LinkedIn profile URL, does a targeted SERP search (via the same
// residential-proxy scraper as auto-source) to pull the public headline /
// role / company / location, and returns a ready-to-save card. Used by the
// "Importar por URL" box in Sourcing to add people already in the recruiter's
// network (or found manually) into the CRM.
//
// POST body: { url }
// Called by the front at  /api/import-profile

import { buildSearchEngines } from './search-candidates.mjs'
import { parseSerpProfiles, getDispatcher } from './auto-source.mjs'

function extractSlug(url = '') {
  const m = String(url).match(/\/in\/([^/?#]+)/i)
  if (m) { try { return decodeURIComponent(m[1]) } catch { return m[1] } }
  return null
}

function pickLocation(desc = '') {
  const m = desc.match(/(?:Location|Ubicaci[oó]n)\s*[:：]\s*([^.·|]{2,40})/i)
  return m ? m[1].trim() : null
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

  const rawUrl = (body.url || '').trim()
  const slug = extractSlug(rawUrl)
  if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'INVALID_URL', hint: 'Pega una URL de perfil de LinkedIn (…/in/…).' }) }

  const canonical = `https://www.linkedin.com/in/${slug}`
  const dispatcher = await getDispatcher()

  // Búsqueda dirigida a ESE perfil para traer su headline/rol/empresa/ubicación.
  const query = `site:linkedin.com/in/${slug}`
  const engines = buildSearchEngines(query)
  // SOLO acepta el resultado cuyo slug es EXACTAMENTE el pedido (comparando
  // decodificado, para slugs con acentos). Antes caía al primer resultado de
  // la búsqueda y registraba los datos de OTRA persona — "me está registrando
  // perfiles que no son" / perfiles de Aguascalientes marcados como EUA
  // (reporte Karina 2026-10-08). Sin match exacto → card parcial del slug.
  const targetSlug = slug.toLowerCase()
  const slugOf = u => {
    const m = String(u || '').match(/\/in\/([^/?#]+)/i)
    if (!m) return null
    try { return decodeURIComponent(m[1]).toLowerCase() } catch { return m[1].toLowerCase() }
  }
  let match = null
  for (const engine of engines) {
    try {
      const res = await fetch(engine.url, { headers: engine.headers, dispatcher, signal: AbortSignal.timeout(11000) })
      if (!res.ok) continue
      const html = await res.text()
      if (html.length < 500) continue
      const profiles = parseSerpProfiles(html)
      match = profiles.find(p => slugOf(p.url) === targetSlug) || null
      if (match) break
    } catch { /* siguiente motor */ }
  }

  if (!match) {
    // Aun sin descripción, devolvemos lo mínimo derivado del slug para crear la card.
    const name = slug.split('-').filter(s => s && !/^\d+$/.test(s) && !/^[a-f0-9]{6,}$/i.test(s))
      .map(s => s.charAt(0).toUpperCase() + s.slice(1)).slice(0, 4).join(' ')
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: true, partial: true, profile: { full_name: name || 'Perfil de LinkedIn', headline: '', current_title: null, current_company: null, location: null, url: canonical, snippet: '' } }),
    }
  }

  const parts = (match.headline || '').split(/\s*[-–—·|]\s*/).map(s => s.trim()).filter(Boolean)
  const profile = {
    full_name: match.name || parts[0] || 'Perfil de LinkedIn',
    headline: match.headline || '',
    current_title: parts[1] || null,
    current_company: parts[2] || null,
    location: pickLocation(match.description || ''),
    url: canonical, // siempre la forma canónica — evita variantes /en o mx. duplicadas en el banco
    snippet: [match.headline, match.description].filter(Boolean).join(' · '),
  }
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, profile }) }
}
