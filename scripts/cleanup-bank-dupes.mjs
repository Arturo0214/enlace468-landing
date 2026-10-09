// Limpieza del banco de sourcing (incidente Karina 2026-10-08):
//  1. DUPLICADOS por variante de URL (/en, mx. vs www., slash final): el
//     normalizeLinkedInUrl viejo no los unificaba, así que perfiles DESCARTADOS
//     reaparecían como filas nuevas. Regla por grupo (vacante + URL canónica):
//       - nunca se toca una fila con candidate_id (ya está en el pipeline)
//       - si el grupo tiene una fila 'descartado' → se BORRAN las variantes
//         visibles sin candidate_id (el descarte vuelve a mandar)
//       - si todas son visibles → se conserva la más vieja, se borran las demás
//  2. EXTRANJEROS visibles: re-corre isForeignProfile (name-stripped) sobre
//     todas las filas visibles de las vacantes de reclutamiento y marca
//     verify_status='extranjero' a los que tengan señal real de otro país.
// Correr con: netlify dev:exec node scripts/cleanup-bank-dupes.mjs
// DRY RUN por default; aplicar con CLEANUP_APPLY=1
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'
import { normalizeLinkedInUrl, isForeignProfile, detectForeignLocation } from '../src/lib/sourcingScore.js'

const ORG = '0d7b85ac-a473-4ef4-8a36-4bcb0542aafc'
const APPLY = process.env.CLEANUP_APPLY === '1'
const RECRUIT_VACANCIES = [
  'd77ec3ed-b4ef-44ae-9192-91690edc8750', // Finance Consultant
  '45f33b65-6e6e-49a8-8c3b-597fc903b634', // Consultor Inmobiliario
  'c596fba3-790c-4ba1-9341-1d295514cffe', // Socio Director Centro
  '63ca7468-e58f-4d2f-935c-5c9cdfce8b74', // Socio Director Norte
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', // Socio Director genérica
]

async function fetchAll(sb, build) {
  const rows = []; const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

async function main() {
  const sb = getServiceClient()
  console.log(APPLY ? '== APLICANDO cambios ==' : '== DRY RUN (CLEANUP_APPLY=1 para aplicar) ==')

  const rows = await fetchAll(sb, () => sb.from('sourcing_bank')
    .select('id, vacancy_id, url, source, verify_status, candidate_id, created_at, full_name, title, current_title, current_company, snippet')
    .eq('organization_id', ORG).order('created_at'))
  console.log(`${rows.length} filas en el banco de la org`)

  // ── 1. Duplicados por URL canónica dentro de la misma vacante ──
  const groups = new Map()
  for (const r of rows) {
    const key = `${r.vacancy_id}|${normalizeLinkedInUrl(r.url)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  const toDelete = []
  for (const [key, g] of groups) {
    if (g.length < 2) continue
    const deletable = g.filter(r => !r.candidate_id)
    const hasDiscard = g.some(r => r.source === 'descartado')
    let keep
    if (g.some(r => r.candidate_id)) {
      // ya hay fila(s) en pipeline: se quedan; de las demás solo sobrevive el descartado (memoria del descarte)
      keep = deletable.find(r => r.source === 'descartado') || null
    } else if (hasDiscard) {
      keep = deletable.find(r => r.source === 'descartado')
    } else {
      keep = deletable[0] // la más vieja (rows viene ordenado por created_at)
    }
    for (const r of deletable) {
      if (keep && r.id === keep.id) continue
      toDelete.push(r)
      console.log(`  DUP ${hasDiscard ? '(descartado reaparecido)' : ''} ${r.full_name || r.title || '?'} · ${r.url} [${r.source}] → borrar`)
    }
  }
  console.log(`Duplicados a borrar: ${toDelete.length}`)
  if (APPLY && toDelete.length) {
    const ids = toDelete.map(r => r.id)
    for (let i = 0; i < ids.length; i += 80) {
      const { error } = await sb.from('sourcing_bank').delete().in('id', ids.slice(i, i + 80))
      if (error) throw new Error(error.message)
    }
    console.log('  ✓ borrados')
  }

  // ── 2. Extranjeros visibles en vacantes de reclutamiento ──
  const deletedIds = new Set(toDelete.map(r => r.id))
  const visible = rows.filter(r =>
    RECRUIT_VACANCIES.includes(r.vacancy_id) && !deletedIds.has(r.id) &&
    r.source !== 'descartado' && r.verify_status == null && !r.candidate_id)
  const foreign = []
  for (const r of visible) {
    const name = r.full_name || r.title || ''
    if (isForeignProfile(r.url, r.title, r.current_title, r.current_company, r.snippet, { name })) {
      const signal = detectForeignLocation([r.title, r.current_title, r.current_company, r.snippet].filter(Boolean).join(' '), name)
      foreign.push(r)
      console.log(`  EXT ${name} · ${r.url} · señal="${signal || 'subdominio'}"`)
    }
  }
  console.log(`Extranjeros visibles a marcar: ${foreign.length}`)
  if (APPLY && foreign.length) {
    const ids = foreign.map(r => r.id)
    for (let i = 0; i < ids.length; i += 80) {
      const { error } = await sb.from('sourcing_bank')
        .update({ verify_status: 'extranjero' }).in('id', ids.slice(i, i + 80))
      if (error) throw new Error(error.message)
    }
    console.log('  ✓ marcados extranjero')
  }
  console.log('CLEANUP_TERMINADO')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
