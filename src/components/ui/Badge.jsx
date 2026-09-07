// Badge de marca. color: navy | turquoise | green | amber | red | gray
// variant: soft (default) | solid | outline · size: sm | md · dot: puntito de estado.
const palette = {
  navy: {
    soft: 'bg-primary-light/20 text-primary-light',
    solid: 'bg-primary text-white',
    outline: 'border border-primary-light/40 text-primary-light',
    dot: 'bg-primary-light',
  },
  turquoise: {
    soft: 'bg-accent/20 text-accent-light',
    solid: 'bg-accent text-white',
    outline: 'border border-accent/40 text-accent-light',
    dot: 'bg-accent',
  },
  green: {
    soft: 'bg-green-500/20 text-green-400',
    solid: 'bg-green-600 text-white',
    outline: 'border border-green-500/40 text-green-400',
    dot: 'bg-green-400',
  },
  amber: {
    soft: 'bg-gold/20 text-gold-light',
    solid: 'bg-gold text-white',
    outline: 'border border-gold/40 text-gold-light',
    dot: 'bg-gold-light',
  },
  red: {
    soft: 'bg-red-500/20 text-red-400',
    solid: 'bg-red-600 text-white',
    outline: 'border border-red-500/40 text-red-400',
    dot: 'bg-red-400',
  },
  gray: {
    soft: 'bg-gray-500/20 text-gray-300',
    solid: 'bg-gray-600 text-white',
    outline: 'border border-gray-500/40 text-gray-400',
    dot: 'bg-gray-400',
  },
}

const sizes = {
  sm: 'text-[11px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
}

export default function Badge({ color = 'gray', variant = 'soft', size = 'sm', dot = false, className = '', children }) {
  const p = palette[color] || palette.gray
  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${p[variant] || p.soft} ${sizes[size] || sizes.sm} ${className}`}>
      {dot && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${p.dot}`} />}
      {children}
    </span>
  )
}
