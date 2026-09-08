// Constantes y helpers puros compartidos por el pipeline de vacantes
// (VacancyPipeline — tablero principal) y la vista kanban compacta
// (PipelineKanban). Única fuente de verdad: NO dupliques esto en los
// componentes.
import { ExternalLink, Globe, UserPlus, FileText } from 'lucide-react'

// Origen del candidato → etiqueta en la tarjeta. Permite comparar conversión
// de candidatos MANUALES (link pegado / recomendado) vs los del sourcing
// automatizado (feedback de Flavio/Karina 2026-07-24).
export const MANUAL_SOURCES = ['manual', 'referral', 'linkedin', 'csv_import', 'direct', 'other']
export function originBadge(source) {
  if (!source) return null
  if (source === 'meta_ads') return { label: 'Ads', cls: 'bg-purple-500/15 text-purple-300' }
  if (MANUAL_SOURCES.includes(source)) return { label: 'Manual', cls: 'bg-teal-500/15 text-teal-300' }
  return { label: 'Auto', cls: 'bg-blue-500/15 text-blue-300' }
}

// Estilos por etapa del tablero principal (VacancyPipeline); las ETIQUETAS
// visibles salen de useStageLabels() (configurables por org en
// Configuración → Etapas del proceso).
// OJO: los dos tableros NO usan el mismo set de etapas (evaluated vs
// shortlist) ni los mismos estilos — no los unifiques sin revisar UI.
export const PIPELINE_STAGE_DEFS = [
  { id: 'sourced', color: 'border-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/30' },
  { id: 'contacted', color: 'border-blue-400', bg: 'bg-gray-100/60 dark:bg-gray-800/30' },
  { id: 'screening', color: 'border-cyan-400', bg: 'bg-gray-100 dark:bg-gray-800/40' },
  { id: 'interviewing', color: 'border-purple-400', bg: 'bg-gray-200/50 dark:bg-gray-700/30' },
  { id: 'evaluated', color: 'border-gold', bg: 'bg-gray-200/70 dark:bg-gray-700/40' },
  { id: 'presented', color: 'border-accent', bg: 'bg-gray-200 dark:bg-gray-700/50' },
  { id: 'offer', color: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'hired', color: 'border-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  { id: 'rejected', color: 'border-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
]

// Estilos/SLA por etapa de la vista kanban compacta (PipelineKanban).
export const KANBAN_STAGE_DEFS = [
  { id: 'sourced', color: 'border-gray-400', bg: 'bg-gray-400', sla: 3 },
  { id: 'contacted', color: 'border-blue-400', bg: 'bg-blue-400', sla: 2 },
  { id: 'screening', color: 'border-cyan-400', bg: 'bg-cyan-400', sla: 3 },
  { id: 'interviewing', color: 'border-purple-400', bg: 'bg-purple-400', sla: 5 },
  { id: 'shortlist', color: 'border-amber-400', bg: 'bg-amber-400', sla: 3 },
  { id: 'presented', color: 'border-accent', bg: 'bg-accent', sla: 5 },
  { id: 'offer', color: 'border-green-400', bg: 'bg-green-400', sla: 3 },
  { id: 'hired', color: 'border-emerald-500', bg: 'bg-emerald-500', sla: null },
  { id: 'rejected', color: 'border-red-400', bg: 'bg-red-400', sla: null },
]

export const SOURCE_ICONS = {
  linkedin: ExternalLink,
  referral: UserPlus,
  jobboard: Globe,
  internal: FileText,
}

export const SOURCE_COLORS = {
  linkedin: 'bg-blue-500/15 text-blue-400',
  referral: 'bg-purple-500/15 text-purple-400',
  jobboard: 'bg-cyan-500/15 text-cyan-400',
  internal: 'bg-amber-500/15 text-amber-400',
}

export function daysInStage(stageChangedAt) {
  if (!stageChangedAt) return 0
  return Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / (1000 * 60 * 60 * 24))
}

export function agingColor(days, sla) {
  if (!sla) return 'text-gray-500'
  if (days <= sla * 0.5) return 'text-emerald-400'
  if (days <= sla) return 'text-amber-400'
  return 'text-red-400'
}

export function agingBg(days, sla) {
  if (!sla) return 'bg-gray-500/10'
  if (days <= sla * 0.5) return 'bg-emerald-500/10'
  if (days <= sla) return 'bg-amber-500/10'
  return 'bg-red-500/10'
}

export function initials(name) {
  if (!name) return '??'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

// Colores del badge de score. El tablero principal usa la paleta green/gold
// sin borde; la vista kanban usa emerald/amber CON borde. Se conservan ambas
// variantes para no cambiar la UI.
export function scoreColor(score) {
  if (score >= 80) return 'bg-green-500/20 text-green-400'
  if (score >= 60) return 'bg-gold/20 text-gold'
  return 'bg-red-500/20 text-red-400'
}

export function scoreColorBordered(score) {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  return 'bg-red-500/20 text-red-400 border-red-500/30'
}
