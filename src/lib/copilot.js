// ─────────────────────────────────────────────────────────────────────────────
// copilot.js — Motor de reglas del COPILOTO "¿quién está atorado?" (FASE B).
//
// Módulo PURO: no importa supabase ni React. Recibe datos, devuelve "focos"
// (acciones priorizadas). Testeable con `node scripts/test-copilot.mjs`.
//
// Dos funciones:
//   1. buildFocusList({ candidates, details, slaRules, interactions, now })
//      → lista priorizada de focos { type, severity, candidateId, ... }.
//   2. buildDailyPace({ interactionsToday, connectionsToday, monthGoalFC })
//      → ritmo de conexiones vs meta del mes (semáforo verde/amarillo/rojo).
//
// Diseño defensivo: cada candidato viejo puede NO tener fila en
// candidate_pipeline_detail (docs, psicométrico, CNSF); las reglas que dependen
// de esos campos simplemente no disparan si el dato falta. Ningún acceso a
// `undefined.foo` puede romper el motor.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

/** Orden de severidad para el sort (más alto = más urgente). */
const SEVERITY_RANK = { alta: 3, media: 2, baja: 1 }

/** Umbrales (días) de las reglas operativas del diagrama de Ingrid (§1). */
export const THRESHOLDS = {
  noResponseDays: 3,       // outbound sin inbound posterior
  psychometricDays: 3,     // enviado sin resultado
  docsDays: 5,             // en documentation sin confirmar/subir
  cnsfPayDays: 7,          // aceptado sin pago CNSF (semana 1)
}

/** Etapas terminales — nunca generan focos. */
const TERMINAL_STAGES = new Set(['hired', 'rejected'])

// ── helpers ──────────────────────────────────────────────────────────────────

