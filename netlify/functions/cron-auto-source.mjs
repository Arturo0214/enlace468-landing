// Netlify Scheduled Function — sourcing nocturno automático (FASE 1).
//
// Schedule (netlify.toml): "0 10,11,12 * * 1-5" = 4, 5 y 6am CDMX (UTC-6
// fijo, sin horario de verano), lunes a viernes. Las 3 corridas escalonadas
// acumulan volumen con motores gratuitos: buildQueries baraja las variantes,
// así que corridas sucesivas traen perfiles distintos y el neto de NUEVOS
// crece a lo largo de la madrugada. El digest de las 7am (cron-daily-digest)
// resume lo acumulado.
//
// Cada corrida:
//   1. Toma hasta 2 vacantes abiertas con auto_source_enabled=true — la menos
//      recientemente corrida primero (last_auto_sourced_at NULLS FIRST) para
//      rotación justa entre vacantes.
//   2. Carga las URLs ya conocidas (banco de la vacante + descartados de toda
//      la org, igual que hace el front) → runAutoSource solo devuelve NUEVOS.
//   3. Corre el motor de sourcing (runAutoSource de auto-source.mjs) y
//      upsertea los resultados a sourcing_bank con score/score_details y
//      source='auto-sourced'. ignoreDuplicates:true = ON CONFLICT DO NOTHING
//      sobre (vacancy_id,url) → JAMÁS pisa contact_status ni ningún otro dato
//      de filas existentes.
//   4. Actualiza last_auto_sourced_at (también si la vacante truena, para que
//      un error recurrente no atore la rotación NULLS FIRST).
//
// Presupuesto de tiempo: Netlify corta a ~26s y auto-source tarda ~15-20s por
// vacante → tras la primera, si quedan <15s se detiene; la rotación garantiza
// que la vacante pendiente sea la primera de la siguiente corrida.
//
// Idempotente: correrlo dos veces seguidas no duplica nada (unique
// vacancy_id,url + ignoreDuplicates) y es tolerante: el error de una vacante
// se loggea y se sigue con la siguiente.

import { getServiceClient } from './lib/supabase.mjs'
import { runAutoSource } from './auto-source.mjs'

// Auto-promoción al pipeline según vacancies.auto_promote_min_score.
// APAGADA hasta validar la calidad del sourcing nocturno con el equipo
// (Kari/Ingrid) — se enciende cambiando SOLO este flag.
const AUTO_PROMOTE_ENABLED = false

const BUDGET_MS = 26000       // límite duro de Netlify Functions
const PER_VACANCY_MS = 15000  // costo típico de una vacante (búsqueda+score)
const CRON_MIN_SCORE = 40     // mismo default que el slider de SourcingTab
const CRON_MAX_RESULTS = 30   // meta diaria: ~30 candidatos por vacante

/** Trae TODAS las urls que cumplan el filtro, paginado de a 1000 — el banco
 *  puede tener cientos/miles de filas y PostgREST corta en 1000. OJO: nunca
 *  usar .in() con cientos de ids (bug histórico de pipeline colgado). */
async function fetchUrls(buildQuery) {
  const urls = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const r of data || []) if (r.url) urls.push(r.url)
    if (!data || data.length < PAGE) break
  }
  return urls
}

/** Resultado de runAutoSource → fila de sourcing_bank (score persistido). */
function toBankRow(r, vacancy) {
  const score = Number(r.score)
  const hasScore = Number.isFinite(score)
  return {
    organization_id: vacancy.organization_id,
    vacancy_id: vacancy.id,
    title: r.title || r.full_name || null,
    url: r.url,
    display_url: r.displayUrl || 'linkedin.com',
    snippet: r.snippet || null,
    platform: 'linkedin',
    full_name: r.full_name || r.title || null,
    current_title: r.current_title || null,
    current_company: r.current_company || null,
    source: 'auto-sourced',
    score: hasScore ? score : null,
    score_details: hasScore ? { strengths: r.strengths || [], gaps: r.gaps || [] } : null,
  }
}

/** Auto-promoción server-side (misma semántica que src/lib/promote.js).
 *  Solo corre con AUTO_PROMOTE_ENABLED=true y sobre filas RECIÉN insertadas. */
