import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, X, Trash2, ArrowRight } from 'lucide-react'
import { useCart } from '../../lib/cartContext'
import { useNavigate } from 'react-router-dom'

const productLineColors = {
  enterprise: 'bg-blue-500/20 text-blue-400',
  'talent-desk': 'bg-purple-500/20 text-purple-400',
  'recruiter-pro': 'bg-teal-500/20 text-teal-400',
  academy: 'bg-amber-500/20 text-amber-400',
  'tu-marca-vende': 'bg-rose-500/20 text-rose-400',
}

function formatPrice(n) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 })
}

export default function CartDrawer({ isOpen, onClose }) {
  const { items, removeItem, clearCart, total } = useCart()
  const navigate = useNavigate()

  function handleCheckout() {
    onClose()
    navigate('/checkout')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col glass-strong border-l border-white/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-primary-light" />
                <h2 className="font-display font-bold text-lg text-white">Tu carrito</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingCart className="w-16 h-16 text-gray-600 mb-4" />
                  <p className="text-gray-400 text-lg font-medium mb-2">Carrito vacio</p>
                  <p className="text-gray-500 text-sm">Agrega planes desde la seccion de precios</p>
                </div>
              ) : (
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.div
                      key={item.plan.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.25 }}
                      className="glass rounded-xl p-4 border border-white/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-sm truncate">
                            {item.plan.name}
                          </h3>
                          <span
                            className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${
                              productLineColors[item.plan.product_line] || 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            {item.plan.product_line_label}
                          </span>
                          <div className="mt-2 space-y-0.5">
                            <p className="text-white font-bold text-base">
                              {formatPrice(item.plan.price_mxn)}{' '}
                              <span className="text-gray-500 text-xs font-normal">
                                {item.plan.billing_cycle}
                              </span>
                            </p>
                            {item.plan.setup_fee_mxn > 0 && (
                              <p className="text-gray-500 text-xs">
                                + {formatPrice(item.plan.setup_fee_mxn)} setup
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(item.plan.id)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Subtotal (con setup)</span>
                  <span className="text-white font-bold text-lg">{formatPrice(total)}</span>
                </div>
                <p className="text-gray-500 text-xs">Precios en MXN antes de IVA</p>
                <div className="flex gap-3">
                  <button
                    onClick={clearCart}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-medium border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
                  >
                    Vaciar carrito
                  </button>
                  <button
                    onClick={handleCheckout}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    Checkout
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
