// Badges de frescura de perfil (Fase 4, higiene de base).
//
// El cron nocturno cron-verify-profiles.mjs marca verify_status en
// sourcing_bank y candidates:
//   'activo' | 'cambio_empleo' | 'desactualizado' | 'link_muerto' | 'fantasma'
//
// Este helper es la ÚNICA fuente de label/color/icono para SourcingTab,
// CandidateBank y CandidateProfile. Tolerante a drift: si la fila no trae
// verify_status (migración sin aplicar o perfil aún no verificado),
// verifyBadge() devuelve null y no se pinta nada.

const BADGES = {
  activo: {
    label: 'Verificado activo',
    icon: '✓',
    bg: 'rgba(16,185,129,0.15)',
    fg: '#34d399',
  },
  cambio_empleo: {
    label: 'Cambió de empleo',
    icon: '⚠️',
    bg: 'rgba(245,158,11,0.15)',
    fg: '#fbbf24',
  },
  desactualizado: {
    label: 'Desactualizado',
    icon: '🕐',
    bg: 'rgba(148,163,184,0.15)',
    fg: '#94a3b8',
  },
  link_muerto: {
    label: 'Link muerto',
    icon: '💀',
    bg: 'rgba(239,68,68,0.15)',
    fg: '#f87171',
  },
  fantasma: {
    label: 'Fantasma',
    icon: '👻',
    bg: 'rgba(168,85,247,0.15)',
    fg: '#c084fc',
  },
  // Gate de calidad del sourcing (2026-09-07): sin señal de México en el
  // snippet → cuarentena hasta que la verificación dirigida confirme ubicación.
  geo_desconocida: {
    label: 'Ubicación por confirmar',
    icon: '🌎',
    bg: 'rgba(59,130,246,0.15)',
    fg: '#93c5fd',
  },
  // Verificación dirigida confirmó que vive fuera de México → descartado.
  extranjero: {
    label: 'Extranjero',
    icon: '🚫',
    bg: 'rgba(239,68,68,0.15)',
    fg: '#f87171',
  },
  // Descartado por QA (barrido de la tester sep-2026) o por el barrido
  // automático de perfiles especializados — la razón vive en notes.
  descartado_qa: {
    label: 'Descartado (QA)',
    icon: '🗑️',
    bg: 'rgba(148,163,184,0.15)',
    fg: '#94a3b8',
  },
}

/** status → { label, icon, bg, fg } | null si no hay/no se reconoce. */
export function verifyBadge(status) {
  if (!status) return null
  return BADGES[status] || null
}

/** ¿verify_status indica un problema? ('activo' y sin verificar NO lo son). */
export function hasVerifyProblem(status) {
  return !!status && status !== 'activo'
}

/** Tooltip legible a partir de verify_details (jsonb del cron). */
export function verifyTooltip(status, details) {
  const badge = verifyBadge(status)
  if (!badge) return ''
  const d = (details && typeof details === 'object') ? details : {}
  const parts = [badge.label]
  if (d.new_title) parts.push(`Nuevo puesto: ${d.new_title}`)
  if (d.new_company) parts.push(`Nueva empresa: ${d.new_company}`)
  if (d.foreign_signal) parts.push(`Señal: ${d.foreign_signal}`)
  if (d.specialized_signal) parts.push(`Señal: ${d.specialized_signal}`)
  if (status === 'link_muerto' && d.misses) parts.push(`${d.misses} corridas sin resultado`)
  if (d.checked_at) {
    try { parts.push(`Revisado: ${new Date(d.checked_at).toLocaleDateString('es-MX')}`) } catch { /* fecha inválida */ }
  }
  return parts.join(' · ')
}
