// ---------------------------------------------------------------------------
// Nombres visibles de las etapas del journey (FASE 2).
//
// Los stages INTERNOS (sourced, contacted, …) nunca cambian en BD; lo que
// cambia es la etiqueta que ve el usuario. Cada organización puede
// personalizarlas en Configuración → "Etapas del proceso"; se guardan en
// organizations.settings.stage_labels (map stage → etiqueta).
//
// Este módulo es PURO (sin supabase/react) para poder probarlo con node;
// el hook que carga las etiquetas de la org vive en useStageLabels.js.
// ---------------------------------------------------------------------------

// Defaults en español (dirección de Flavio, 2026-09).
export const DEFAULT_STAGE_LABELS = {
  sourced: 'Prospectado',
  contacted: 'Contactado',
  screening: 'Filtro inicial',
  interviewing: 'Entrevista',
  evaluated: 'Evaluado',
  presented: 'Presentado',
  shortlist: 'Finalista',
  offer: 'Oferta',
  documentation: 'Documentación',
  hired: 'Clave',
  onboarding: 'Inducción',
  rejected: 'Descartado',
}

// Orden canónico del journey (mismo orden que el kanban).
export const STAGE_KEYS = Object.keys(DEFAULT_STAGE_LABELS)

/**
 * Etiqueta visible de una etapa. `labels` puede ser el map de overrides de la
 * org (o null/undefined) — cae en los defaults y, en última instancia, en la
 * key interna (nunca regresa vacío para un stage desconocido).
 */
export function getStageLabel(labels, stage) {
  if (!stage) return ''
  const custom = labels && typeof labels[stage] === 'string' ? labels[stage].trim() : ''
  return custom || DEFAULT_STAGE_LABELS[stage] || stage
}

/** Map completo defaults + overrides (ignora keys desconocidas y strings vacíos). */
export function mergeStageLabels(custom) {
  const out = { ...DEFAULT_STAGE_LABELS }
  if (custom && typeof custom === 'object') {
    for (const key of STAGE_KEYS) {
      const v = custom[key]
      if (typeof v === 'string' && v.trim()) out[key] = v.trim()
    }
  }
  return out
}

// ── Cache module-level ──────────────────────────────────────────
// Un solo fetch por sesión aunque 10 componentes usen el hook; el editor de
// Settings actualiza el cache al guardar y todos los suscritos re-renderizan.
let cachedOrgId = null
let cachedCustom = null // SOLO los overrides ({} si la org no tiene)
const listeners = new Set()

export function getCachedStageLabels(orgId) {
  return orgId && cachedOrgId === orgId ? cachedCustom : null
}

export function setCachedStageLabels(orgId, custom) {
  cachedOrgId = orgId
  cachedCustom = custom && typeof custom === 'object' ? custom : {}
  for (const fn of listeners) {
    try { fn(cachedCustom) } catch { /* listener roto no tumba al resto */ }
  }
}

export function subscribeStageLabels(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
