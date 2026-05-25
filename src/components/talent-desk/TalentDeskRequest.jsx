import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2, CheckCircle, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const urgencyOptions = [
  { value: '1_week', label: '1 semana' },
  { value: '2_weeks', label: '2 semanas' },
  { value: '1_month', label: '1 mes' },
]

const contactOptions = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Llamada' },
]

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `TD-${ts}-${rand}`
}

export default function TalentDeskRequest({ tier, onClose }) {
  const { profile } = useAuth()
  const [vacancies, setVacancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    vacancy_id: '',
    notes: '',
    contact_preference: 'email',
    urgency: '2_weeks',
  })

  useEffect(() => {
    if (profile) loadVacancies()
  }, [profile])

  async function loadVacancies() {
    const { data } = await supabase
      .from('vacancies')
      .select('id, title')
      .eq('organization_id', profile.organization_id)
      .in('status', ['open', 'draft'])
      .order('created_at', { ascending: false })
    setVacancies(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    const ordNum = generateOrderNumber()

    try {
      await supabase.from('checkout_orders').insert([{
        order_number: ordNum,
        customer_name: profile.full_name,
        customer_email: profile.email,
        customer_phone: null,
        customer_company: profile.organizations?.name || null,
        items: [{
          type: 'talent_desk',
          tier_id: tier.id,
          tier_name: tier.name,
          product_line: 'talent-desk',
          price_mxn: tier.price,
          vacancy_id: form.vacancy_id === 'new' ? null : form.vacancy_id || null,
          new_vacancy: form.vacancy_id === 'new',
          notes: form.notes || null,
          contact_preference: form.contact_preference,
          urgency: form.urgency,
        }],
        total_mxn: tier.price,
        payment_status: 'pending',
        notes: `Talent Desk ${tier.name} - ${form.urgency} - Contacto: ${form.contact_preference}`,
      }])
      setSuccess(true)
    } catch (err) {
      console.error('Talent Desk request error:', err)
    }

    setSubmitting(false)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg glass rounded-2xl overflow-hidden"
          style={{ background: '#0F1729' }}
        >
          {success ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h2 className="text-xl font-display font-bold text-white mb-2">Solicitud recibida</h2>
              <p className="text-gray-400 mb-6">
                Te contactaremos en 24 horas para comenzar con tu Talent Desk {tier.name}.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Entendido
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Package size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-bold text-white">Solicitar Talent Desk</h2>
                    <p className="text-xs text-gray-500">Plan {tier.name} - ${tier.price.toLocaleString()} MXN</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Vacancy selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Vacante</label>
                  <select
                    name="vacancy_id"
                    value={form.vacancy_id}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-light/50 transition-colors"
                  >
                    <option value="" className="bg-[#0F1729]">Selecciona una vacante</option>
                    {vacancies.map(v => (
                      <option key={v.id} value={v.id} className="bg-[#0F1729]">{v.title}</option>
                    ))}
                    <option value="new" className="bg-[#0F1729]">+ Nueva vacante</option>
                  </select>
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Urgencia</label>
                  <div className="grid grid-cols-3 gap-2">
                    {urgencyOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, urgency: opt.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                          form.urgency === opt.value
                            ? 'border-primary-light/50 bg-primary/10 text-primary-light'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact preference */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Contacto preferido</label>
                  <div className="grid grid-cols-3 gap-2">
                    {contactOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, contact_preference: opt.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                          form.contact_preference === opt.value
                            ? 'border-primary-light/50 bg-primary/10 text-primary-light'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Notas adicionales</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Detalles del perfil, industria, seniority, ubicacion..."
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-light/50 transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !form.vacancy_id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Enviar solicitud
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
