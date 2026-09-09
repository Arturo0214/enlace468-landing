// Disposición / ruteo de candidatos (FASE C del plan de ruteo, §3 de
// docs/CONTEXTO-COPILOTO-Y-RUTEO-2026-09.md).
//
// La idea (Arturo): un candidato no-apto para Finance Consultant NO tiene por
// qué morir en 'rejected'. Puede rutearse a otro destino/monetización:
//   - Tu Marca Vende (producto CV+LinkedIn $499, funnel en /tu-marca-vende)
//   - otro rol comercial / pool
//   - otro producto del ecosistema
//   - nurture (revisitar después)
//   - descartar (basura real)
//
// El punto de control E (Apto/No apto/Pendiente) del diagrama de Ingrid se
// convierte en este selector con más salidas.
//
// Este módulo es PURO y testeable: sin React, sin Supabase, sin efectos.
// La UI (DispositionSelector) y la persistencia se construyen encima.

// Valor por defecto en BD: vacancy_candidates.disposition DEFAULT 'fc_track'.
export const DEFAULT_DISPOSITION = 'fc_track'

// Catálogo de salidas. `color` son clases Tailwind (token-friendly, dark/light).
// `action` describe la acción/monetización asociada; `routes` indica si el
// destino requiere un `routed_to` (otra vacante/producto).
export const DISPOSITIONS = [
  {
    value: 'fc_track',
    label: 'Apto FC',
    icon: 'CheckCircle2',
    description: 'Apto para Finance Consultant — sigue el pipeline normal.',
    action: 'Continúa en el proceso de selección',
    color: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
    routes: false,
  },
  {
    value: 'tu_marca_vende',
    label: 'Tu Marca Vende',
    icon: 'Sparkles',
    description: 'No-FC pero le sirve/le vendemos CV + LinkedIn ($499).',
    action: '→ enviar al funnel Tu Marca Vende (link de pago)',
    color: { text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-400/30', dot: 'bg-cyan-400' },
    routes: false,
    fundedProduct: true, // genera ingreso B2C
  },
  {
    value: 'otro_rol',
    label: 'Otro rol comercial',
    icon: 'Briefcase',
    description: 'Buen vendedor para otra vacante/pool comercial, no para FC.',
    action: '→ re-asignar a otra vacante o pool comercial',
    color: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-400' },
    routes: true, // routed_to = vacante/pool destino
  },
  {
    value: 'otro_producto',
    label: 'Otro producto',
    icon: 'Package',
    description: 'Cliente potencial de otro producto del ecosistema (Academy, curso…).',
    action: '→ oferta cruzada de otro producto',
    color: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', dot: 'bg-violet-400' },
    routes: true, // routed_to = producto destino
    fundedProduct: true,
  },
  {
    value: 'nurture',
    label: 'Revisitar después',
    icon: 'Clock',
    description: 'No ahora, pero vale la pena revisitar más adelante.',
    action: '→ secuencia de nurture a largo plazo',
    color: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
    routes: false,
  },
  {
    value: 'descartado',
    label: 'Descartar',
    icon: 'XCircle',
    description: 'Fuera total (extranjero, seguros, basura). No recontactar.',
    action: '→ basura, no recontactar',
    color: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400' },
    routes: false,
  },
]

// Valores válidos (deben coincidir con el CHECK de la columna en BD).
export const DISPOSITION_VALUES = DISPOSITIONS.map(d => d.value)

// Lookup por valor; devuelve el registro fc_track por defecto si no existe
// (nunca undefined, para que la UI no reviente con datos viejos).
export function getDisposition(value) {
  return DISPOSITIONS.find(d => d.value === value) || DISPOSITIONS[0]
}

// Etiqueta corta segura (para reportes/labels).
export function dispositionLabel(value) {
  return getDisposition(value).label
}

// ── Sugerencia automática (best-effort, sólo reglas — sin IA) ──
//
// Recibe un objeto candidato "aplanado" con lo que tengamos a la mano:
//   { full_name, current_title, current_company, years_experience,
//     match_score, tags, notes, location, stage, ... }
// (En el pipeline suele venir como vc + vc.candidates fusionados; el caller
// debe pasar un objeto con esas llaves.)
//
// Devuelve { value, reason } — una sugerencia y el porqué en español. Nunca
// null: si no hay señal fuerte, sugiere fc_track (el default) con razón neutra.
//
// Reglas (ordenadas por prioridad; la primera que dispara gana):
//   1. Señales de "descartar" (extranjero / seguros / basura) → descartado.
//   2. Menciona mejorar su CV / marca personal / LinkedIn → tu_marca_vende.
//   3. Perfil comercial fuerte pero rol/experiencia muy distinta a FC → otro_rol.
//   4. Match bajo pero buen perfil general → nurture.
//   5. Si no, y el match es decente → fc_track.
export function suggestDisposition(candidate = {}) {
  const text = normalize([
    candidate.current_title,
    candidate.current_company,
    candidate.notes,
    Array.isArray(candidate.tags) ? candidate.tags.join(' ') : candidate.tags,
    candidate.location,
    candidate.headline,
    candidate.summary,
  ].filter(Boolean).join(' · '))

  const score = numOrNull(candidate.match_score)
  const years = numOrNull(candidate.years_experience)

  // 1. Descartar — señales duras de no-encaje.
  if (matchesAny(text, DESCARTE_HINTS)) {
    return { value: 'descartado', reason: 'Señales de perfil fuera de alcance (extranjero/seguros/no comercial) en el perfil.' }
  }

  // 2. Tu Marca Vende — busca mejorar su presencia/marca.
  if (matchesAny(text, MARCA_HINTS)) {
    return { value: 'tu_marca_vende', reason: 'El perfil menciona mejorar su CV / marca personal / LinkedIn — encaja con Tu Marca Vende ($499).' }
  }

  // 3. Otro rol comercial — perfil vendedor fuerte pero lejos de FC.
  const isComercial = matchesAny(text, COMERCIAL_HINTS)
  const lejosDeFinanzas = !matchesAny(text, FINANZAS_HINTS)
  if (isComercial && lejosDeFinanzas) {
    return { value: 'otro_rol', reason: 'Perfil comercial fuerte sin apetito financiero — mejor para otra vacante/pool comercial.' }
  }

  // 4. Nurture — perfil aprovechable pero match bajo hoy.
  if (score != null && score < 55 && (years == null || years >= 2)) {
    return { value: 'nurture', reason: `Match bajo (${Math.round(score)}%) pero perfil aprovechable — revisitar más adelante.` }
  }

  // 5. Default: seguir en FC.
  if (score != null && score >= 55) {
    return { value: 'fc_track', reason: `Match saludable (${Math.round(score)}%) — mantener en el pipeline de FC.` }
  }
  return { value: 'fc_track', reason: 'Sin señales fuertes de ruteo — mantener en el pipeline de FC por defecto.' }
}

// ── Agregación para reportes (§3: "impacto en reportes") ──
//
// Recibe la lista de candidatos (cada uno con .disposition) y devuelve el
// conteo por disposición + métricas de recuperación de no-aptos. Puro.
export function summarizeDispositions(candidates = []) {
  const counts = {}
  for (const d of DISPOSITION_VALUES) counts[d] = 0
  let unset = 0
  for (const c of candidates) {
    const d = c?.disposition
    if (d && Object.prototype.hasOwnProperty.call(counts, d)) counts[d] += 1
    else unset += 1 // dato viejo / null → cuenta como fc_track implícito
  }
  // Los null se tratan como fc_track (default de la columna).
  counts.fc_track += unset

  const total = candidates.length
  // "Recuperados": no-aptos que fueron ruteados a un destino con valor en vez
  // de morir en descartado (todo lo que no es fc_track ni descartado).
  const recovered = counts.tu_marca_vende + counts.otro_rol + counts.otro_producto + counts.nurture
  // Valor B2C directo del pipeline: candidatos enviados a productos pagados.
  const monetizable = counts.tu_marca_vende + counts.otro_producto
  const nonFc = total - counts.fc_track

  return {
    counts,
    total,
    recovered,
    monetizable,
    nonFc,
    // Tasa de recuperación de los no-aptos (de los que salieron de FC, cuántos
    // se rutearon a algo con valor en vez de descartarse).
    recoveryRate: nonFc > 0 ? recovered / nonFc : 0,
  }
}

// ── Precio de referencia de Tu Marca Vende (para la métrica de reportes) ──
export const TU_MARCA_VENDE_PRICE = 499

// ─────────────────────────── helpers internos ───────────────────────────

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos combinantes
}

