// Cards VISIBLES de Finance Consultant sin NINGUNA señal de México (el gate
// actual las habría mandado a cuarentena geo_desconocida; estas son anteriores
// al gate — entre ellas viven los "perfiles de EUA" que reporta Karina).
// Solo reporta; aplicar cuarentena con SCAN_APPLY=1.
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'
import { hasMexicoSignal } from '../src/lib/sourcingScore.js'

const FC = 'd77ec3ed-b4ef-44ae-9192-91690edc8750'
const APPLY = process.env.SCAN_APPLY === '1'

async function main() {
  const sb = getServiceClient()
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('sourcing_bank')
      .select('id, url, source, full_name, title, current_title, current_company, snippet, candidate_id')
      .eq('vacancy_id', FC).neq('source', 'descartado').is('verify_status', null).is('candidate_id', null)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const noMx = rows.filter(r => !hasMexicoSignal(r.url, r.title, r.current_title, r.current_company, r.snippet))
  for (const r of noMx) console.log(`SIN-MX ${r.full_name || r.title || '?'} · ${r.url} · [${r.source}]`)
  console.log(`${noMx.length} de ${rows.length} cards visibles sin señal de México`)
  if (APPLY && noMx.length) {
    const ids = noMx.map(r => r.id)
    for (let i = 0; i < ids.length; i += 80) {
      const { error } = await sb.from('sourcing_bank')
        .update({ verify_status: 'geo_desconocida', last_verified_at: null }).in('id', ids.slice(i, i + 80))
      if (error) throw new Error(error.message)
    }
    console.log('✓ a cuarentena geo_desconocida (la verificación las resolverá)')
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
