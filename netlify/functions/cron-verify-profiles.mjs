// Netlify Scheduled Function — re-verificación de perfiles (FASE 4, higiene).
//
// Schedule (netlify.toml): "0 8 * * *" = 2am CDMX (UTC-6 fijo), diario — no
// empalma con cron-auto-source (10/11/12 UTC) ni cron-daily-digest (13 UTC).
//
// Cada corrida toma un lote de ~15 perfiles con LinkedIn y los re-busca de
// forma DIRIGIDA (site:linkedin.com/in/<slug>) con enrichProfile de
// auto-source.mjs (Serper → Bing RSS → Brave/otros). Compara lo que devuelve
// el SERP hoy vs lo guardado y marca verify_status:
//
//   'activo'         — headline/empleador coincide con lo guardado
//   'cambio_empleo'  — empleador/headline claramente distinto (verify_details
//                      guarda new_title/new_company/checked_at)
//   'fantasma'       — snippet revela <50 contactos/connections exactos
//   'link_muerto'    — 2 corridas DISTINTAS sin resultado (misses acumulados
//                      en verify_details.misses; 1 miss aislado NO condena:
//                      los motores fallan por rate-limit/proxy)
//   'desactualizado' — resultado ambiguo (hay datos pero no comparables) y la
//                      fila tiene >1 año sin poder confirmarse
//
// Prioridad del lote:
//   (a) candidates con linkedin_url en pipelines ACTIVOS (vacancy_candidates
//       con stage fuera de hired/rejected) — son los que el equipo está
//       trabajando hoy; frescura: last_verified_at NULL o >30 días.
//   (b) sourcing_bank sin promover (candidate_id NULL, source != 'descartado'),
//       mejores scores primero, misma frescura.
//
// Presupuesto: máx 15 perfiles/corrida (≈1 búsqueda dirigida c/u — el tráfico
// del proxy/Serper cuesta), secuencial, y guarda de tiempo: se detiene si
// quedan <8s del límite ~26s de Netlify Functions.
//
// Tolerante a drift: si las columnas de verificación aún no existen
// (migración 20260908000000_reconcile_drift.sql sin aplicar), loggea y sale
// limpio sin tronar.

import { getServiceClient } from './lib/supabase.mjs'
import { enrichProfile, getDispatcher, slugOf } from './auto-source.mjs'
import { normalizeText } from '../../src/lib/excludedCompanies.js'

const BUDGET_MS = 26000       // límite duro de Netlify Functions
const RESERVE_MS = 8000       // para si quedan <8s (update+log también cuestan)
const BATCH_SIZE = 15         // máx búsquedas dirigidas por corrida (tráfico $)
const FRESH_DAYS = 30         // re-verificar solo si pasaron >30 días
const STALE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

// Tokens sin señal para comparar puestos/empresas (conectores + genéricos).
const STOP_TOKENS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'a', 'al', 'con', 'para',
  'por', 'sin', 'the', 'of', 'at', 'in', 'and', 'sa', 'cv', 'sc', 'srl',
  'mexico', 'cdmx', 'linkedin',
])

