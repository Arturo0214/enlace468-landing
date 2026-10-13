// Barrido de calidad "patrón Karina" (2026-10-13): reglas aprendidas de sus
// 241 descartes manuales + 605 contactados. Aplica a los bancos VISIBLES de
// las 6 vacantes que trabaja. Dry-run por default; SCAN_APPLY=1 descarta.
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'
const sb = getServiceClient()
const VACS = {
  'c596fba3-790c-4ba1-9341-1d295514cffe': 'SD Centro',
  '63ca7468-e58f-4d2f-935c-5c9cdfce8b74': 'SD Norte',
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb': 'SD Generica',
  '3a8abc52-4452-4772-aa16-d3072e4ad686': 'Socio director nueva',
  'd77ec3ed-b4ef-44ae-9192-91690edc8750': 'FINANCE CONSULTANT',
  '45f33b65-6e6e-49a8-8c3b-597fc903b634': 'Cero Hipoteca',
}
const CH = '45f33b65-6e6e-49a8-8c3b-597fc903b634'
const FC = 'd77ec3ed-b4ef-44ae-9192-91690edc8750'

// Reglas GLOBALES (todas las vacantes)
const G = [
  [/agente de seguros|de fianzas\b|asesor .{0,20}seguros|promotor[ií]a de seguros|seguros y fianzas/i, 'seguros/fianzas (veto Karina)'],
  [/herbalife|herbslife|omnilife|amway|ariix|multinivel|network marketing/i, 'multinivel'],
  [/coach de vida|life coach|creador de contenido|content creator|influencer|conferencista|speaker motivacional/i, 'coach/creador'],
  [/(asesor|consultor) (en|de) finanzas personales/i, 'asesor finanzas personales'],
  [/(deloitte|kpmg|pwc|pricewaterhouse|ernst & young|pkf|mckinsey|bain & co|accenture|talengo)/i, 'socio de firma grande (no se mueve)'],
]
// FINANCE CONSULTANT extra
const RFC = [
  [/^financial consultant$|^consultor financiero$|^asesor$/i, 'título genérico sin datos'],
  [/ejecutivo de (cuenta|marca|cr[eé]dito|cobranza|financiamiento)/i, 'ejecutivo junior'],
]
// Cero Hipoteca extra: competidores broker + banca tradicional
const RCH = [
  [/creditaria|soc asesores|asociaci[oó]n de brokers/i, 'broker competidor'],
  [/\b(bbva|santander|banorte|hsbc|scotiabank|banamex|citibanamex|banregio)\b/i, 'empleado bancario'],
]
// "Sin datos juzgables" = patrón que Karina descartó a mano: tarjetas slug
// (ferpujolmalo, alexis-torres-mtz) o sin NINGÚN dato (ni puesto, ni empresa,
// ni snippet con sustancia, ni rol en el título del SERP).
const lowInfo = (r) => {
  const titulo = (r.title || '').trim()
  const esSlug = titulo && !titulo.includes(' ')
  const sinRol = !(r.current_title || '').trim() && !/ [-–|] /.test(titulo)
  const sinSustancia = !r.current_company && (!r.snippet || r.snippet.trim().length < 80)
  return esSlug || (sinRol && sinSustancia)
}

const apply = process.env.SCAN_APPLY === '1'
let totalHits = 0
for (const [vid, name] of Object.entries(VACS)) {
  const reglas = [...G, ...(vid === FC ? RFC : []), ...(vid === CH ? RCH : [])]
  const hits = []
  for (let from = 0; ; from += 1000) {
    // SOLO filas auto-sourceadas: los imports manuales de Karina (source
    // 'manual'/'linkedin', solo traen el nombre) son suyos y NO se tocan.
    const { data, error } = await sb.from('sourcing_bank')
      .select('id, title, current_title, current_company, snippet, notes')
      .eq('vacancy_id', vid).in('source', ['auto-sourced', 'web-sourced', 'sourced'])
      .is('verify_status', null)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of data || []) {
      const texto = `${r.current_title || ''} · ${r.current_company || ''} · ${r.title || ''} · ${(r.snippet || '').slice(0, 200)}`
      let razon = null
      for (const [re, label] of reglas) if (re.test(texto)) { razon = label; break }
      if (!razon && lowInfo(r)) razon = 'sin datos juzgables'
      if (razon) hits.push({ id: r.id, razon, t: (r.current_title || r.title || '').slice(0, 70), notes: r.notes })
    }
    if (!data || data.length < 1000) break
  }
  totalHits += hits.length
  console.log(`>> ${name}: ${hits.length} a descartar`)
  const porRazon = {}
  for (const h of hits) porRazon[h.razon] = (porRazon[h.razon] || 0) + 1
  console.log('   ', JSON.stringify(porRazon))
  for (const h of hits.slice(0, 6)) console.log(`    - [${h.razon}] ${h.t}`)
  if (apply) {
    for (const h of hits) {
      await sb.from('sourcing_bank').update({
        source: 'descartado', verify_status: 'descartado_qa',
        notes: `${h.notes || ''} · auto-descartado: ${h.razon} (barrido patrón Karina 2026-10-13)`.replace(/^ · /, ''),
      }).eq('id', h.id)
    }
    console.log(`    ✓ aplicado`)
  }
}
console.log(`TOTAL: ${totalHits} ${apply ? 'descartados' : 'detectados (dry-run)'}`)
process.exit(0)
