import { createContext, useContext } from 'react'

// Contexto + hook del sistema de toasts (reemplaza window.alert).
// El provider vive en src/components/ui/Toast.jsx (ToastProvider).
// Uso: const toast = useToast(); toast.success('Guardado') / toast.error(msg) / toast.info(msg)
export const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback seguro si un componente se renderiza fuera del provider.
    return {
      success: msg => console.log('[toast:success]', msg),
      error: msg => console.error('[toast:error]', msg),
      info: msg => console.log('[toast:info]', msg),
      dismiss: () => {},
    }
  }
  return ctx
}
