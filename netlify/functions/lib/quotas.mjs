// Cuotas anti-ban de LinkedIn (FASE 5). LinkedIn banea cuentas por
// automatización agresiva — estas cuotas son EXISTENCIALES, no un detalle.
//
// Fuente de verdad: scheduled_messages con status='sent' y canal linkedin%
// (el outbox es el ÚNICO punto de envío de secuencias, así que contar ahí
// cuenta todo lo automatizado).

// Arranque conservador: 5/día. Tras 1 semana sin warnings de LinkedIn se
// puede subir a 15 (cambiar SOLO esta constante).
export const LINKEDIN_DAILY_LIMIT = 5
export const LINKEDIN_WEEKLY_LIMIT = 80

const HOUR_MS = 60 * 60 * 1000

/** Inicio del día actual en CDMX (UTC-6 fijo, sin horario de verano). */
export function cdmxDayStartIso(now = Date.now()) {
  const shifted = new Date(now - 6 * HOUR_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) + 6 * HOUR_MS).toISOString()
}

/**
 * Uso de LinkedIn de una organización: envíos de hoy (día CDMX) y de los
 * últimos 7 días. `allowed` = aún hay presupuesto en ambas ventanas.
 *
 * @returns {Promise<{dayUsed:number, weekUsed:number, allowed:boolean}>}
 */
export async function getLinkedInQuota(supabase, orgId, now = Date.now()) {
  const weekStartIso = new Date(now - 7 * 24 * HOUR_MS).toISOString()

  const base = () => supabase
    .from('scheduled_messages')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'sent')
    .like('channel', 'linkedin%')

  const [{ count: dayCount, error: e1 }, { count: weekCount, error: e2 }] = await Promise.all([
    base().gte('sent_at', cdmxDayStartIso(now)),
    base().gte('sent_at', weekStartIso),
  ])
  // Defensivo: si el conteo falla, asumimos cuota AGOTADA (fail-closed) —
  // preferible no enviar a arriesgar la cuenta de LinkedIn.
  if (e1 || e2) {
    console.error('[quotas] conteo falló:', e1?.message || e2?.message)
    return { dayUsed: LINKEDIN_DAILY_LIMIT, weekUsed: LINKEDIN_WEEKLY_LIMIT, allowed: false }
  }

  const dayUsed = dayCount || 0
  const weekUsed = weekCount || 0
  return {
    dayUsed,
    weekUsed,
    allowed: dayUsed < LINKEDIN_DAILY_LIMIT && weekUsed < LINKEDIN_WEEKLY_LIMIT,
  }
}
