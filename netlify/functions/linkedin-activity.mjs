// Netlify serverless function: actividad de LinkedIn (outreach) vía Unipile.
// Devuelve las invitaciones ENVIADAS (pendientes) con su mensaje, fecha y a
// quién — para el tablero de la sección de sourcing.
//
// Env (Netlify): UNIPILE_API_KEY, UNIPILE_DSN, UNIPILE_ACCOUNT_ID
// GET /api/linkedin-activity   (o POST { account_id? })

import { getUnipileConfig, createUnipile } from './lib/unipile.mjs'

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  let requestedAccountId
  try { const b = JSON.parse(event.body || '{}'); if (b.account_id) requestedAccountId = b.account_id } catch { /* GET */ }
  if (event.queryStringParameters?.account_id) requestedAccountId = event.queryStringParameters.account_id
  const { key: KEY, dsn: DSN, accountId, configured } = getUnipileConfig(requestedAccountId)
  if (!configured) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOT_CONFIGURED', hint: 'Faltan credenciales de Unipile.' }) }
  }

  const { getJson: get } = createUnipile({ key: KEY, dsn: DSN })

  try {
    // En paralelo: invitaciones pendientes, conexiones (aceptadas), chats (respuestas)
    const [inv, rel, chats] = await Promise.all([
      get(`/users/invite/sent?account_id=${accountId}&limit=100`),
      get(`/users/relations?account_id=${accountId}&limit=200`),
      get(`/chats?account_id=${accountId}&limit=100`),
    ])

    const invitations = (inv.data.items || []).map(it => ({
      id: it.id, name: it.invited_user, public_id: it.invited_user_public_id, provider_id: it.invited_user_id,
      photo: it.invited_user_profile_picture_url || null, message: it.invitation_text || '',
      date: it.parsed_datetime || it.date, status: 'pending',
    }))

    // Conexiones (aceptadas) + mapa provider_id → datos, para nombrar los chats
    const relById = {}
    const connections = (rel.data.items || []).map(r => {
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim()
      const c = { name, public_id: r.public_identifier, provider_id: r.member_id, headline: r.headline || '', date: r.created_at ? new Date(r.created_at).toISOString() : null }
      if (r.member_id) relById[r.member_id] = c
      return c
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    // Conversaciones (respuestas). Nombre resuelto vía relations cuando se puede.
    const conversations = (chats.data.items || [])
      .map(ch => {
        const who = relById[ch.attendee_provider_id]
        return {
          id: ch.id, provider_id: ch.attendee_provider_id,
          name: who?.name || null, public_id: who?.public_id || null,
          unread: ch.unread_count || ch.unread || 0, date: ch.timestamp || null,
        }
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true,
        counts: { pending: invitations.length, connections: connections.length, unread: conversations.filter(c => c.unread > 0).length },
        invitations, connections, conversations,
      }),
    }
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'UNIPILE_ERROR', hint: err.message?.slice(0, 160) }) }
  }
}
