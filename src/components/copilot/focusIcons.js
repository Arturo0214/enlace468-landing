// Mapeo tipo de foco → icono (lucide) + color, para el CopilotPanel.
// Los colores son de la marca (turquesa #00A99D / navy) + semáforo de alerta.
import { Clock, MessageSquareDashed, Brain, FileWarning, CreditCard, CalendarClock, ListChecks } from 'lucide-react'

/** Config por tipo de foco. `color` es un hex para icono/acento. */
export const FOCUS_ICONS = {
  sla_breach: { icon: Clock, color: '#f59e0b', label: 'Atorado en etapa' },
  no_response: { icon: MessageSquareDashed, color: '#38bdf8', label: 'Sin respuesta' },
  psychometric_pending: { icon: Brain, color: '#a78bfa', label: 'Psicométrico pendiente' },
  docs_incomplete: { icon: FileWarning, color: '#fb7185', label: 'Documentos incompletos' },
  cnsf_unpaid: { icon: CreditCard, color: '#f97316', label: 'Pago CNSF' },
  cnsf_no_date: { icon: CalendarClock, color: '#00A99D', label: 'Fecha CNSF' },
}

/** Config del icono para un tipo de foco (con fallback genérico). */
export function focusIcon(type) {
  return FOCUS_ICONS[type] || { icon: ListChecks, color: '#94a3b8', label: 'Pendiente' }
}

/** Color del punto/badge de severidad. */
export function severityColor(severity) {
  if (severity === 'alta') return '#ef4444'
  if (severity === 'media') return '#f59e0b'
  return '#94a3b8'
}

/** Color del semáforo de ritmo. */
export function paceColor(status) {
  if (status === 'verde') return '#22c55e'
  if (status === 'amarillo') return '#f59e0b'
  return '#ef4444'
}
