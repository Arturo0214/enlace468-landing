// Promoción de un item del banco de sourcing (sourcing_bank) al pipeline
// (candidates + vacancy_candidates). Extraída de SourcingTab.promoteToPipeline
// para reutilizarla desde la vista "Candidatos de hoy" del dashboard.
//
// El origen viaja del banco al pipeline: manual (link pegado por el
// reclutador) vs auto-sourced (cron nocturno) vs web-sourced (búsqueda) —
// clave para medir conversión por canal. El score del banco viaja como
// match_score/match_details.

import { detectForeignLocation } from './sourcingScore.js'

/**
 * Guard anti-extranjeros (FASE 2): evalúa los datos guardados del item
 * (url/título/snippet/empresa) con las mismas señales de sourcingScore.
 * Devuelve la RAZÓN concreta para que el reclutador pueda juzgar el falso
 * positivo (nombres/colonias mexicanas como "Roma" o "León" están excluidos
 * de las señales, pero ningún filtro es perfecto).
 *
 * @param {object} item fila de sourcing_bank (o shape equivalente)
 * @returns {{ foreign: boolean, reason: string|null }}
 */
export function checkForeign(item = {}) {
  const url = String(item.url || item.linkedin_url || '')
  const m = url.match(/https?:\/\/([a-z]{2,3})\.linkedin\.com/i)
  const sub = m ? m[1].toLowerCase() : null
  if (sub && sub !== 'mx' && sub !== 'www') {
    return { foreign: true, reason: `perfil de LinkedIn de otro país (subdominio "${sub}.")` }
  }
  const text = [item.title, item.full_name, item.current_title, item.current_company, item.snippet, item.notes, item.location]
    .filter(Boolean)
    .join(' ')
  const signal = detectForeignLocation(text)
  if (signal) return { foreign: true, reason: `menciona "${signal}" sin señal de México` }
  return { foreign: false, reason: null }
}

/**
 * @param {object} supabase  cliente supabase-js (sesión del usuario)
 * @param {object} args
 * @param {object} args.item      fila de sourcing_bank
 * @param {string} args.vacancyId vacante destino
 * @param {object} args.profile   perfil del usuario (organization_id, id)
 * @returns {Promise<object|null>} el candidato creado (fila de candidates)
 * @throws si el perfil se detecta extranjero o si algún insert falla
 */
export async function promoteBankItem(supabase, { item, vacancyId, profile }) {
  // Guard anti-extranjeros: nada de perfiles fuera de México en el pipeline.
  // Quien llama muestra el mensaje tal cual al usuario.
  const { foreign, reason } = checkForeign(item)
  if (foreign) {
    throw new Error(`Perfil detectado como extranjero: ${reason}. Márcalo en Depuración si es un falso positivo.`)
  }

  const isLinkedin = item.url?.includes('linkedin.com')
  const isManual = item.source === 'manual'
  const isAuto = item.source === 'auto-sourced'

  const { data, error } = await supabase.from('candidates').insert({
    organization_id: profile.organization_id,
    full_name: item.full_name || item.title,
    current_title: item.current_title || null,
    current_company: item.current_company || null,
    linkedin_url: isLinkedin ? item.url : null,
    source: isManual ? 'manual' : isAuto ? 'auto-sourced' : 'web-sourced',
    notes: item.snippet || null,
    tags: isManual ? ['candidato-manual'] : isAuto ? ['auto-sourced'] : ['web-sourced'],
  }).select().single()
  if (error) throw error
  if (!data) return null

  const score = item.score == null ? null : Number(item.score)
  const { error: vcError } = await supabase.from('vacancy_candidates').insert({
    vacancy_id: vacancyId,
    candidate_id: data.id,
    stage: 'sourced',
    assigned_to: profile.id,
    match_score: Number.isFinite(score) ? score : null,
    match_details: item.score_details || null,
  })
  if (vcError) throw vcError

  await supabase.from('sourcing_bank').update({ candidate_id: data.id }).eq('id', item.id)
  return data
}
