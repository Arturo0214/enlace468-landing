// Estado vacío estándar del dashboard.
// icon: componente lucide (no un nodo) · action: nodo (botón/Link) · compact: menos padding.
export default function EmptyState({ icon: Icon, title, description, action, compact = false, className = '' }) {
  return (
    <div className={`text-center glass rounded-xl ${compact ? 'py-6 px-4' : 'py-12 px-6'} ${className}`}>
      {Icon && <Icon size={compact ? 32 : 48} className={`mx-auto text-gray-600 ${compact ? 'mb-2' : 'mb-4'}`} aria-hidden="true" />}
      {title && <h3 className={`font-medium text-white ${compact ? 'text-sm mb-1' : 'text-lg mb-2'}`}>{title}</h3>}
      {description && <p className={`text-gray-400 text-sm ${action ? 'mb-4' : ''}`}>{description}</p>}
      {action}
    </div>
  )
}
