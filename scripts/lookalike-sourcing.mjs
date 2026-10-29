// Lookalike sourcing — prospección "similar a mis ganadores".
// Toma los candidatos que YA avanzaron en el proceso o fueron contratados
// (stage: interviewing..hired) de cada vacante, extrae sus TÍTULOS reales como
// persona ganadora, y los usa como términos de búsqueda de LinkedIn para traer
// perfiles parecidos al banco. Mismo GATE de calidad que el cron/driver
// (veto seguros, extranjeros, especializado salvo prospección) → cero degradación.
// Los resultados se marcan source='lookalike' para distinguirlos.
//
// Correr con: netlify dev:exec node scripts/lookalike-sourcing.mjs
//   DRIVE_IDS=<vac1,vac2>   (default: vacantes con ≥MIN_WINNERS ganadores y auto_source_enabled)
//   LA_TARGET=120  LA_MAX_ROUNDS=20  LA_DRY=4
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'
import { runAutoSource } from '../netlify/functions/auto-source.mjs'
import { hasMexicoSignal, isForeignProfile, nameLooksLikeRole, checkRoleFit, normalizeLinkedInUrl } from '../src/lib/sourcingScore.js'
import { matchExcludedCompany } from '../src/lib/excludedCompanies.js'

const ADV_STAGES = ['interviewing', 'career_interview', 'evaluated', 'shortlist', 'presented', 'offer', 'hired']
const MIN_WINNERS = parseInt(process.env.LA_MIN_WINNERS, 10) || 5
const TARGET = parseInt(process.env.LA_TARGET, 10) || 120     // nuevos lookalike por vacante
const MAX_ROUNDS = parseInt(process.env.LA_MAX_ROUNDS, 10) || 20
const DRY_LIMIT = parseInt(process.env.LA_DRY, 10) || 4
const MIN_SCORE = 40
const MAX_RESULTS = 60

// Solo títulos que suenan a PUESTO (no empresas/ruido del parseo del SERP).
const ROLE_RE = /director|direcci[oó]n|gerente|ejecutiv|consultor|advisor|manager|\bvp\b|fundador|socio|coordinador|asesor|business|comercial|ventas|key account|partner|country|general manager|owner|propietari|head of/i

function cleanTitle(s) {
  let t = String(s || '')
    .replace(/\s+(at|en)\s+LinkedIn/ig, '')
    .replace(/\s*[|·–—@].*$/, '')           // corta sufijos "| ...", "@ ...", etc.
    .replace(/\.\.\.$/, '')                  // "..." = título truncado por el SERP
    .replace(/[.,;:]+$/, '')                 // puntuación final ("Key Account Manager.")
    .replace(/\s+/g, ' ').trim()
  // conectores colgando al final = título cortado ("Coordinador de Gestion y")
  let prev
  do { prev = t; t = t.replace(/\s+(de|del|y|e|en|la|el|los|las|para|con|a)$/i, '').trim() } while (t !== prev)
  return t
}
function winnerTerms(titles) {
  const seen = new Set(); const terms = []
  for (const raw of titles) {
    const t = cleanTitle(raw)
    if (!t || t === '?' || /\.\.\./.test(t)) continue       // truncados fuera
    if (t.length < 5 || t.length > 42) continue
    if (t.split(' ').length < 2) continue                   // genéricos de 1 palabra fuera
    if (!ROLE_RE.test(t)) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key); terms.push(t)
  }
  return terms
}

// ── GATE (mismo criterio que drive-sourcing / cron) ────────────────────────
function toBankRow(r, vacancy) {
  const score = Number(r.score); const hasScore = Number.isFinite(score)
  return {
    organization_id: vacancy.organization_id, vacancy_id: vacancy.id,
    title: r.title || r.full_name || null, url: r.url,
    display_url: r.displayUrl || 'linkedin.com', snippet: r.snippet || null,
    platform: 'linkedin', full_name: r.full_name || r.title || null,
    current_title: r.current_title || null, current_company: r.current_company || null,
    source: 'lookalike', score: hasScore ? score : null,
    score_details: hasScore ? { strengths: r.strengths || [], gaps: r.gaps || [], lookalike: true } : { lookalike: true },
  }
}
function gateResult(r, soft) {
  const name = r.full_name || r.title || ''
  if (nameLooksLikeRole(name)) return 'garbage'
  if (isForeignProfile(r.url, r.title, r.current_title, r.current_company, r.snippet, { name: r.full_name })) return 'foreign'
  if (matchExcludedCompany(r.current_company, r.current_title, r.title, r.snippet, r.full_name)) return 'vetoed'
  if (!soft && checkRoleFit(r.current_title || r.title || '', r.snippet || '').verdict === 'specialized') return 'specialized'
  if (hasMexicoSignal(r.url, r.title, r.current_title, r.current_company, r.snippet)) return 'mx'
  return 'unknown'
}
function applyGate(results, vacancy, c) {
  const soft = vacancy.prospecting_mode === true || vacancy.entrepreneur_mode === true
  const rows = []
  for (const r of results) {
    const v = gateResult(r, soft)
    if (v === 'garbage') { c.garbage++; continue }
    if (v === 'foreign') { c.foreign++; continue }
    if (v === 'vetoed') { c.vetoed++; continue }
    if (v === 'specialized') { c.specialized++; continue }
    const row = toBankRow(r, vacancy)
    if (v === 'unknown') { row.verify_status = 'geo_desconocida'; c.quarantined++ }
    rows.push(row)
  }
  return rows
}
async function fetchUrls(buildQuery) {
  const urls = []; const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const r of data || []) if (r.url) urls.push(r.url)
    if (!data || data.length < PAGE) break
  }
  return urls
}
async function countLookalike(sb, vid) {
  const { data } = await sb.from('sourcing_bank').select('id').eq('vacancy_id', vid).eq('source', 'lookalike')
  return (data || []).length
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const CITIES_FALLBACK = ['Ciudad de Mexico', 'Monterrey', 'Guadalajara', 'Queretaro', 'Puebla', 'Merida']

async function winnersDeVacante(sb, vid) {
  const out = []; const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('vacancy_candidates')
      .select('stage, candidates(current_title)').eq('vacancy_id', vid).in('stage', ADV_STAGES).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const r of data || []) if (r.candidates && r.candidates.current_title) out.push(r.candidates.current_title)
    if (!data || data.length < PAGE) break
  }
  return out
}

