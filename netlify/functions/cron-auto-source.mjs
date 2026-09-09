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
import { hasMexicoSignal, isForeignProfile, nameLooksLikeRole, checkRoleFit, normalizeLinkedInUrl } from '../../src/lib/sourcingScore.js'

// Auto-promoción al pipeline según vacancies.auto_promote_min_score.
// ENCENDIDA (2026-09-08): el gating real es POR VACANTE — solo promueve si
// auto_promote_min_score no es null (la UI lo deja vacío por default) y el
// candidato pasó el gate de calidad (nunca cuarentena geo_desconocida ni
// extranjero). Este flag queda como kill-switch global de emergencia.
const AUTO_PROMOTE_ENABLED = true

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

// ── GATE DE CALIDAD (pedido del dueño 2026-09-07) ──────────────────────────
// "Asegúrate de que siempre se escojan buenos candidatos, si no, mándalos a la
// basura" + "que no aparezca gente de otros países". Tres niveles sobre CADA
// resultado ANTES de tocar el banco:
//   basura        → nombre de rol/giro, no de persona → NO se inserta
//   extranjero    → señal de otro país (doble candado sobre los campos finales;
//                   runAutoSource ya filtra, pero aquí van title/company parseados)
//                   → NO se inserta
//   especializado → el TÍTULO actual es de perfil técnico/analítico (Analista,
//                   Backoffice, PLD, auditoría…) sin señal comercial — criterio
//                   #1 del barrido de la QA tester sep-2026 → NO se inserta
//   México        → visible normal
//   sin señal     → se inserta en CUARENTENA (verify_status='geo_desconocida');
//                   cron-verify-profiles la resuelve con búsqueda dirigida y la
//                   rescata (señal MX) o la manda a la basura (extranjero).
/** @returns 'garbage' | 'foreign' | 'specialized' | 'mx' | 'unknown' */
function gateResult(r) {
  const name = r.full_name || r.title || ''
  if (nameLooksLikeRole(name)) return 'garbage'
  if (isForeignProfile(r.url, r.title, r.current_title, r.current_company, r.snippet)) return 'foreign'
  if (checkRoleFit(r.current_title || r.title || '', r.snippet || '').verdict === 'specialized') return 'specialized'
  if (hasMexicoSignal(r.url, r.title, r.current_title, r.current_company, r.snippet)) return 'mx'
  return 'unknown'
}

/** Aplica el gate: separa insertables (con verify_status de cuarentena cuando
 *  toca) de los bloqueados, y cuenta cada caso. */
function applyGate(results, vacancy, gateCounts) {
  const rows = []
  for (const r of results) {
    const verdict = gateResult(r)
    if (verdict === 'garbage') { gateCounts.garbage++; continue }
    if (verdict === 'foreign') { gateCounts.foreign++; continue }
    if (verdict === 'specialized') { gateCounts.specialized++; continue }
    const row = toBankRow(r, vacancy)
    if (verdict === 'unknown') { row.verify_status = 'geo_desconocida'; gateCounts.quarantined++ }
    rows.push(row)
  }
  return rows
}

// ── Limpieza del banco (barata: solo queries) ──────────────────────────────
// Repasa los auto-sourced de los últimos 7 días que siguen sin promover:
//   (a) nombre de rol o señal extranjera en lo guardado → source='descartado'
//       con nota de la razón (nada se borra);
//   (b) sin señal de México y sin verify_status → cuarentena 'geo_desconocida'.
// Paginado de a 200; updates fila por fila (notas distintas), sin .in() masivos.
async function cleanupBank(supabase) {
  const counts = { cleaned: 0, quarantined: 0 }
  const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const PAGE = 200
  const today = new Date().toISOString().slice(0, 10)
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('sourcing_bank')
      .select('id, title, full_name, current_title, current_company, snippet, url, notes, verify_status')
      .eq('source', 'auto-sourced')
      .is('candidate_id', null)
      .gte('created_at', sinceIso)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const b of data || []) {
      const name = b.full_name || b.title || ''
      let reason = null
      if (nameLooksLikeRole(name)) reason = 'nombre de empresa/rol, no persona'
      else if (isForeignProfile(b.url, b.title, b.current_title, b.current_company, b.snippet)) reason = 'perfil extranjero'
      else {
        // Barrido de especializados sobre filas ya guardadas (criterio #1 de
        // la QA tester): título analítico/técnico sin señal comercial.
        const fit = checkRoleFit(b.current_title || b.title || '', b.snippet || '')
        if (fit.verdict === 'specialized') reason = `perfil especializado (${fit.signal})`
      }
      if (reason) {
        const notes = `${b.notes || ''} · auto-descartado: ${reason} ${today}`.replace(/^ · /, '')
        const { error: upErr } = await supabase.from('sourcing_bank')
          .update({ source: 'descartado', notes }).eq('id', b.id)
        if (upErr) console.error(`[cron-auto-source] limpieza no pudo descartar ${b.id}: ${upErr.message}`)
        else counts.cleaned++
        continue
      }
      if (!b.verify_status && !hasMexicoSignal(b.url, b.title, b.current_title, b.current_company, b.snippet)) {
        const { error: upErr } = await supabase.from('sourcing_bank')
          .update({ verify_status: 'geo_desconocida' }).eq('id', b.id)
        if (upErr) console.error(`[cron-auto-source] limpieza no pudo poner en cuarentena ${b.id}: ${upErr.message}`)
        else counts.quarantined++
      }
    }
    if (!data || data.length < PAGE) break
  }
  return counts
}