function tokensOf(s) {
  return normalizeText(s || '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_TOKENS.has(t))
}

/** Proporción de tokens compartidos sobre el set más chico; null = no comparable. */
function overlapRatio(a, b) {
  const at = tokensOf(a)
  const bt = tokensOf(b)
  if (!at.length || !bt.length) return null
  const bSet = new Set(bt)
  const hits = at.filter(t => bSet.has(t)).length
  return hits / Math.min(at.length, bt.length)
}

/** "Nombre - Puesto - Empresa" del headline del SERP → { title, company }. */
function splitHeadline(headline) {
  const parts = (headline || '').split(/\s*[-–—·|]\s*/).map(s => s.trim())
    .filter(Boolean).filter(s => !/linkedin/i.test(s))
  return { title: parts[1] || null, company: parts[2] || null }
}

/** Perfil fantasma: "N connections/contactos" EXACTOS (<50, sin '+'). Mismo
 *  patrón que el filtro ghost de runAutoSource. */
function isGhost(found) {
  const m = `${found.description || ''} ${found.headline || ''}`
    .match(/(\d+)\s*\+?\s*(?:connections?|conexiones|contactos)\b/i)
  return !!(m && !m[0].includes('+') && +m[1] < 50)
}

/**
 * Compara lo encontrado hoy vs lo guardado → { status, details } | { status: null }.
 * saved: { title, company, extraText, createdAt }
 */
function judgeProfile(found, saved) {
  const now = new Date().toISOString()
  if (isGhost(found)) return { status: 'fantasma', details: { checked_at: now } }

  const fresh = splitHeadline(found.headline)
  const newTitle = fresh.title
  const newCompany = fresh.company

  // 1) Empresa vs empresa: la señal más confiable de cambio de empleo.
  if (saved.company && newCompany) {
    const r = overlapRatio(saved.company, newCompany)
    if (r !== null && r === 0) {
      // Empleador claramente distinto. ¿El puesto también cambió o al menos
      // no contradice? De cualquier forma el dato guardado ya no sirve.
      return { status: 'cambio_empleo', details: { new_title: newTitle, new_company: newCompany, checked_at: now } }
    }
    if (r !== null && r > 0) return { status: 'activo', details: { checked_at: now } }
  }

  // 2) Sin empresas comparables → compara el texto completo guardado vs el
  //    headline+descripción de hoy (título, empresa y snippet mezclados).
  const savedText = [saved.title, saved.company, saved.extraText].filter(Boolean).join(' ')
  const foundText = [found.headline, found.description].filter(Boolean).join(' ')
  const r = overlapRatio(savedText, foundText)
  if (r !== null) {
    if (r === 0 && (newTitle || newCompany)) {
      // Nada del perfil guardado aparece hoy y el SERP sí trae puesto/empresa
      // nuevos → cambió de rol/empleo.
      return { status: 'cambio_empleo', details: { new_title: newTitle, new_company: newCompany, checked_at: now } }
    }
    if (r >= 0.2) return { status: 'activo', details: { checked_at: now } }
  }

  // 3) Ambiguo: hay datos pero no comparables (o casi nada coincide sin datos
  //    nuevos claros). Solo condena a 'desactualizado' si la fila es vieja.
  const age = saved.createdAt ? Date.now() - new Date(saved.createdAt).getTime() : 0
  if (age > STALE_YEAR_MS) return { status: 'desactualizado', details: { checked_at: now } }
  return { status: null, details: { checked_at: now } } // deja verify_status como está
}

/** ¿El error de PostgREST huele a "columna no existe" (migración sin aplicar)? */
function isMissingColumn(error) {
  return /column|does not exist|42703/i.test(error?.message || '') || error?.code === '42703'
}

/** Lote (a): candidatos con LinkedIn en pipelines activos. El filtro va sobre
 *  el embed con !inner (NUNCA .in() con listas de ids — patrón prohibido). */
async function fetchPipelineCandidates(supabase, cutoffIso, limit) {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, full_name, linkedin_url, current_title, current_company, notes, created_at, last_verified_at, verify_status, verify_details, vacancy_candidates!inner(stage)')
    .ilike('linkedin_url', '%linkedin.com/in/%')
    .not('vacancy_candidates.stage', 'in', '("hired","rejected")')
    .or(`last_verified_at.is.null,last_verified_at.lt.${cutoffIso}`)
    .order('last_verified_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
  return (data || []).map(c => ({
    table: 'candidates', id: c.id, url: c.linkedin_url,
    verify_status: c.verify_status, verify_details: c.verify_details,
    saved: { title: c.current_title, company: c.current_company, extraText: [c.full_name, c.notes].filter(Boolean).join(' '), createdAt: c.created_at },
  }))
}

/** Lote (b): banco de sourcing sin promover, mejores scores primero. */
async function fetchBankRows(supabase, cutoffIso, limit) {
  if (limit <= 0) return []
  const { data, error } = await supabase
    .from('sourcing_bank')
    .select('id, title, url, snippet, full_name, current_title, current_company, score, created_at, last_verified_at, verify_status, verify_details')
    .is('candidate_id', null)
    .neq('source', 'descartado')
    .ilike('url', '%linkedin.com/in/%')
    .or(`last_verified_at.is.null,last_verified_at.lt.${cutoffIso}`)
    .order('score', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
  return (data || []).map(b => ({
    table: 'sourcing_bank', id: b.id, url: b.url,
    verify_status: b.verify_status, verify_details: b.verify_details,
    saved: { title: b.current_title, company: b.current_company, extraText: [b.full_name || b.title, b.snippet].filter(Boolean).join(' '), createdAt: b.created_at },
  }))
}

export async function handler() {
  const t0 = Date.now()
  const supabase = getServiceClient()
  const cutoffIso = new Date(Date.now() - FRESH_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let batch
  try {
    const pipeline = await fetchPipelineCandidates(supabase, cutoffIso, BATCH_SIZE)
    const bank = await fetchBankRows(supabase, cutoffIso, BATCH_SIZE - pipeline.length)
    batch = [...pipeline, ...bank]
  } catch (e) {
    if (isMissingColumn(e)) {
      console.log('[cron-verify-profiles] columnas de verificación ausentes (¿migración 20260908 sin aplicar?) — nada que hacer:', e.message)
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'migración pendiente' }) }
    }
    console.error('[cron-verify-profiles] no se pudo leer el lote:', e.message)
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) }
  }

  if (!batch.length) {
    console.log('[cron-verify-profiles] todos los perfiles están frescos — nada que verificar')
    return { statusCode: 200, body: JSON.stringify({ ok: true, checked: 0 }) }
  }

  const dispatcher = await getDispatcher()
  const summary = { checked: 0, activo: 0, cambio_empleo: 0, muerto: 0, fantasma: 0, desactualizado: 0, skipped: 0 }

  // SECUENCIAL a propósito: 1 búsqueda dirigida por perfil, sin ráfagas que
  // quemen tráfico del proxy ni créditos de Serper de golpe.
  for (const row of batch) {
    if (Date.now() - t0 > BUDGET_MS - RESERVE_MS) { summary.skipped++; continue }

    const slug = slugOf(row.url)
    if (!slug) { summary.skipped++; continue }

    const prevDetails = (row.verify_details && typeof row.verify_details === 'object') ? row.verify_details : {}
    const update = { last_verified_at: new Date().toISOString() }

    let found = null
    try { found = await enrichProfile(slug, dispatcher) } catch { /* cuenta como miss */ }

    if (!found) {
      // Sin resultado HOY ≠ perfil muerto (motores fallan, rate limits…):
      // acumula el miss y solo con 2 misses en corridas distintas condena.
      const misses = (Number(prevDetails.misses) || 0) + 1
      update.verify_details = { ...prevDetails, misses, last_miss_at: new Date().toISOString() }
      if (misses >= 2) { update.verify_status = 'link_muerto'; summary.muerto++ }
    } else {
      const { status, details } = judgeProfile(found, row.saved)
      // Resultado exitoso → resetea el contador de misses.
      update.verify_details = { ...prevDetails, ...details, misses: 0 }
      if (status) {
        update.verify_status = status
        if (status === 'activo') summary.activo++
        else if (status === 'cambio_empleo') summary.cambio_empleo++
        else if (status === 'fantasma') summary.fantasma++
        else if (status === 'desactualizado') summary.desactualizado++
      }
      // status null = ambiguo y fila joven → verify_status queda como está,
      // solo se refresca last_verified_at (ya en `update`).
    }

    const { error: upErr } = await supabase.from(row.table).update(update).eq('id', row.id)
    if (upErr) {
      console.error(`[cron-verify-profiles] update falló (${row.table}/${row.id}): ${upErr.message}`)
      summary.skipped++
      continue
    }
    summary.checked++
  }

  console.log(`[cron-verify-profiles] listo en ${Date.now() - t0}ms · ${JSON.stringify(summary)}`)
  return { statusCode: 200, body: JSON.stringify({ ok: true, ...summary }) }
}