async function lookalikeVacante(sb, v) {
  const titles = await winnersDeVacante(sb, v.id)
  const terms = winnerTerms(titles)
  if (terms.length < 3) { console.log(`\n⏭  ${v.title}: solo ${terms.length} títulos-persona válidos (${titles.length} ganadores) — se omite`); return { title: v.title, skipped: true } }
  const cities = (v.location ? v.location.split(/[,/]/).map(s => s.trim()).filter(Boolean) : []).concat(CITIES_FALLBACK).slice(0, 8)
  const ent = v.entrepreneur_mode === true
  const start = await countLookalike(sb, v.id)
  console.log(`\n=== ${v.title} === ${titles.length} ganadores → ${terms.length} términos persona · inicio lookalike=${start}`)
  console.log(`   persona: ${terms.slice(0, 12).join(' | ')}`)

  let dry = 0, added = 0
  for (let r = 0; r < MAX_ROUNDS; r++) {
    const cur = await countLookalike(sb, v.id)
    if (cur - start >= TARGET) { console.log(`  ✓ meta +${TARGET} alcanzada`); break }
    if (dry >= DRY_LIMIT) { console.log(`  ⚠ ${DRY_LIMIT} rondas secas — corto en +${cur - start}`); break }

    const off = r % terms.length
    const rot = [...terms.slice(off), ...terms.slice(0, off)]
    const roundLocation = cities[r % cities.length]

    const bankUrls = await fetchUrls(() => sb.from('sourcing_bank').select('url').eq('vacancy_id', v.id))
    const orgDisc = await fetchUrls(() => sb.from('sourcing_bank').select('url').eq('organization_id', v.organization_id).eq('source', 'descartado'))
    const excludeUrls = [...new Set([...bankUrls, ...orgDisc].map(normalizeLinkedInUrl))]

    let inserted = []
    const gc = { garbage: 0, foreign: 0, vetoed: 0, specialized: 0, quarantined: 0 }
    try {
      const { results, counts: rc } = await runAutoSource({
        vacancy: { title: v.title, location: roundLocation, department: v.department, company_name: v.company_name, description: v.description, challenges: v.challenges, competencies: v.competencies || [] },
        excludeUrls,
        options: { platform: 'linkedin', minScore: MIN_SCORE, maxResults: MAX_RESULTS, searchTerms: rot, onlyEntrepreneurs: ent },
      })
      const rows = applyGate(results, v, gc)
      if (rows.length) {
        const { data } = await sb.from('sourcing_bank')
          .upsert(rows, { onConflict: 'vacancy_id,url', ignoreDuplicates: true }).select('id, url')
        inserted = data || []
      }
      process.stdout.write(`  r${r} "${rot[0]}" @${roundLocation} found=${rc.found} new=${inserted.length} (veto=${gc.vetoed} ext=${gc.foreign} esp=${gc.specialized} q=${gc.quarantined})\n`)
    } catch (e) { process.stdout.write(`  r${r} ERROR: ${e.message}\n`) }
    added += inserted.length
    dry = inserted.length === 0 ? dry + 1 : 0
    await sleep(1500)
  }
  const end = await countLookalike(sb, v.id)
  console.log(`  → FIN ${v.title}: lookalike=${end} (+${end - start})`)
  return { title: v.title, added: end - start, terms: terms.length }
}

async function main() {
  const sb = getServiceClient()
  const ids = process.env.DRIVE_IDS ? process.env.DRIVE_IDS.split(',').map(s => s.trim()) : null
  let q = sb.from('vacancies')
    .select('id, organization_id, title, location, department, company_name, description, challenges, competencies, entrepreneur_mode, prospecting_mode, auto_source_enabled, status')
    .eq('status', 'open')
  if (ids) q = q.in('id', ids); else q = q.eq('auto_source_enabled', true)
  const { data: vacancies, error } = await q
  if (error) { console.error('No se pudieron leer vacantes:', error.message); process.exit(1) }

  console.log(`Lookalike sourcing · ${vacancies.length} vacante(s) · meta +${TARGET} c/u`)
  const out = []
  for (const v of vacancies) out.push(await lookalikeVacante(sb, v))

  console.log('\n===== RESUMEN LOOKALIKE =====')
  for (const o of out) console.log(o.skipped ? `⏭  ${o.title}: sin señal suficiente` : `${o.added > 0 ? '✅' : '🟡'} ${o.title}: +${o.added} lookalike (${o.terms} términos persona)`)
  console.log('LOOKALIKE_TERMINADO')
}
main()
