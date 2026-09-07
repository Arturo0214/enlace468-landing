import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import Spinner from './Spinner'

// Diálogo de confirmación declarativo (reemplaza window.confirm).
// Uso: <ConfirmDialog open={!!pending} title="..." message="..." danger
//        onConfirm={...} onCancel={() => setPending(null)} />
// Foco inicial en Cancelar · Escape y click en backdrop cierran.
export default function ConfirmDialog({
  open,
  title = '¿Estás seguro?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18 }}
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            className="glass-strong rounded-2xl w-full max-w-sm p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-500/15 text-red-400' : 'bg-accent/15 text-accent-light'}`}>
                {danger ? <AlertTriangle size={18} aria-hidden="true" /> : <HelpCircle size={18} aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-white text-base">{title}</h3>
                {message && <p className="text-sm text-gray-400 mt-1 whitespace-pre-line">{message}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                aria-busy={loading || undefined}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 ${
                  danger ? 'bg-red-600/90 hover:bg-red-600' : 'bg-gradient-to-r from-primary to-accent hover:opacity-90'
                }`}
              >
                {loading && <Spinner size="sm" colorClass="border-current" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
