// Netlify Scheduled Function — sync de actividad de LinkedIn (FASE 5).
//
// Schedule (netlify.toml): "*/30 13-23 * * *" = cada 30 min de 7am a 5pm CDMX.
//
// linkedin-activity.mjs solo DEVUELVE la actividad de Unipile al front; este
// cron la PERSISTE para que las secuencias reaccionen solas:
//   - invitación aceptada (aparece en relations o ya no está pending)
//       → sourcing_bank.contact_status: 'invited' → 'connected'
//   - chat con mensajes sin leer del candidato (señal de respuesta entrante)
//       → contact_status → 'replied' y:
//         · si el bank item está ligado a un vacancy_candidate → INSERT
//           candidate_interactions inbound (dedupe por external_id)
//           → el trigger pause_sequence_on_reply detiene la secuencia
//         · si NO hay candidato → rpc pause_enrollments_for_bank(bank_id)
//
// Solo lectura hacia Unipile (GET) — este cron JAMÁS envía nada.
// Tolerante: sin UNIPILE_* configurado devuelve 200 con skip loggeado.

import { getServiceClient } from './lib/supabase.mjs'
import { getUnipileConfig, createUnipile } from './lib/unipile.mjs'

function slugOfUrl(url = '') {
  const m = String(url).match(/\/in\/([^/?#]+)/i)
  if (!m) return null
  try { return decodeURIComponent(m[1]).toLowerCase() } catch { return m[1].toLowerCase() }
}

/** Trae TODAS las filas paginado de a 1000 (PostgREST corta en 1000).
 *  OJO: nunca .in() con listas grandes (patrón prohibido del repo). */
async function fetchAll(buildQuery) {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

export async function handler() {
  const t0 = Date.now()
  const { key, dsn, accountId, configured } = getUnipileConfig()
  if (!configured) {
    console.log('[cron-activity-sync] Unipile sin configurar — skip')
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'unipile_not_configured' }) }
  }

  const supabase = getServiceClient()
  const { getJson: get } = createUnipile({ key, dsn })

  const summary = { scanned: 0, connected: 0, replied: 0, interactions: 0, rpcPauses: 0, errors: 0 }
  try {
    // 1) Actividad de Unipile (mismas 3 lecturas que linkedin-activity.mjs)
    const [inv, rel, chats] = await Promise.all([
      get(`/users/invite/sent?account_id=${accountId}&limit=100`),
      get(`/users/relations?account_id=${accountId}&limit=200`),
      get(`/chats?account_id=${accountId}&limit=100`),
    ])

    const pendingInvIds = new Set()
    const pendingProviderIds = new Set()
    for (const it of inv.data.items || []) {
      if (it.id) pendingInvIds.add(String(it.id))
      if (it.invited_user_id) pendingProviderIds.add(String(it.invited_user_id))
    }

    const relByProvider = new Map()
    const relByPublic = new Map()
    for (const r of rel.data.items || []) {
      if (r.member_id) relByProvider.set(String(r.member_id), r)
      if (r.public_identifier) relByPublic.set(String(r.public_identifier).toLowerCase(), r)
    }

    // Chat con unread > 0 = hay mensaje entrante del candidato sin leer.
    // (No bajamos los mensajes de cada chat — sería 1 llamada extra por chat;
    // unread_count es la señal estándar de entrante no atendido.)
    const chatByProvider = new Map()
    for (const ch of chats.data.items || []) {
      const pid = ch.attendee_provider_id ? String(ch.attendee_provider_id) : null
      if (!pid) continue
      const prev = chatByProvider.get(pid)
      if (!prev || (ch.unread_count || ch.unread || 0) > (prev.unread_count || prev.unread || 0)) chatByProvider.set(pid, ch)
    }

    // 2) Nuestro outreach registrado (todas las orgs) — paginado, sin .in()
    const bankRows = await fetchAll(() => supabase
      .from('sourcing_bank')
      .select('id, organization_id, vacancy_id, candidate_id, url, provider_id, invitation_id, contact_status')
      .not('contact_status', 'is', null))

    for (const row of bankRows) {
      summary.scanned++
      try {
        const slug = slugOfUrl(row.url)
        const relHit = (row.provider_id && relByProvider.get(String(row.provider_id))) || (slug && relByPublic.get(slug)) || null
        const providerId = row.provider_id ? String(row.provider_id) : (relHit?.member_id ? String(relHit.member_id) : null)
        const chat = providerId ? chatByProvider.get(providerId) : null
        const hasInboundChat = Boolean(chat && ((chat.unread_count || chat.unread || 0) > 0))

        let newStatus = null
        if (hasInboundChat && row.contact_status !== 'replied') {
          newStatus = 'replied'
        } else if (row.contact_status === 'invited') {
          // 'invited' → 'connected' cuando aparece en relations o la
          // invitación ya no está pending en Unipile.
          const stillPending = row.invitation_id
            ? pendingInvIds.has(String(row.invitation_id))
            : (row.provider_id ? pendingProviderIds.has(String(row.provider_id)) : true)
          if (relHit || !stillPending) newStatus = 'connected'
        }
        if (!newStatus) continue

        const patch = { contact_status: newStatus }
        if (!row.provider_id && relHit?.member_id) patch.provider_id = String(relHit.member_id)
        const { error: upErr } = await supabase.from('sourcing_bank').update(patch).eq('id', row.id)
        if (upErr) { summary.errors++; console.error(`[cron-activity-sync] update banco ${row.id}: ${upErr.message}`); continue }
        if (newStatus === 'connected') summary.connected++

        if (newStatus === 'replied') {
          summary.replied++
          let paused = false
          if (row.candidate_id && row.vacancy_id) {
            // ¿Está en pipeline? → interacción inbound → el trigger pausa.
            const { data: vc } = await supabase.from('vacancy_candidates')
              .select('id').eq('candidate_id', row.candidate_id).eq('vacancy_id', row.vacancy_id).maybeSingle()
            if (vc) {
              // external_id determinista (chat + timestamp) → el unique parcial
              // + ignoreDuplicates hace ON CONFLICT DO NOTHING en re-corridas.
              const { error: intErr } = await supabase.from('candidate_interactions').upsert({
                vacancy_candidate_id: vc.id,
                type: 'linkedin_message',
                direction: 'inbound',
                content: 'Respuesta del candidato en LinkedIn (sync Unipile)',
                source: 'unipile_sync',
                external_id: `${chat.id}:${chat.timestamp || chat.date || 'na'}`,
              }, { onConflict: 'external_id', ignoreDuplicates: true })
              if (intErr) console.error(`[cron-activity-sync] interacción ${row.id}: ${intErr.message}`)
              else { summary.interactions++; paused = true }
            }
          }
          if (!paused) {
            // Sin candidato en pipeline → pausar directo por bank_id.
            const { error: rpcErr } = await supabase.rpc('pause_enrollments_for_bank', { bank_id: row.id })
            if (rpcErr) console.error(`[cron-activity-sync] rpc pause (${row.id}): ${rpcErr.message}`)
            else summary.rpcPauses++
          }
        }
      } catch (err) {
        summary.errors++
        console.error(`[cron-activity-sync] fila ${row.id} falló: ${err.message}`)
      }
    }
  } catch (err) {
    console.error(`[cron-activity-sync] error general: ${err.message}`)
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: err.message, ...summary }) }
  }

  console.log(`[cron-activity-sync] listo en ${Date.now() - t0}ms · ${JSON.stringify(summary)}`)
  return { statusCode: 200, body: JSON.stringify({ ok: true, ...summary }) }
}
