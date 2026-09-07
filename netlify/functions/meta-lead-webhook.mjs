import { getServiceClient } from './lib/supabase.mjs'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'enlace468-meta-verify'

export async function handler(event) {
  // Meta webhook verification (GET)
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {}
    if (params['hub.mode'] === 'subscribe' && params['hub.verify_token'] === VERIFY_TOKEN) {
      return { statusCode: 200, body: params['hub.challenge'] || 'ok' }
    }
    return { statusCode: 403, body: 'Forbidden' }
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  // Validate webhook secret
  const secret = event.headers['x-webhook-secret']
  if (secret && secret !== VERIFY_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid webhook secret' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { full_name, email, phone, location, campaign_id, vacancy_id, organization_id, form_data } = body

  if (!full_name || !organization_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'full_name and organization_id are required' }) }
  }

  const supabase = getServiceClient()

  try {
    // Check for duplicate by email within org
    let candidateId = null
    if (email) {
      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('email', email)
        .maybeSingle()

      if (existing) {
        candidateId = existing.id
      }
    }

    // Insert or use existing candidate
    if (!candidateId) {
      const { data: newCandidate, error: insertErr } = await supabase
        .from('candidates')
        .insert({
          organization_id,
          full_name,
          email: email || null,
          phone: phone || null,
          location: location || null,
          source: 'meta_ads',
          tags: ['meta-ads', 'lead-gen'],
          notes: form_data ? JSON.stringify(form_data) : null,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr
      candidateId = newCandidate.id
    }

    // Link to vacancy if provided
    if (vacancy_id && candidateId) {
      await supabase
        .from('vacancy_candidates')
        .upsert({
          vacancy_id,
          candidate_id: candidateId,
          stage: 'sourced',
        }, { onConflict: 'vacancy_id,candidate_id' })
        .then(() => {})
        .catch(err => console.error('vacancy_candidates error:', err))
    }

    // Increment leads_count on campaign
    if (campaign_id) {
      const { data: camp } = await supabase
        .from('meta_campaigns')
        .select('leads_count')
        .eq('id', campaign_id)
        .single()

      if (camp) {
        await supabase
          .from('meta_campaigns')
          .update({ leads_count: (camp.leads_count || 0) + 1 })
          .eq('id', campaign_id)
      }
    }

    // Activity log
    await supabase.from('activity_log').insert({
      organization_id,
      entity_type: 'candidate',
      entity_id: candidateId,
      action: 'meta_lead_captured',
      details: { campaign_id, vacancy_id, source: 'meta_ads', full_name },
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, candidate_id: candidateId }),
    }
  } catch (err) {
    console.error('Webhook error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: err.message }),
    }
  }
}
