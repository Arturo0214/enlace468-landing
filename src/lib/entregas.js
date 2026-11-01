// Lógica compartida de "Entregas" (pendientes de los admins).
// La urgencia se calcula SIEMPRE al render a partir de due_date + status,
// así que una entrega vencida aparece como URGENTE al día siguiente y
// escala solita cada día que pasa, sin necesidad de un cron.

// Acceso a Entregas: SOLO estos 3 (no todos los admins). Si cambia el equipo,
// actualiza esta lista Y el helper public.user_is_entregas_member() en la BD.
export const ENTREGAS_EMAILS = [
  'flavio.rodriguez@grupointegraccion.com',
  'ingrid.escobar@grupointegraccion.com',
  'osvaldosuarezcruz@gmail.com',
]

export function isEntregasMember(profile) {
  return !!profile?.email && ENTREGAS_EMAILS.includes(profile.email.toLowerCase())
}

const DAY = 86400000

// 'YYYY-MM-DD' se interpreta como fecha LOCAL (medianoche) para evitar
// que UTC la corra un día. Acepta también Date/ISO.
export function parseLocalDate(s) {
  if (!s) return null
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(s)
  return isNaN(d) ? null : d
}

export function startOfToday() {
  const h = new Date()
  h.setHours(0, 0, 0, 0)
  return h
}

// Días desde hoy hasta la fecha (negativo = vencida, 0 = hoy, positivo = futuro)
export function diasHasta(dateStr, hoy = startOfToday()) {
  const f = parseLocalDate(dateStr)
  if (!f) return null
  f.setHours(0, 0, 0, 0)
  return Math.round((f - hoy) / DAY)
}

export const ENTREGA_ESTADOS = {
  pendiente: { label: 'Pendiente' },
  en_progreso: { label: 'En progreso' },
  entregado: { label: 'Entregada' },
  cancelado: { label: 'Cancelada' },
}

export const ENTREGA_PRIORIDADES = {
  low: { label: 'Baja' },
  normal: { label: 'Normal' },
  high: { label: 'Alta' },
}

const pld = (n, s, p) => `${n} ${n === 1 ? s : p}`

// Clasifica una entrega. Devuelve { key, tier?, label, dias, overdue?, sort }.
// sort: ascendente → lo más vencido primero, luego hoy, próximas, futuras,
// sin fecha, entregadas y canceladas al final.
export function entregaUrgencia(e, hoy = startOfToday()) {
  const d = diasHasta(e.due_date, hoy)

  if (e.status === 'cancelado') return { key: 'cancelado', label: 'Cancelada', dias: d, sort: 90000 }
  if (e.status === 'entregado') return { key: 'entregado', label: 'Entregada', dias: d, sort: 80000 }
  if (d === null) return { key: 'sinfecha', label: 'Sin fecha', dias: null, sort: 50000 }

  if (d < 0) {
    const ov = -d
    const tier = ov >= 7 ? 'critico' : ov >= 3 ? 'alto' : 'medio'
    return {
      key: 'urgente',
      tier,
      overdue: ov,
      dias: d,
      label: `URGENTE · vencida hace ${pld(ov, 'día', 'días')}`,
      sort: -ov, // mientras más vencida (ov mayor), más arriba
    }
  }
  if (d === 0) return { key: 'hoy', label: 'Vence hoy', dias: 0, sort: 1 }
  if (d <= 3) return { key: 'pronto', label: `Vence en ${pld(d, 'día', 'días')}`, dias: d, sort: 100 + d }
  return { key: 'futuro', label: `En ${pld(d, 'día', 'días')}`, dias: d, sort: 1000 + d }
}

// ¿Está activa (cuenta para pendientes/urgentes)?
export function esActiva(e) {
  return e.status === 'pendiente' || e.status === 'en_progreso'
}

// Paleta por urgencia (clases tailwind + color para puntos del calendario).
export function urgenciaStyle(u) {
  switch (u.key) {
    case 'urgente':
      return {
        dot: '#EF4444',
        bar: 'bg-red-500',
        badge: 'bg-red-500/20 text-red-300 border border-red-500/40',
        card: u.tier === 'critico'
          ? 'border-red-500/60 bg-red-500/[0.06]'
          : u.tier === 'alto'
            ? 'border-red-500/40 bg-red-500/[0.04]'
            : 'border-red-500/25',
        pulse: u.tier !== 'medio',
      }
    case 'hoy':
      return { dot: '#F59E0B', bar: 'bg-gold-light', badge: 'bg-gold-light/20 text-gold-light border border-gold-light/40', card: 'border-gold-light/30', pulse: false }
    case 'pronto':
      return { dot: '#D97706', bar: 'bg-gold', badge: 'bg-gold/15 text-gold-light border border-gold/30', card: 'border-white/8', pulse: false }
    case 'futuro':
      return { dot: '#4A6FC9', bar: 'bg-primary-light', badge: 'bg-primary-light/15 text-primary-light border border-primary-light/25', card: 'border-white/8', pulse: false }
    case 'entregado':
      return { dot: '#22C55E', bar: 'bg-green-500', badge: 'bg-green-500/15 text-green-400 border border-green-500/30', card: 'border-white/5 opacity-70', pulse: false }
    case 'cancelado':
      return { dot: '#6B7280', bar: 'bg-gray-500', badge: 'bg-gray-500/15 text-gray-400 border border-gray-500/30', card: 'border-white/5 opacity-50', pulse: false }
    default: // sinfecha
      return { dot: '#9CA3AF', bar: 'bg-gray-500', badge: 'bg-gray-500/15 text-gray-400 border border-gray-500/30', card: 'border-white/8', pulse: false }
  }
}

// Formatea fecha larga en es-MX a partir de 'YYYY-MM-DD'
export function fmtFecha(dateStr) {
  const d = parseLocalDate(dateStr)
  if (!d) return '—'
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
}
