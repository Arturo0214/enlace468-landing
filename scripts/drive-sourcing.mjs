// Driver de sourcing directo — exprime el motor gratis al máximo:
//  - SIN el límite de 26s del cron (procesa cada vacante a fondo)
//  - ROTA los 20 términos (el motor solo usa 4 por llamada) → mucho más pool
//  - Reutiliza el GATE DE CALIDAD exacto del cron (gateResult/applyGate/toBankRow)
//    y autoPromote → cero degradación de calidad.
// Correr con: netlify dev:exec node scripts/drive-sourcing.mjs
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'
import { runAutoSource } from '../netlify/functions/auto-source.mjs'
import { autoPromote } from '../netlify/functions/cron-auto-source.mjs'
import { hasMexicoSignal, isForeignProfile, nameLooksLikeRole, checkRoleFit, normalizeLinkedInUrl } from '../src/lib/sourcingScore.js'
import { matchExcludedCompany } from '../src/lib/excludedCompanies.js'

const TARGET = parseInt(process.env.DRIVE_TARGET, 10) || 150   // meta de auto-sourced por vacante
const MAX_ROUNDS = parseInt(process.env.DRIVE_MAX_ROUNDS, 10) || 45  // tope por vacante
const DRY_LIMIT = parseInt(process.env.DRIVE_DRY, 10) || 4     // rondas secas seguidas → corta
const MIN_SCORE = 40
const MAX_RESULTS = 60

// ── GATE (verbatim del cron) ───────────────────────────────────────────────
function toBankRow(r, vacancy) {
  const score = Number(r.score)
  const hasScore = Number.isFinite(score)
  return {
    organization_id: vacancy.organization_id, vacancy_id: vacancy.id,
    title: r.title || r.full_name || null, url: r.url,
    display_url: r.displayUrl || 'linkedin.com', snippet: r.snippet || null,
    platform: 'linkedin', full_name: r.full_name || r.title || null,
    current_title: r.current_title || null, current_company: r.current_company || null,
    source: 'auto-sourced', score: hasScore ? score : null,
    score_details: hasScore ? { strengths: r.strengths || [], gaps: r.gaps || [] } : null,
  }
}
function gateResult(r) {
  const name = r.full_name || r.title || ''
  if (nameLooksLikeRole(name)) return 'garbage'
  if (isForeignProfile(r.url, r.title, r.current_title, r.current_company, r.snippet, { name: r.full_name })) return 'foreign'
  if (matchExcludedCompany(r.current_company, r.current_title, r.title, r.snippet, r.full_name)) return 'vetoed'
  if (checkRoleFit(r.current_title || r.title || '', r.snippet || '').verdict === 'specialized') return 'specialized'
  if (hasMexicoSignal(r.url, r.title, r.current_title, r.current_company, r.snippet)) return 'mx'
  return 'unknown'
}
function applyGate(results, vacancy, c) {
  const rows = []
  for (const r of results) {
    const v = gateResult(r)
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
async function counts(sb, vid) {
  const { data } = await sb.from('sourcing_bank')
    .select('verify_status, source').eq('vacancy_id', vid).eq('source', 'auto-sourced')
  const total = (data || []).length
  const visible = (data || []).filter(r => r.verify_status == null).length
  return { total, visible }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Ciudades por vacante para ROTAR location en modo emprendedor (las queries de
// fundador/dueño usan vacancy.location → variarla multiplica el pool bruto).
const CITY_ROTATION = {
  '63ca7468-e58f-4d2f-935c-5c9cdfce8b74': ['Monterrey','Saltillo','Chihuahua','Torreon','Hermosillo','Culiacan','Tijuana','San Luis Potosi','Durango','Mexicali'],
  'c596fba3-790c-4ba1-9341-1d295514cffe': ['Ciudad de Mexico','Puebla','Queretaro','Toluca','Cuernavaca','Pachuca','Morelia','Leon','Estado de Mexico','Tlaxcala'],
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb': ['Guadalajara','Ciudad de Mexico','Monterrey','Puebla','Queretaro','Merida','Leon','Cancun','Tijuana','Aguascalientes'],
}

async function driveVacancy(sb, v) {
  const start = await counts(sb, v.id)
  const ent = v.entrepreneur_mode === true
  const terms = (v.search_terms || []).map(String)
  const step = ent ? 1 : 4                 // ent: rota el "flavor" [0]; comercial: grupos de 4
  console.log(`\n=== ${v.title} === inicio: total=${start.total} visible=${start.visible} · ${terms.length} términos · ${ent ? 'EMPRENDEDOR' : 'comercial'}`)
  let dry = 0, added = 0
  for (let r = 0; r < MAX_ROUNDS; r++) {
    const cur = await counts(sb, v.id)
    if (cur.total >= TARGET) { console.log(`  ✓ meta ${TARGET} alcanzada (total=${cur.total})`); break }
    if (dry >= DRY_LIMIT) { console.log(`  ⚠ ${DRY_LIMIT} rondas secas (proxy agotado) — corto en total=${cur.total}`); break }

    const off = (r * step) % (terms.length || 1)
    const rot = [...terms.slice(off), ...terms.slice(0, off)]
    // Modo emprendedor: rota la ciudad de location para diversificar las
    // queries fijas de fundador/dueño (si no, repiten location y traen ~0).
    const cities = CITY_ROTATION[v.id]
    const roundLocation = (ent && cities) ? cities[r % cities.length] : v.location

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
        const { data, error } = await sb.from('sourcing_bank')
          .upsert(rows, { onConflict: 'vacancy_id,url', ignoreDuplicates: true }).select('id, url, score')
        if (error) throw new Error(error.message)
        inserted = data || []
      }
      if (inserted.length) await autoPromote(sb, v, inserted)
      process.stdout.write(`  r${r} lead="${rot[0]}" found=${rc.found} new=${inserted.length} (q=${gc.quarantined} veto=${gc.vetoed} ext=${gc.foreign} esp=${gc.specialized})\n`)
    } catch (e) {
      process.stdout.write(`  r${r} ERROR: ${e.message}\n`)
    }
    added += inserted.length
    dry = inserted.length === 0 ? dry + 1 : 0
    await sleep(1500)
  }
  const end = await counts(sb, v.id)
  console.log(`  → FIN ${v.title}: total=${end.total} (+${end.total - start.total}) visible=${end.visible}`)
  return { title: v.title, total: end.total, visible: end.visible, added: end.total - start.total }
}

async function main() {
  const sb = getServiceClient()
  const ids = process.env.DRIVE_IDS ? process.env.DRIVE_IDS.split(',') : null
  let q = sb.from('vacancies')
    .select('id, organization_id, title, location, department, company_name, description, challenges, competencies, search_terms, auto_promote_min_score, entrepreneur_mode')
    .eq('auto_source_enabled', true).eq('status', 'open')
  if (ids) q = q.in('id', ids)
  const { data: vacancies, error } = await q
  if (error) { console.error('no se pudieron leer vacantes:', error.message); process.exit(1) }
  console.log(`Driver de sourcing · ${vacancies.length} vacantes · meta ${TARGET} c/u`)
  const out = []
  for (const v of vacancies) out.push(await driveVacancy(sb, v))
  console.log('\n===== RESUMEN =====')
  for (const o of out) console.log(`${o.total >= TARGET ? '✅' : '🟡'} ${o.title}: total=${o.total} visible=${o.visible} (+${o.added})`)
  console.log('DRIVE_TERMINADO')
  process.exit(0)
}
main()
