// Spinner de carga de marca (turquesa). Accesible: role=status + label sr-only.
const sizes = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export default function Spinner({ size = 'md', className = '', label = 'Cargando', colorClass = 'border-accent' }) {
  return (
    <span role="status" className={`inline-flex ${className}`}>
      <span
        aria-hidden="true"
        className={`animate-spin rounded-full border-t-transparent ${colorClass} ${sizes[size] || sizes.md}`}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