async function autoPromote(supabase, vacancy, insertedRows) {
  const threshold = Number(vacancy.auto_promote_min_score)
  if (!Number.isFinite(threshold)) return 0
  let promoted = 0
  for (const row of insertedRows) {
    if (!(Number(row.score) >= threshold)) continue
    const { data: bank } = await supabase.from('sourcing_bank').select('*').eq('id', row.id).single()
    if (!bank || bank.candidate_id) continue
    const { data: cand, error } = await supabase.from('candidates').insert({
      organization_id: vacancy.organization_id,
      full_name: bank.full_name || bank.title,
      current_title: bank.current_title || null,
      current_company: bank.current_company || null,
      linkedin_url: bank.url?.includes('linkedin.com') ? bank.url : null,
      source: 'auto-sourced',
      notes: bank.snippet || null,
      tags: ['auto-sourced', 'auto-promoted'],
    }).select().single()
    if (error || !cand) { console.error(`[cron-auto-source] auto-promote falló (${bank.url}): ${error?.message}`); continue }
    await supabase.from('vacancy_candidates').insert({
      vacancy_id: vacancy.id, candidate_id: cand.id, stage: 'sourced',
      match_score: bank.score, match_details: bank.score_details,
    })
    await supabase.from('sourcing_bank').update({ candidate_id: cand.id }).eq('id', bank.id)
    promoted++
  }
  return promoted
}

export async function handler() {
  const t0 = Date.now()
  const supabase = getServiceClient()

  const { data: vacancies, error } = await supabase
    .from('vacancies')
    .select('id, organization_id, title, location, department, company_name, description, challenges, competencies, search_terms, auto_promote_min_score')
    .eq('auto_source_enabled', true)
    .eq('status', 'open')
    .order('last_auto_sourced_at', { ascending: true, nullsFirst: true })
    .limit(2)

  if (error) {
    console.error('[cron-auto-source] no se pudieron leer vacantes:', error.message)
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) }
  }
  if (!vacancies?.length) {
    console.log('[cron-auto-source] sin vacantes con auto_source_enabled — nada que hacer')
    return { statusCode: 200, body: JSON.stringify({ ok: true, processed: [] }) }
  }

  const summary = []
  for (const v of vacancies) {
    if (summary.length && Date.now() - t0 > BUDGET_MS - PER_VACANCY_MS) {
      console.log(`[cron-auto-source] presupuesto de tiempo agotado (${Date.now() - t0}ms) — "${v.title}" queda para la siguiente corrida`)
      break
    }
    try {
      // URLs conocidas: banco de la vacante + descartados de toda la org
      // (mismo criterio que el front) → solo se persisten candidatos nuevos.
      const bankUrls = await fetchUrls(() =>
        supabase.from('sourcing_bank').select('url').eq('vacancy_id', v.id))
      const orgDiscarded = await fetchUrls(() =>
        supabase.from('sourcing_bank').select('url').eq('organization_id', v.organization_id).eq('source', 'descartado'))
      const excludeUrls = [...new Set([...bankUrls, ...orgDiscarded])]

      const { results, counts } = await runAutoSource({
        vacancy: {
          title: v.title, location: v.location, department: v.department,
          company_name: v.company_name, description: v.description,
          challenges: v.challenges, competencies: v.competencies || [],
        },
        excludeUrls,
        options: {
          platform: 'linkedin',
          minScore: CRON_MIN_SCORE,
          maxResults: CRON_MAX_RESULTS,
          searchTerms: v.search_terms || [],
        },
      })

      let inserted = []
      if (results.length) {
        const { data, error: upErr } = await supabase
          .from('sourcing_bank')
          .upsert(results.map(r => toBankRow(r, v)), { onConflict: 'vacancy_id,url', ignoreDuplicates: true })
          .select('id, url, score')
        if (upErr) throw new Error(upErr.message)
        inserted = data || []
      }

      let promoted = 0
      if (AUTO_PROMOTE_ENABLED) promoted = await autoPromote(supabase, v, inserted)

      const filtered = Math.max(0, (counts.found || 0) - (counts.known || 0) - results.length)
      console.log(`[cron-auto-source] "${v.title}": found=${counts.found} known=${counts.known} filtered=${filtered} returned=${results.length} new=${inserted.length}${AUTO_PROMOTE_ENABLED ? ` promoted=${promoted}` : ''}`)
      summary.push({ vacancy_id: v.id, title: v.title, found: counts.found, returned: results.length, new: inserted.length })
    } catch (e) {
      console.error(`[cron-auto-source] error en "${v.title}": ${e.message}`)
      summary.push({ vacancy_id: v.id, title: v.title, error: e.message })
    } finally {
      // Siempre rota — una vacante que truena no debe monopolizar NULLS FIRST.
      const { error: tsErr } = await supabase.from('vacancies')
        .update({ last_auto_sourced_at: new Date().toISOString() }).eq('id', v.id)
      if (tsErr) console.error(`[cron-auto-source] no se pudo actualizar last_auto_sourced_at de "${v.title}": ${tsErr.message}`)
    }
  }

  console.log(`[cron-auto-source] listo en ${Date.now() - t0}ms · ${JSON.stringify(summary)}`)
  return { statusCode: 200, body: JSON.stringify({ ok: true, processed: summary }) }
}
