import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { ToastContext } from '../../lib/toast'

// Sistema de toasts de la app (reemplaza window.alert).
// ToastProvider monta el contexto + stack visual (top-right, portal, glass,
// aria-live polite). Auto-dismiss: 5s (8s para errores).
const typeStyles = {
  success: { icon: CheckCircle, accent: 'text-accent-light', bar: 'bg-accent' },
  error: { icon: AlertCircle, accent: 'text-red-400', bar: 'bg-red-500' },
  info: { icon: Info, accent: 'text-primary-light', bar: 'bg-primary-light' },
}

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const push = useCallback((type, message) => {
    const id = nextId++
    setToasts(prev => [...prev.slice(-4), { id, type, message: String(message) }])
    timers.current[id] = setTimeout(() => dismiss(id), type === 'error' ? 8000 : 5000)
    return id
  }, [dismiss])

  const toast = useMemo(() => ({
    success: msg => push('success', msg),
    error: msg => push('error', msg),
    info: msg => push('info', msg),
    dismiss,
  }), [push, dismiss])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// Capa visual del stack de toasts.
export default function ToastStack({ toasts, onDismiss }) {
  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notificaciones"
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map(t => {
          const s = typeStyles[t.type] || typeStyles.info
          const Icon = s.icon
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              role="status"
              className="glass-strong rounded-xl overflow-hidden pointer-events-auto shadow-lg"
            >
              <div className="flex items-start gap-3 p-3.5 pr-2.5">
                <Icon size={18} className={`${s.accent} flex-shrink-0 mt-0.5`} aria-hidden="true" />
                <p className="text-sm text-theme flex-1 min-w-0 break-words">{t.message}</p>
                <button
                  type="button"
                  onClick={() => onDismiss(t.id)}
                  aria-label="Cerrar notificación"
                  className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
              <div className={`h-0.5 ${s.bar} opacity-60`} aria-hidden="true" />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body
  )
}