/** ¿Error de PostgREST/Postgres por violación de unique? (anti-re-inscripción) */
function isDuplicateError(err) {
  return Boolean(err && (err.code === '23505' || /duplicate|unique/i.test(err.message || '')))
}

/** Auto-promoción server-side (misma semántica que src/lib/promote.js).
 *  Solo corre con AUTO_PROMOTE_ENABLED=true y sobre filas RECIÉN insertadas.
 *
 *  Doble candado de visibilidad: applyGate ya dejó fuera basura/extranjeros y
 *  puso en cuarentena los sin señal MX, pero aquí se revalida sobre la fila
 *  guardada — verify_status distinto de null/'activo' (geo_desconocida,
 *  extranjero, link_muerto…) JAMÁS se auto-promueve.
 *
 *  AUTO-INSCRIPCIÓN (cierra el círculo del outreach): si la vacante tiene
 *  EXACTAMENTE UNA secuencia activa (outreach_sequences.is_active con su
 *  vacancy_id), cada promovido se inscribe solo (next_run_at=now → el runner
 *  de 20 min manda la conexión + follow-ups con cuota anti-ban). Con 0 o >1
 *  secuencias solo se loggea — ambigüedad se resuelve a mano con EnrollModal.
 *  El unique parcial uq_sequence_enrollments_seq_bank evita re-inscribir.
 *  Exportada para scripts/test-auto-enroll.mjs (stubs, sin red). */
