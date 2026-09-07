import { forwardRef } from 'react'
import Spinner from './Spinner'

// Botón de marca. Consistente con el patrón actual del dashboard
// (gradiente + rounded-lg + hover:opacity-90), re-brandeado navy→turquesa.
// variant: primary | secondary | ghost | danger · size: sm | md | lg
// loading: Spinner interno + aria-busy + disabled · icon/iconRight: componente lucide
// as: elemento/componente alternativo (ej. Link) — pasa `to`, `href`, etc. como props extra.
const variants = {
  primary: 'bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 shadow-sm',
  secondary: 'glass text-gray-300 hover:text-white hover:bg-white/10 border border-white/10',
  ghost: 'text-gray-400 hover:text-white hover:bg-white/10',
  danger: 'bg-red-600/90 text-white hover:bg-red-600',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-lg',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
}

const iconSizes = { sm: 14, md: 16, lg: 18 }

const Button = forwardRef(function Button(
  {
    as: Comp = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon: Icon,
    iconRight: IconRight,
    className = '',
    children,
    type,
    ...rest
  },
  ref
) {
  const isButton = Comp === 'button'
  const isDisabled = disabled || loading
  const iconSize = iconSizes[size] || 16
  return (
    <Comp
      ref={ref}
      type={isButton ? type || 'button' : type}
      disabled={isButton ? isDisabled : undefined}
      aria-disabled={!isButton && isDisabled ? true : undefined}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center font-medium whitespace-nowrap transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" colorClass="border-current" />
      ) : (
        Icon && <Icon size={iconSize} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} aria-hidden="true" />}
    </Comp>
  )
})

export default Button
