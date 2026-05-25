import { supabase } from './supabase'

/**
 * Insert a row into activity_log for audit / compliance tracking.
 * Silently catches errors so callers are never blocked by logging failures.
 */
export async function logActivity(entityType, entityId, action, details = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) return

    await supabase.from('activity_log').insert({
      organization_id: profile.organization_id,
      entity_type: entityType,
      entity_id: entityId,
      action,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
      performed_by: profile.id,
    })
  } catch (err) {
    console.error('[auditLog] Error logging activity:', err)
  }
}