/** Epoch ms de un valor de fecha, o null si es inválido/ausente. */
function ts(value) {
  if (value == null) return null
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

/** Días completos entre `fromTs` (epoch ms) y `now` (epoch ms). >= 0. */
function daysSince(fromTs, now) {
  if (fromTs == null) return 0
  return Math.max(0, Math.floor((now - fromTs) / DAY_MS))
}

/** Índice de detail por vacancy_candidate_id (tolerante a nulls). */
function indexDetails(details) {
  const map = new Map()
  for (const d of details || []) {
    if (d && d.vacancy_candidate_id) map.set(d.vacancy_candidate_id, d)
  }
  return map
}

/** Índice de reglas SLA por stage: { stage → max_days } (activas). */
function indexRules(slaRules) {
  const map = new Map()
  for (const r of slaRules || []) {
    if (!r || r.is_active === false) continue
    const max = Number(r.max_days)
    if (r.stage && Number.isFinite(max) && max > 0) map.set(r.stage, max)
  }
  return map
}

/**
 * Para cada vacancy_candidate: última interacción outbound y última inbound
 * (epoch ms). Se usa en la regla `no_response`.
 * @returns {Map<string, {lastOut:number|null, lastIn:number|null}>}
 */
function indexInteractions(interactions) {
  const map = new Map()
  for (const it of interactions || []) {
    if (!it || !it.vacancy_candidate_id) continue
    const at = ts(it.created_at)
    if (at == null) continue
    let e = map.get(it.vacancy_candidate_id)
    if (!e) { e = { lastOut: null, lastIn: null }; map.set(it.vacancy_candidate_id, e) }
    if (it.direction === 'inbound') {
      if (e.lastIn == null || at > e.lastIn) e.lastIn = at
    } else { // outbound (default en la tabla)
      if (e.lastOut == null || at > e.lastOut) e.lastOut = at
    }
  }
  return map
}

/** Nombre legible del candidato desde la fila (varios shapes posibles). */
function candidateName(vc) {
  return (
    vc?.candidate_name ||
    vc?.candidates?.full_name ||
    vc?.full_name ||
    'Candidato sin nombre'
  )
}

/** Título de la vacante desde la fila (varios shapes posibles). */
function vacancyTitle(vc) {
  return vc?.vacancy_title || vc?.vacancies?.title || vc?.vacancy?.title || '—'
}

/** Timestamp de entrada a la etapa actual (fallback a created_at). */
function stageEnteredTs(vc) {
  return ts(vc?.stage_changed_at) ?? ts(vc?.created_at)
}

// ── motor de focos ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} Focus
 * @property {string} type       'sla_breach'|'no_response'|'psychometric_pending'|
 *                               'docs_incomplete'|'cnsf_unpaid'|'cnsf_no_date'
 * @property {'alta'|'media'|'baja'} severity
 * @property {string} candidateId       vacancy_candidate.id
 * @property {string} candidateName
 * @property {string} vacancyTitle
 * @property {string|null} vacancyId
 * @property {string} stage             stage interno actual
 * @property {string} message           mensaje humano ("… lleva 8d en Orientación")
 * @property {string} action            acción sugerida ("Envíale seguimiento")
 * @property {number} daysStuck         días relevantes al foco (para ordenar/pintar)
 */

/**
 * Construye la lista priorizada de focos ("¿quién está atorado?") a partir del
 * pipeline vivo, su ficha operativa (candidate_pipeline_detail), las reglas SLA
 * y las interacciones recientes.
 *
 * Reglas (una por candidato puede disparar varias):
 *  - `sla_breach`: días en stage (stage_changed_at→now) > max_days de la regla.
 *      severidad: >2× límite → alta, >1× → media, resto baja.
 *  - `no_response`: hay outbound cuya inbound posterior no existe y ya pasaron
 *      ≥ noResponseDays días. severidad por días sin respuesta.
 *  - `psychometric_pending`: psychometric_sent_at sin resultado (o 'pendiente')
 *      > psychometricDays días.
 *  - `docs_incomplete`: stage='documentation' con docs_requested_at pero sin
 *      docs_confirmed_at ni docs_uploaded, > docsDays días.
 *  - `cnsf_unpaid`: accepted_at + cnsfPayDays días sin cnsf_paid_at.
 *  - `cnsf_no_date`: stage='documentation' sin cnsf_exam_date.
 *
 * @param {Object} params
 * @param {Array<Object>} params.candidates  vacancy_candidates activos (con
 *   embeds candidates(full_name) / vacancies(id,title) o campos planos).
 * @param {Array<Object>} [params.details]   filas de candidate_pipeline_detail.
 * @param {Array<Object>} [params.slaRules]  { stage, max_days, is_active? }.
 * @param {Array<Object>} [params.interactions] { vacancy_candidate_id, direction, created_at }.
 * @param {number|string|Date} [params.now]  epoch inyectable (tests). Default Date.now().
 * @returns {Focus[]} focos ordenados por severidad desc, luego daysStuck desc.
 */
export function buildFocusList({ candidates, details, slaRules, interactions, now } = {}) {
  const nowMs = ts(now) ?? Date.now()
  const detailBy = indexDetails(details)
  const ruleBy = indexRules(slaRules)
  const interBy = indexInteractions(interactions)

  const focuses = []

  for (const vc of candidates || []) {
    if (!vc || !vc.id) continue
    if (TERMINAL_STAGES.has(vc.stage)) continue

    const id = vc.id
    const name = candidateName(vc)
    const title = vacancyTitle(vc)
    const vacancyId = vc.vacancy_id || vc.vacancies?.id || null
    const stage = vc.stage || 'sourced'
    const detail = detailBy.get(id) || null
    const base = { candidateId: id, candidateName: name, vacancyTitle: title, vacancyId, stage }

    // ── Regla 1: SLA vencido (días en etapa > max_days) ──
    const maxDays = ruleBy.get(stage)
    if (maxDays != null) {
      const enteredTs = stageEnteredTs(vc)
      const daysInStage = daysSince(enteredTs, nowMs)
      if (daysInStage > maxDays) {
        const over = daysInStage - maxDays
        const severity = daysInStage > maxDays * 2 ? 'alta' : over > maxDays ? 'media' : 'baja'
        focuses.push({
          ...base,
          type: 'sla_breach',
          severity,
          message: `Lleva ${daysInStage}d en esta etapa (límite ${maxDays}d).`,
          action: 'Muévelo o registra su avance',
          daysStuck: daysInStage,
        })
      }
    }

    // ── Regla 2: sin respuesta (outbound sin inbound posterior ≥3d) ──
    const inter = interBy.get(id)
    if (inter && inter.lastOut != null) {
      const answered = inter.lastIn != null && inter.lastIn >= inter.lastOut
      if (!answered) {
        const daysWaiting = daysSince(inter.lastOut, nowMs)
        if (daysWaiting >= THRESHOLDS.noResponseDays) {
          focuses.push({
            ...base,
            type: 'no_response',
            severity: daysWaiting >= THRESHOLDS.noResponseDays * 2 ? 'media' : 'baja',
            message: `${daysWaiting}d sin respuesta desde tu último mensaje.`,
            action: 'Envíale seguimiento',
            daysStuck: daysWaiting,
          })
        }
      }
    }

    // ── Reglas dependientes de la ficha operativa (detail) ──
    if (detail) {
      // Regla 3: psicométrico pendiente > 3d.
      const sentTs = ts(detail.psychometric_sent_at)
      const result = detail.psychometric_result
      const pendingResult = result == null || result === 'pendiente'
      if (sentTs != null && pendingResult) {
        const days = daysSince(sentTs, nowMs)
        if (days > THRESHOLDS.psychometricDays) {
          focuses.push({
            ...base,
            type: 'psychometric_pending',
            severity: days > THRESHOLDS.psychometricDays * 2 ? 'alta' : 'media',
            message: `Psicométrico enviado hace ${days}d, sin resultado aún.`,
            action: 'Dale seguimiento al psicométrico',
            daysStuck: days,
          })
        }
      }

      // Regla 4: documentos incompletos en 'documentation' > 5d.
      if (stage === 'documentation') {
        const requestedTs = ts(detail.docs_requested_at)
        const confirmed = ts(detail.docs_confirmed_at) != null
        const uploaded = hasUploads(detail.docs_uploaded)
        if (requestedTs != null && !confirmed && !uploaded) {
          const days = daysSince(requestedTs, nowMs)
          if (days > THRESHOLDS.docsDays) {
            focuses.push({
              ...base,
              type: 'docs_incomplete',
              severity: days > THRESHOLDS.docsDays * 2 ? 'alta' : 'media',
              message: `Documentos solicitados hace ${days}d, sin confirmar.`,
              action: 'Sube documentos',
              daysStuck: days,
            })
          }
        }

        // Regla 6: fecha CNSF no definida en 'documentation'.
        if (ts(detail.cnsf_exam_date) == null && !detail.cnsf_exam_date) {
          const enteredTs = stageEnteredTs(vc)
          const daysInStage = daysSince(enteredTs, nowMs)
          focuses.push({
            ...base,
            type: 'cnsf_no_date',
            severity: 'media',
            message: 'En documentación sin fecha de examen CNSF definida.',
            action: 'Agenda la fecha del examen CNSF',
            daysStuck: daysInStage,
          })
        }
      }

      // Regla 5: pago CNSF no confirmado (aceptado + 7d sin pago).
      const acceptedTs = ts(detail.accepted_at)
      const paid = ts(detail.cnsf_paid_at) != null
      if (acceptedTs != null && !paid) {
        const days = daysSince(acceptedTs, nowMs)
        if (days >= THRESHOLDS.cnsfPayDays) {
          focuses.push({
            ...base,
            type: 'cnsf_unpaid',
            severity: days >= THRESHOLDS.cnsfPayDays * 2 ? 'alta' : 'media',
            message: `Aceptó hace ${days}d y no hay pago del examen CNSF.`,
            action: 'Confirma pago CNSF',
            daysStuck: days,
          })
        }
      }
    }
  }

  focuses.sort((a, b) => {
    const sr = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
    if (sr !== 0) return sr
    return (b.daysStuck || 0) - (a.daysStuck || 0)
  })

  return focuses
}

/** ¿La columna docs_uploaded (jsonb) contiene al menos un documento? */
function hasUploads(docs) {
  if (!docs) return false
  if (Array.isArray(docs)) return docs.length > 0
  if (typeof docs === 'object') return Object.keys(docs).length > 0
  return false
}

// ── ritmo diario de conexiones ───────────────────────────────────────────────

/**
 * Conexiones necesarias por FC (finance consultant) según el embudo real de
 * sept-2026: ~90-120 conexiones por 1 FC. Usamos el punto medio (105) como
 * base del cálculo. Para 3 FC/mes ≈ 315 conexiones/mes ≈ ~15/día laboral.
 */
export const CONNECTIONS_PER_FC = 105

/** Días laborales estimados por mes (L-V ≈ 22). */
export const WORK_DAYS_PER_MONTH = 22

/**
 * Ritmo diario de conexiones enviadas hoy vs las necesarias para la meta del
 * mes. La "variable crítica" del diagrama: disciplina diaria de conexiones.
 *
 * @param {Object} params
 * @param {number} [params.interactionsToday]  interacciones outbound de hoy
 *   (fallback si no se mide "conexiones" por separado).
 * @param {number} [params.connectionsToday]   conexiones LinkedIn enviadas hoy
 *   (preferido; si viene, ignora interactionsToday).
 * @param {number} [params.monthGoalFC]        meta de FC del mes (default 3
 *   digital; el diagrama pone 5 = 3 digital + 2 referidos).
 * @returns {{ sentToday:number, neededPerDay:number, monthTarget:number,
 *   ratio:number, status:'verde'|'amarillo'|'rojo' }}
 */
export function buildDailyPace({ interactionsToday, connectionsToday, monthGoalFC } = {}) {
  const goal = Number.isFinite(Number(monthGoalFC)) && Number(monthGoalFC) > 0
    ? Number(monthGoalFC)
    : 3
  const sentRaw = connectionsToday != null ? Number(connectionsToday) : Number(interactionsToday)
  const sentToday = Number.isFinite(sentRaw) && sentRaw > 0 ? Math.floor(sentRaw) : 0

  const monthTarget = Math.round(goal * CONNECTIONS_PER_FC)
  const neededPerDay = Math.max(1, Math.ceil(monthTarget / WORK_DAYS_PER_MONTH))
  const ratio = Math.round((sentToday / neededPerDay) * 100) / 100

  const status = ratio >= 1 ? 'verde' : ratio >= 0.6 ? 'amarillo' : 'rojo'

  return { sentToday, neededPerDay, monthTarget, ratio, status }
}
