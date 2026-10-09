// Escanea TODAS las filas vivas del banco (incluidas las ya promovidas al
// pipeline) de las vacantes de reclutamiento con isForeignProfile (name-
// stripped) y reporta las que tienen señal real de otro país + su stage.
// Solo REPORTA — no toca nada. netlify dev:exec node scripts/scan-foreign-promoted.mjs
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'
import { isForeignProfile, detectForeignLocation, hasMexicoSignal } from '../src/lib/sourcingScore.js'

const ORG = '0d7b85ac-a473-4ef4-8a36-4bcb0542aafc'
const VACS = {
  'd77ec3ed-b4ef-44ae-9192-91690edc8750': 'Finance Consultant',
  '45f33b65-6e6e-49a8-8c3b-597fc903b634': 'Consultor Inmobiliario',
  'c596fba3-790c-4ba1-9341-1d295514cffe': 'SD Centro',
  '63ca7468-e58f-4d2f-935c-5c9cdfce8b74': 'SD Norte',
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb': 'SD Genérica',
}

async function main() {
  const sb = getServiceClient()
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('sourcing_bank')
      .select('id, vacancy_id, url, source, verify_status, candidate_id, full_name, title, current_title, current_company, snippet')
      .eq('organization_id', ORG).in('vacancy_id', Object.keys(VACS))
      .neq('source', 'descartado').is('verify_status', null)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  console.log(`${rows.length} filas vivas visibles`)
  const candIds = rows.filter(r => r.candidate_id).map(r => r.candidate_id)
  const stageByCand = new Map()
  for (let i = 0; i < candIds.length; i += 80) {
    const { data } = await sb.from('vacancy_candidates').select('candidate_id, vacancy_id, stage')
      .in('candidate_id', candIds.slice(i, i + 80))
    for (const vc of data || []) stageByCand.set(`${vc.candidate_id}|${vc.vacancy_id}`, vc.stage)
  }
  let n = 0
  for (const r of rows) {
    const name = r.full_name || r.title || ''
    const foreign = isForeignProfile(r.url, r.title, r.current_title, r.current_company, r.snippet, { name })
    if (!foreign) continue
    n++
    const signal = detectForeignLocation([r.title, r.current_title, r.current_company, r.snippet].filter(Boolean).join(' '), name) || 'subdominio'
    const stage = r.candidate_id ? (stageByCand.get(`${r.candidate_id}|${r.vacancy_id}`) || 'sin-vc') : 'card'
    console.log(`EXT [${VACS[r.vacancy_id]}] ${name} · ${r.url} · señal=${signal} · stage=${stage} · bank_id=${r.id}`)
  }
  console.log(`Total con señal extranjera: ${n}`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