export async function autoPromote(supabase, vacancy, insertedRows) {
  const counts = { promoted: 0, enrolled: 0 }
  // OJO: Number(null) === 0 — null/'' significa "auto-promoción apagada",
  // no "umbral 0" (habría promovido a todos).
  const raw = vacancy.auto_promote_min_score
  const threshold = raw == null || raw === '' ? NaN : Number(raw)
  if (!Number.isFinite(threshold)) return counts

  // Secuencia destino para auto-inscribir (solo si es inequívoca).
  let autoSeq = null
  const { data: seqs, error: seqErr } = await supabase
    .from('outreach_sequences').select('id, name')
    .eq('vacancy_id', vacancy.id).eq('is_active', true)
  if (seqErr) {
    console.error(`[cron-auto-source] no se pudieron leer secuencias de "${vacancy.title}": ${seqErr.message}`)
  } else if ((seqs || []).length === 1) {
    autoSeq = seqs[0]
  } else if ((seqs || []).length > 1) {
    console.log(`[cron-auto-source] "${vacancy.title}" tiene ${seqs.length} secuencias activas — ambiguo, sin auto-inscripción`)
  }

  for (const row of insertedRows) {
    if (!(Number(row.score) >= threshold)) continue
    const { data: bank } = await supabase.from('sourcing_bank').select('*').eq('id', row.id).single()
    if (!bank || bank.candidate_id) continue
    // Candado de visibilidad: cuarentena/extranjero/link muerto NO se promueve.
    if (bank.verify_status && bank.verify_status !== 'activo') continue
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
    const { data: vc, error: vcErr } = await supabase.from('vacancy_candidates').insert({
      vacancy_id: vacancy.id, candidate_id: cand.id, stage: 'sourced',
      match_score: bank.score, match_details: bank.score_details,
    }).select('id').single()
    if (vcErr) console.error(`[cron-auto-source] vacancy_candidates falló (${bank.url}): ${vcErr.message}`)
    await supabase.from('sourcing_bank').update({ candidate_id: cand.id }).eq('id', bank.id)
    counts.promoted++

    if (autoSeq) {
      const { error: enErr } = await supabase.from('sequence_enrollments').insert({
        organization_id: vacancy.organization_id,
        sequence_id: autoSeq.id,
        sourcing_bank_id: bank.id,
        vacancy_candidate_id: vc?.id || null,
        status: 'active',
        current_step: 0,
        next_run_at: new Date().toISOString(),
        enrolled_by: null, // inscrito por el robot, no por un usuario
      })
      if (!enErr) counts.enrolled++
      else if (isDuplicateError(enErr)) {
        // Ya estuvo inscrito en esa secuencia (anti-spam) — no es error.
        console.log(`[cron-auto-source] ${bank.url} ya estuvo inscrito en "${autoSeq.name}" — skip`)
      } else {
        console.error(`[cron-auto-source] auto-inscripción falló (${bank.url}): ${enErr.message}`)
      }
    }
  }
  return counts
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
      // FORMA CANÓNICA (normalizeLinkedInUrl): la tester descartó al mismo
      // perfil ~3 veces porque http/https, www/mx, %encoding y slash final
      // re-entraban como URLs "distintas". runAutoSource compara con la misma
      // clave canónica.
      const bankUrls = await fetchUrls(() =>
        supabase.from('sourcing_bank').select('url').eq('vacancy_id', v.id))
      const orgDiscarded = await fetchUrls(() =>
        supabase.from('sourcing_bank').select('url').eq('organization_id', v.organization_id).eq('source', 'descartado'))
      const excludeUrls = [...new Set([...bankUrls, ...orgDiscarded].map(normalizeLinkedInUrl))]

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

      // GATE DE CALIDAD: basura/extranjeros/especializados fuera, sin señal MX → cuarentena.
      const gateCounts = { garbage: 0, foreign: 0, specialized: 0, quarantined: 0 }
      const gatedRows = applyGate(results, v, gateCounts)

      let inserted = []
      if (gatedRows.length) {
        const { data, error: upErr } = await supabase
          .from('sourcing_bank')
          .upsert(gatedRows, { onConflict: 'vacancy_id,url', ignoreDuplicates: true })
          .select('id, url, score')
        if (upErr) throw new Error(upErr.message)
        inserted = data || []
      }

      let promo = { promoted: 0, enrolled: 0 }
      if (AUTO_PROMOTE_ENABLED) promo = await autoPromote(supabase, v, inserted)

      const filtered = Math.max(0, (counts.found || 0) - (counts.known || 0) - results.length)
      console.log(`[cron-auto-source] "${v.title}": found=${counts.found} known=${counts.known} filtered=${filtered} returned=${results.length} garbage=${gateCounts.garbage} foreign=${gateCounts.foreign} specialized=${gateCounts.specialized} quarantined=${gateCounts.quarantined} new=${inserted.length}${AUTO_PROMOTE_ENABLED ? ` promoted=${promo.promoted} enrolled=${promo.enrolled}` : ''}`)
      summary.push({ vacancy_id: v.id, title: v.title, found: counts.found, returned: results.length, garbage: gateCounts.garbage, foreign: gateCounts.foreign, specialized: gateCounts.specialized, quarantined: gateCounts.quarantined, new: inserted.length, promoted: promo.promoted, enrolled: promo.enrolled })
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

  // Limpieza del banco al final del tick (tolerante: no tumba la corrida).
  let cleanup = null
  try {
    cleanup = await cleanupBank(supabase)
    console.log(`[cron-auto-source] limpieza del banco: cleaned=${cleanup.cleaned} quarantined=${cleanup.quarantined}`)
  } catch (e) {
    console.error(`[cron-auto-source] limpieza del banco falló: ${e.message}`)
  }

  console.log(`[cron-auto-source] listo en ${Date.now() - t0}ms · ${JSON.stringify({ processed: summary, cleanup })}`)
  return { statusCode: 200, body: JSON.stringify({ ok: true, processed: summary, cleanup }) }
}