function numOrNull(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function matchesAny(haystack, needles) {
  return needles.some(n => haystack.includes(n))
}

// Diccionarios de señales (ya normalizados: minúsculas, sin acentos).
const DESCARTE_HINTS = [
  'extranjero', 'foreign', 'no reside en mexico', 'fuera de mexico',
  'agente de seguros', 'vendedor de seguros', 'seguros gnp', 'seguros monterrey',
  'spam', 'basura', 'no interesa', 'no aplica',
]
const MARCA_HINTS = [
  'mejorar cv', 'mejorar mi cv', 'mejorar curriculum', 'actualizar cv',
  'marca personal', 'personal brand', 'mejorar linkedin', 'perfil de linkedin',
  'busco empleo', 'buscando trabajo', 'open to work', 'busca reubicarse',
  'quiere destacar', 'presencia profesional',
]
const COMERCIAL_HINTS = [
  'ventas', 'vendedor', 'comercial', 'sales', 'account executive',
  'ejecutivo de cuenta', 'desarrollo de negocio', 'business development',
  'asesor comercial', 'representante de ventas', 'key account', 'closer',
]
const FINANZAS_HINTS = [
  'financ', 'finance', 'inversion', 'invest', 'patrimonial', 'seguros de vida',
  'afore', 'banca', 'credito', 'analista financiero', 'consultor financiero',
  'wealth', 'consultor de finanzas',
]
