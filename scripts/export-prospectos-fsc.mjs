// Exporta los prospectos de VENTA (campañas prospecting) a JSON para migrarlos
// al CRM de financescool (crm_mejores_leads). Solo visibles y de calidad:
// source != 'descartado' y sin cuarentena. netlify dev:exec node scripts/export-prospectos-fsc.mjs
import { writeFileSync } from 'fs'
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'

const CAMPAIGNS = {
  'cccccccc-1111-4111-8111-cccccccccc01': 'linkedin-medicos',
  'cccccccc-2222-4222-8222-cccccccccc02': 'linkedin-pyme',
  'cccccccc-3333-4333-8333-cccccccccc03': 'linkedin-patrimonio',
}
const CAMPANA = {
  'linkedin-medicos': 'Médicos PPR (bancarización)',
  'linkedin-pyme': 'PyME Fiscal',
  'linkedin-patrimonio': 'Patrimonio · PPR · Contigo 50+ (Arturo)',
}

async function main() {
  const sb = getServiceClient()
  const out = []
  for (const [vid, bucket] of Object.entries(CAMPAIGNS)) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('sourcing_bank')
        .select('url, full_name, title, current_title, current_company, snippet, score, created_at')
        .eq('vacancy_id', vid).neq('source', 'descartado').is('verify_status', null)
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      for (const r of data || []) {
        // Solo perfiles con texto PERSONAL en el snippet (proxy de perfil vivo;
        // los "plantilla" tipo Alfredo Rojo —0 followers, sin posts— se quedan fuera).
        const segs = String(r.snippet || '').split(/\s*·\s*/).map(x => x.trim()).filter(Boolean)
        const PERSONAL = /(\bsoy\b|\bme \w|\bmi \w|ayudo|ayudando|con m[aá]s de|a[ñn]os de (experiencia|trayectoria)|experiencia en|especialista en|especializad|apasionad|lider(ando|azgo)?|fund[eé]|he \w|dedicad|enfocad|comprometid|brindamos|ofrecemos|somos)/i
        const vivo = segs.some(x => !/^(experiencia|ubicaci[oó]n|educaci[oó]n|linkedin)\s*:/i.test(x) && (x.length >= 70 || PERSONAL.test(x)))
        if (!vivo) continue
        out.push({
          bucket, campana: CAMPANA[bucket],
          nombre: r.full_name || r.title || 'Perfil LinkedIn',
          perfil: r.current_title || null,
          url: r.url,
          empresa: r.current_company || null,
          snippet: (r.snippet || '').slice(0, 300),
          score: typeof r.score === 'number' ? r.score : null,
          fecha_lead: String(r.created_at).slice(0, 10),
        })
      }
      if (!data || data.length < 1000) break
    }
  }
  writeFileSync('/tmp/prospectos-fsc.json', JSON.stringify(out, null, 1))
  const porBucket = {}
  for (const p of out) porBucket[p.bucket] = (porBucket[p.bucket] || 0) + 1
  console.log('Exportados:', out.length, porBucket)
}
main().catch(e => { console.error(e); process.exit(1) })
