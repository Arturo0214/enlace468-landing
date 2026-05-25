import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, ShoppingCart, Sparkles, Send, Loader2 } from 'lucide-react'
import { useCart } from '../../lib/cartContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `E468-${ts}-${rand}`
}

export default function CheckoutPage() {
  const { items, total, clearCart, itemCount } = useCart()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', company: '', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (items.length === 0) return
    setSubmitting(true)

    const ordNum = generateOrderNumber()

    try {
      await supabase.from('checkout_orders').insert([{
        order_number: ordNum,
        customer_name: form.fullName,
        customer_email: form.email,
        customer_phone: form.phone,
        customer_company: form.company || null,
        items: items.map(i => ({
          plan_id: i.plan.id,
          plan_name: i.plan.name,
          product_line: i.plan.product_line,
          price_mxn: i.plan.price_mxn,
          setup_fee_mxn: i.plan.setup_fee_mxn,
          billing_cycle: i.plan.billing_cycle,
        })),
        total_mxn: total,
        payment_status: 'pending',
        notes: form.notes || null,
      }])
    } catch (err) {
      console.error('Order error:', err)
    }

    setOrderNumber(ordNum)
    clearCart()
    setSuccess(true)
    setSubmitting(false)
  }

  // Success
  if (success) {
    return (
      <div className="min-h-screen bg-theme flex items-center justify-center px-4 py-12">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: -20, x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000) }}
              animate={{ opacity: [0, 1, 1, 0], y: [0, (typeof window !== 'undefined' ? window.innerHeight : 800) + 100], rotate: [0, Math.random() * 720 - 360] }}
              transition={{ duration: 3 + Math.random() * 3, delay: Math.random() * 1.5, ease: 'easeOut' }}
              className="absolute w-3 h-3 rounded-full"
              style={{ backgroundColor: ['#2563EB', '#0D9488', '#8B5CF6', '#F59E0B', '#EC4899'][i % 5] }}
            />
          ))}
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20 }}
          className="glass-strong rounded-2xl p-8 sm:p-12 max-w-lg w-full text-center border border-white/10">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', damping: 15 }}
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="font-display font-bold text-3xl text-white mb-2">Solicitud recibida</h1>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-accent" />
            <p className="text-accent font-mono font-semibold">{orderNumber}</p>
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Nuestro equipo te contactara en las proximas <span className="text-white font-semibold">24 horas</span> para
            confirmar tu plan, coordinar el pago y activar tu cuenta.
          </p>
          <button onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all">
            Ir al dashboard
          </button>
        </motion.div>
      </div>
    )
  }

  // Empty
  if (itemCount === 0) {
    return (
      <div className="min-h-screen bg-theme flex items-center justify-center px-4 py-12">
        <div className="glass-strong rounded-2xl p-8 sm:p-12 max-w-md w-full text-center border border-white/10">
          <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-white mb-2">Carrito vacio</h2>
          <p className="text-gray-400 text-sm mb-6">Agrega planes desde la seccion de precios.</p>
          <button onClick={() => navigate('/#precios')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border border-white/10 text-gray-300 hover:text-white hover:border-primary/40 transition-all">
            <ArrowLeft className="w-4 h-4" /> Ver precios
          </button>
        </div>
      </div>
    )
  }

  const subtotalPrices = items.reduce((s, i) => s + i.plan.price_mxn, 0)
  const subtotalSetup = items.reduce((s, i) => s + (i.plan.setup_fee_mxn || 0), 0)

  return (
    <div className="min-h-screen bg-theme">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> Volver
        </motion.button>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="font-display font-bold text-3xl sm:text-4xl text-white mb-10">
          Checkout
        </motion.h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
            <div className="glass-strong rounded-2xl p-6 border border-white/10 sticky top-8">
              <h2 className="font-display font-bold text-lg text-white mb-6">Resumen</h2>
              <div className="space-y-4 mb-6">
                {items.map(item => (
                  <div key={item.plan.id} className="glass rounded-xl p-4 border border-white/5">
                    <h3 className="text-white font-semibold text-sm">{item.plan.name}</h3>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${productLineColors[item.plan.product_line] || 'bg-gray-500/20 text-gray-400'}`}>
                      {item.plan.product_line_label || item.plan.product_line}
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-white font-bold">{formatPrice(item.plan.price_mxn)}</span>
                      <span className="text-gray-500 text-xs">{item.plan.billing_cycle}</span>
                    </div>
                    {item.plan.setup_fee_mxn > 0 && (
                      <p className="text-gray-500 text-xs mt-1">+ {formatPrice(item.plan.setup_fee_mxn)} setup</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-4 border-t border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white">{formatPrice(subtotalPrices)}</span>
                </div>
                {subtotalSetup > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Setup</span>
                    <span className="text-white">{formatPrice(subtotalSetup)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-white/10">
                  <span className="text-white">Total</span>
                  <span className="gradient-text">{formatPrice(total)}</span>
                </div>
                <p className="text-gray-500 text-xs pt-1">Precios en MXN antes de IVA</p>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="glass-strong rounded-2xl p-6 sm:p-8 border border-white/10">
              <h2 className="font-display font-bold text-lg text-white mb-6">Datos de contacto</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Nombre completo *</label>
                  <input type="text" name="fullName" required value={form.fullName} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-sm"
                    placeholder="Tu nombre" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Email *</label>
                  <input type="email" name="email" required value={form.email} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-sm"
                    placeholder="email@empresa.com" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Telefono *</label>
                  <input type="tel" name="phone" required value={form.phone} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-sm"
                    placeholder="+52 55 1234 5678" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Empresa (opcional)</label>
                  <input type="text" name="company" value={form.company} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-sm"
                    placeholder="Nombre de la empresa" />
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-gray-400 text-sm mb-1.5">Notas adicionales</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 text-sm resize-none"
                  placeholder="Comentarios, preguntas o requerimientos..." />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-4 px-6 rounded-xl font-bold text-base bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-5 h-5" /> Solicitar plan</>
                )}
              </button>

              <p className="text-gray-500 text-xs text-center mt-4">
                Nuestro equipo te contactara para coordinar la activacion y el metodo de pago (transferencia, tarjeta, PayPal o Mercado Pago).
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
