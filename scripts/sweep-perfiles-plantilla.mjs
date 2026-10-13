// Descarta perfiles "plantilla" (sin texto personal = sin Acerca-de, correlato
// de perfiles muertos tipo Alfredo Rojo: 0 followers, sin posts). Solo filas
// auto-sourced/web-sourced/sourced. Dry default; SCAN_APPLY=1 aplica.
// Además descarta espejo los purgados de FSC (/tmp/fsc-muertos.json).
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'
import { readFileSync, existsSync } from 'fs'
const sb = getServiceClient()
const VACS = {
  'cccccccc-1111-4111-8111-cccccccccc01': 'Médicos PPR',
  'cccccccc-2222-4222-8222-cccccccccc02': 'PyME Fiscal',
  'cccccccc-3333-4333-8333-cccccccccc03': 'Patrimonio 50+',
  'c596fba3-790c-4ba1-9341-1d295514cffe': 'SD Centro',
  '63ca7468-e58f-4d2f-935c-5c9cdfce8b74': 'SD Norte',
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb': 'SD Generica',
  '3a8abc52-4452-4772-aa16-d3072e4ad686': 'Socio director nueva',
  'd77ec3ed-b4ef-44ae-9192-91690edc8750': 'FINANCE CONSULTANT',
  '45f33b65-6e6e-49a8-8c3b-597fc903b634': 'Cero Hipoteca',
}
const canon = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^[a-z0-9-]{2,3}\./, '')
  .replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/(\/in\/[^/]+)\/[a-z]{2}(-[a-z]{2})?$/, '$1')
const PERSONAL = /(\bsoy\b|\bme \w|\bmi \w|ayudo|ayudando|con m[aá]s de|a[ñn]os de (experiencia|trayectoria)|experiencia en|especialista en|especializad|apasionad|lider(ando|azgo)?|fund[eé]|he \w|dedicad|enfocad|comprometid|brindamos|ofrecemos|somos)/i
const tieneSustancia = (snippet) => {
  const segs = String(snippet || '').split(/\s*·\s*/).map(s => s.trim()).filter(Boolean)
  return segs.some(s => {
    if (/^(experiencia|ubicaci[oó]n|educaci[oó]n|linkedin)\s*:/i.test(s)) return false
    return s.length >= 70 || PERSONAL.test(s)
  })
}
const fscMuertos = existsSync('/tmp/fsc-muertos.json')
  ? new Set(JSON.parse(readFileSync('/tmp/fsc-muertos.json', 'utf8')).map(m => canon(m.url)).filter(Boolean)) : new Set()
const apply = process.env.SCAN_APPLY === '1'
let total = 0
for (const [vid, name] of Object.entries(VACS)) {
  const hits = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('sourcing_bank')
      .select('id, url, snippet, notes, full_name')
      .eq('vacancy_id', vid).in('source', ['auto-sourced', 'web-sourced', 'sourced']).is('verify_status', null)
      .range(from, from + 999)
    for (const r of data || []) {
      // Altas manuales verificadas 1x1 (snippet sintético mío): no aplica la heurística
      if (/verificado a mano/i.test(r.snippet || '') && !fscMuertos.has(canon(r.url))) continue
      const espejo = fscMuertos.has(canon(r.url))
      if (espejo || !tieneSustancia(r.snippet)) hits.push({ id: r.id, notes: r.notes, espejo })
    }
    if (!data || data.length < 1000) break
  }
  total += hits.length
  console.log(`>> ${name}: ${hits.length} plantilla/muertos`)
  if (apply) for (const h of hits) {
    await sb.from('sourcing_bank').update({
      source: 'descartado', verify_status: 'descartado_qa',
      notes: `${h.notes || ''} · auto-descartado: perfil plantilla sin texto personal (proxy de perfil inactivo) 2026-10-13`.replace(/^ · /, ''),
    }).eq('id', h.id)
  }
}
console.log(`TOTAL ${total} ${apply ? 'DESCARTADOS' : '(dry-run)'}`)
process.exit(0)
