// ─────────────────────────────────────────────────────────────────────────────
// pipelineDetail.js — Ficha operativa del pipeline de Ingrid (FASE D del plan
// docs/CONTEXTO-COPILOTO-Y-RUTEO-2026-09.md, §1).
//
// Materializa los 21 pasos del diagrama de Ingrid (puntos de control A-H) sobre
// la tabla `candidate_pipeline_detail` (1:1 con vacancy_candidates, org-scoped).
// El copiloto (src/lib/copilot.js) LEE estos campos para sus alertas
// (psychometric_pending, docs_incomplete, cnsf_unpaid, cnsf_no_date); aquí es
// donde se LLENAN desde el modal del candidato.
//
// Diseño:
//   - La DEFINICIÓN de campos (PIPELINE_DETAIL_FIELDS, agrupada por fase) es
//     PURA y testeable (sin React, sin Supabase).
//   - loadDetail / saveDetail reciben el client de Supabase por parámetro para
//     no acoplar la capa de datos a este módulo.
// ─────────────────────────────────────────────────────────────────────────────

// Resultados válidos del psicométrico — deben coincidir con el CHECK de la
// columna candidate_pipeline_detail.psychometric_result en BD.
export const PSYCHOMETRIC_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'apto', label: 'Apto' },
  { value: 'no_apto', label: 'No apto' },
]

// Grupos de fases del diagrama de Ingrid. Cada campo:
//   { key, label, type: 'date'|'datetime'|'bool'|'select'|'text', options?, hint? }
// Los campos jsonb (docs_uploaded, week1_checkpoint) NO se editan en este
// formulario (se llenan por otros flujos: upload de docs, checkpoint). Se
// exponen como solo-lectura vía helpers (docsComplete/…), no como inputs.
export const PIPELINE_DETAIL_GROUPS = [
  {
    id: 'seleccion',
    label: 'Selección',
    hint: 'Psicométrico, orientación, Proyecto 100, carrera y aceptación (pasos 6-11).',
    fields: [
      { key: 'psychometric_sent_at', label: 'Psicométrico enviado', type: 'datetime' },
      { key: 'psychometric_result', label: 'Resultado psicométrico', type: 'select', options: PSYCHOMETRIC_OPTIONS },
      { key: 'orientation_at', label: 'Entrevista de orientación', type: 'datetime' },
      { key: 'project100_status', label: 'Proyecto 100 / Q10', type: 'text', placeholder: 'Estatus del Proyecto 100…' },
      { key: 'career_interview_at', label: 'Entrevista de carrera', type: 'datetime' },
      { key: 'accepted_at', label: 'Aceptación del candidato', type: 'datetime' },
    ],
  },
  {
    id: 'documentacion',
    label: 'Documentación',
    hint: 'Docs solicitados/confirmados, validación legal, pago y fecha del examen CNSF (pasos 12-18).',
    fields: [
      { key: 'docs_requested_at', label: 'Documentos solicitados', type: 'datetime' },
      { key: 'docs_confirmed_at', label: 'Documentos confirmados', type: 'datetime' },
      { key: 'legal_validated_at', label: 'Validación legal', type: 'datetime' },
      { key: 'cnsf_paid_at', label: 'Pago examen CNSF', type: 'datetime' },
      { key: 'cnsf_receipt_url', label: 'Comprobante CNSF (URL)', type: 'text', placeholder: 'https://…' },
      { key: 'cnsf_exam_date', label: 'Fecha examen CNSF', type: 'date' },
    ],
  },
  {
    id: 'induccion',
    label: 'Inducción',
    hint: 'Inicio de inducción 90 días y checkpoint de la semana 1 crítica (pasos 19-20).',
    fields: [
      { key: 'induction_start_at', label: 'Inicio de inducción (90 días)', type: 'datetime' },
    ],
  },
]

// Lista plana de todos los campos editables (para validación / iteración).
export const PIPELINE_DETAIL_FIELDS = PIPELINE_DETAIL_GROUPS.flatMap(g => g.fields)

// Set de llaves editables — para filtrar patches y no mandar basura a BD.
export const EDITABLE_KEYS = new Set(PIPELINE_DETAIL_FIELDS.map(f => f.key))

// Columnas que existen en la tabla pero NO se editan aquí (jsonb / meta).
// Se leen para badges/estado pero no se escriben desde el formulario.
export const READONLY_KEYS = ['docs_uploaded', 'week1_checkpoint', 'updated_at', 'id']

// ── Helpers PUROS de estado (alineados con las alertas del copiloto) ──────────

/** ¿La columna docs_uploaded (jsonb) contiene al menos un documento? */
export function hasUploads(docs) {
  if (!docs) return false
  if (Array.isArray(docs)) return docs.length > 0
  if (typeof docs === 'object') return Object.keys(docs).length > 0
  return false
}

/**
 * ¿Los documentos están "completos"? Regla espejo del copiloto (docs_incomplete):
 * se consideran completos si hay confirmación (docs_confirmed_at) o subida real
 * (docs_uploaded con contenido). Si ni siquiera se solicitaron, no aplica.
 * @returns {'na'|'incompleto'|'completo'}
 */
export function docsStatus(detail) {
  if (!detail || !detail.docs_requested_at) return 'na'
  const confirmed = !!detail.docs_confirmed_at
  const uploaded = hasUploads(detail.docs_uploaded)
  return confirmed || uploaded ? 'completo' : 'incompleto'
}

/**
 * Estado del psicométrico para el badge (ámbar si pendiente).
 * @returns {'na'|'pendiente'|'apto'|'no_apto'}
 */
export function psychometricStatus(detail) {
  if (!detail || !detail.psychometric_sent_at) return 'na'
  const r = detail.psychometric_result
  if (r === 'apto' || r === 'no_apto') return r
  return 'pendiente'
}

/**
 * Badges de estado que reflejan las alertas operativas del copiloto (§1):
 * psicométrico pendiente, docs incompletos, CNSF sin fecha. Puro: recibe el
 * detail (o null) y el stage interno del candidato.
 * @returns {Array<{ id, label, tone:'amber'|'red'|'emerald' }>}
 */
export function detailBadges(detail, stage) {
  const badges = []
  if (psychometricStatus(detail) === 'pendiente') {
    badges.push({ id: 'psychometric_pending', label: 'Psicométrico pendiente', tone: 'amber' })
  }
  if (docsStatus(detail) === 'incompleto') {
    badges.push({ id: 'docs_incomplete', label: 'Documentos incompletos', tone: 'amber' })
  }
  // "CNSF sin fecha" sólo importa cuando el candidato ya está en documentación.
  if (stage === 'documentation' && detail && !detail.cnsf_exam_date) {
    badges.push({ id: 'cnsf_no_date', label: 'CNSF sin fecha', tone: 'red' })
  }
  return badges
}

/**
 * Normaliza un valor de input hacia el shape que espera BD, según el tipo del
 * campo. Cadena vacía → null (para "borrar" un dato). Puro.
 */
export function normalizeFieldValue(type, raw) {
  if (raw === '' || raw == null) return null
  switch (type) {
    case 'bool':
      return raw === true || raw === 'true'
    case 'datetime':
    case 'date':
    case 'text':
    case 'select':
    default:
      return raw
  }
}

/**
 * Formatea un valor de BD hacia el value que espera el <input>. Puro.
 *   - 'datetime' → 'YYYY-MM-DDTHH:mm' (datetime-local)
 *   - 'date'     → 'YYYY-MM-DD'
 *   - resto      → string tal cual (o '' si null)
 */
export function toInputValue(type, value) {
  if (value == null) return ''
  if (type === 'datetime') {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    // datetime-local usa hora local, sin zona.
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  if (type === 'date') {
    // Puede venir como 'YYYY-MM-DD' (columna date) o timestamp.
    const s = String(value)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return String(value)
}

/**
 * Deja sólo las llaves editables de un patch (defensa contra escribir columnas
 * de solo-lectura). Puro.
 */
export function sanitizePatch(patch = {}) {
  const clean = {}
  for (const [k, v] of Object.entries(patch)) {
    if (EDITABLE_KEYS.has(k)) clean[k] = v
  }
  return clean
}

// ── Capa de datos (recibe el client de Supabase) ──────────────────────────────

/**
 * Carga la ficha operativa de un candidato. maybeSingle → null si no existe fila
 * todavía (candidatos viejos / sin proceso iniciado).
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function loadDetail(supabase, vacancyCandidateId) {
  if (!supabase || !vacancyCandidateId) return { data: null, error: null }
  const { data, error } = await supabase
    .from('candidate_pipeline_detail')
    .select('*')
    .eq('vacancy_candidate_id', vacancyCandidateId)
    .maybeSingle()
  return { data: data || null, error: error || null }
}

/**
 * Guarda (upsert) un patch de la ficha operativa. Crea la fila si no existe
 * (onConflict vacancy_candidate_id). El patch se sanea a llaves editables y se
 * le agrega updated_at. organization_id es obligatorio para el INSERT (RLS).
 * @param {object} supabase  client
 * @param {object} params { vacancyCandidateId, organizationId, patch }
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function saveDetail(supabase, { vacancyCandidateId, organizationId, patch } = {}) {
  if (!supabase) return { data: null, error: { message: 'Supabase no disponible' } }
  if (!vacancyCandidateId) return { data: null, error: { message: 'Falta vacancy_candidate_id' } }
  if (!organizationId) return { data: null, error: { message: 'Falta organization_id' } }

  const row = {
    vacancy_candidate_id: vacancyCandidateId,
    organization_id: organizationId,
    ...sanitizePatch(patch),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('candidate_pipeline_detail')
    .upsert(row, { onConflict: 'vacancy_candidate_id' })
    .select()
    .maybeSingle()

  return { data: data || null, error: error || null }
}
