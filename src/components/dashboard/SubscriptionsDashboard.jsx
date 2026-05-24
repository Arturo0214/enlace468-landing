import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard, TrendingUp, Briefcase, CalendarPlus, Shield, Loader2,
  Search, Download, Plus, FileText, Pause, Play, XCircle, X, Check,
  ChevronDown, ArrowUpDown
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const PRODUCT_LINES = [
  { id: 'enterprise', label: 'Enterprise', color: 'bg-indigo-500' },
  { id: 'talent_desk', label: 'Talent Desk', color: 'bg-cyan-500' },
  { id: 'recruiter_pro', label: 'Recruiter Pro', color: 'bg-violet-500' },
  { id: 'academy', label: 'Academy', color: 'bg-amber-500' },
  { id: 'tu_marca_vende', label: 'Tu Marca Vende', color: 'bg-pink-500' },
]

const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const STATUS_LABELS = { active: 'Activo', paused: 'Pausado', cancelled: 'Cancelado' }

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
const labelClass = "block text-sm font-medium text-gray-400 mb-1"
const btnPrimary = "flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-medium transition-colors disabled:opacity-50"

// ── Modal ────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-display font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, gradient, iconColor, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="glass rounded-xl p-5 hover:scale-[1.02] transition-transform"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${iconColor}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </motion.div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function SubscriptionsDashboard() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [loading, setLoading] = useState(true)
  const [subscriptions, setSubscriptions] = useState([])
  const [plans, setPlans] = useState([])
  const [profiles, setProfiles] = useState([])
  const [saving, setSaving] = useState(false)

  // Filters
  const [filterProduct, setFilterProduct] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at')

  // Modals
  const [showAssignPlan, setShowAssignPlan] = useState(false)
  const [showCreateOrder, setShowCreateOrder] = useState(false)

  // Forms
  const [planForm, setPlanForm] = useState({ profile_id: '', plan_id: '', notes: '' })
  const [orderForm, setOrderForm] = useState({ profile_id: '', plan_id: '', amount: '', notes: '' })

  useEffect(() => {
    if (isSuperAdmin) loadData()
  }, [isSuperAdmin])

  // ── Access guard ───────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Shield size={48} className="text-red-400 mb-4" />
        <h2 className="text-xl font-display font-bold text-white mb-2">Acceso denegado</h2>
        <p className="text-gray-400 max-w-md">
          Solo los administradores con rol <span className="text-primary font-medium">super_admin</span> pueden acceder a este panel.
        </p>
      </div>
    )
  }

  async function loadData() {
    setLoading(true)
    try {
      const [subsRes, plansRes, profilesRes] = await Promise.all([
        supabase.from('subscriptions').select('*, plans(id, name, product_line, price_mxn, billing_cycle), profiles(id, full_name, email)').order('created_at', { ascending: false }),
        supabase.from('plans').select('*').order('product_line, name'),
        supabase.from('profiles').select('id, full_name, email').order('full_name'),
      ])
      setSubscriptions(subsRes.data || [])
      setPlans(plansRes.data || [])
      setProfiles(profilesRes.data || [])
    } catch (err) {
      console.error('Error loading subscription data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── KPI calculations ──────────────────────────────────────────
  const activeSubs = subscriptions.filter(s => s.status === 'active')
  const totalActive = activeSubs.length

  const monthlyRevenue = activeSubs.reduce((sum, s) => {
    if (s.plans?.billing_cycle === 'monthly') return sum + (s.plans.price_mxn || 0)
    return sum
  }, 0)

  const vacancyRevenue = activeSubs.reduce((sum, s) => {
    if (s.plans?.product_line === 'talent_desk') return sum + (s.plans.price_mxn || 0)
    return sum
  }, 0)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const newThisMonth = subscriptions.filter(s => s.created_at >= startOfMonth).length

  // ── Distribution by product line ──────────────────────────────
  const countByLine = PRODUCT_LINES.map(pl => ({
    ...pl,
    count: activeSubs.filter(s => s.plans?.product_line === pl.id).length,
  }))
  const maxCount = Math.max(1, ...countByLine.map(c => c.count))

  const revenueByLine = PRODUCT_LINES.map(pl => {
    const total = activeSubs
      .filter(s => s.plans?.product_line === pl.id)
      .reduce((sum, s) => sum + (s.plans?.price_mxn || 0), 0)
    return { ...pl, total }
  })
  const maxRevenue = Math.max(1, ...revenueByLine.map(r => r.total))

  // ── Filtered & sorted subscriptions ───────────────────────────
  const filtered = useMemo(() => {
    let list = [...subscriptions]
    if (filterProduct) list = list.filter(s => s.plans?.product_line === filterProduct)
    if (filterStatus) list = list.filter(s => s.status === filterStatus)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(s =>
        (s.profiles?.full_name || '').toLowerCase().includes(q) ||
        (s.profiles?.email || '').toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      if (sortBy === 'created_at') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'plan') return (a.plans?.name || '').localeCompare(b.plans?.name || '')
      if (sortBy === 'price') return (b.plans?.price_mxn || 0) - (a.plans?.price_mxn || 0)
      return 0
    })
    return list
  }, [subscriptions, filterProduct, filterStatus, searchQuery, sortBy])

  // ── Actions ────────────────────────────────────────────────────
  async function updateSubStatus(id, newStatus) {
    try {
      const { error } = await supabase.from('subscriptions').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s))
    } catch (err) {
      alert('Error al actualizar suscripcion: ' + err.message)
    }
  }

  async function handleAssignPlan() {
    if (!planForm.plan_id || !planForm.profile_id) return
    setSaving(true)
    try {
      const { error } = await supabase.from('subscriptions').insert({
        plan_id: planForm.plan_id,
        profile_id: planForm.profile_id,
        status: 'active',
        notes: planForm.notes || null,
      })
      if (error) throw error
      setPlanForm({ profile_id: '', plan_id: '', notes: '' })
      setShowAssignPlan(false)
      await loadData()
    } catch (err) {
      alert('Error al asignar plan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateOrder() {
    if (!orderForm.plan_id || !orderForm.profile_id) return
    setSaving(true)
    try {
      const selectedPlan = plans.find(p => p.id === orderForm.plan_id)
      const { error } = await supabase.from('checkout_orders').insert({
        profile_id: orderForm.profile_id,
        plan_id: orderForm.plan_id,
        product_line: selectedPlan?.product_line || null,
        price_mxn: orderForm.amount ? Number(orderForm.amount) : (selectedPlan?.price_mxn || 0),
        status: 'pending',
        notes: orderForm.notes || null,
      })
      if (error) throw error
      setOrderForm({ profile_id: '', plan_id: '', amount: '', notes: '' })
      setShowCreateOrder(false)
    } catch (err) {
      alert('Error al crear orden: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function exportCSV() {
    const headers = ['Usuario', 'Email', 'Plan', 'Producto', 'Precio MXN', 'Estado', 'Desde']
    const rows = filtered.map(s => [
      s.profiles?.full_name || '',
      s.profiles?.email || '',
      s.plans?.name || '',
      s.plans?.product_line || '',
      s.plans?.price_mxn || 0,
      s.status,
      s.created_at ? new Date(s.created_at).toLocaleDateString('es-MX') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `suscripciones_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Group plans by product_line for selects ───────────────────
  const plansByLine = plans.reduce((acc, plan) => {
    const line = plan.product_line || 'General'
    if (!acc[line]) acc[line] = []
    acc[line].push(plan)
    return acc
  }, {})

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <CreditCard size={24} className="text-primary" />
          <h1 className="text-2xl font-display font-bold gradient-text">Suscripciones</h1>
        </div>
        <p className="text-gray-400 text-sm">Analisis y gestion de suscripciones de la plataforma</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <>
          {/* ── KPI Cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard
              index={0}
              icon={CreditCard}
              label="Suscripciones activas"
              value={totalActive}
              gradient="from-primary/20 to-primary/5"
              iconColor="text-primary"
            />
            <KpiCard
              index={1}
              icon={TrendingUp}
              label="Revenue mensual estimado"
              value={`$${monthlyRevenue.toLocaleString('es-MX')} MXN`}
              gradient="from-green-500/20 to-green-500/5"
              iconColor="text-green-400"
            />
            <KpiCard
              index={2}
              icon={Briefcase}
              label="Revenue por vacante"
              value={`$${vacancyRevenue.toLocaleString('es-MX')} MXN`}
              gradient="from-cyan-500/20 to-cyan-500/5"
              iconColor="text-cyan-400"
            />
            <KpiCard
              index={3}
              icon={CalendarPlus}
              label="Nuevas este mes"
              value={newThisMonth}
              gradient="from-violet-500/20 to-violet-500/5"
              iconColor="text-violet-400"
            />
          </div>

          {/* ── Charts Section ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Count by product line */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="glass rounded-xl p-5"
            >
              <h3 className="text-sm font-display font-semibold text-white mb-4">Distribucion por producto</h3>
              <div className="space-y-3">
                {countByLine.map(pl => (
                  <div key={pl.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{pl.label}</span>
                      <span className="text-xs font-bold text-white">{pl.count}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(pl.count / maxCount) * 100}%` }}
                        transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
                        className={`h-full rounded-full ${pl.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Revenue by product line */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="glass rounded-xl p-5"
            >
              <h3 className="text-sm font-display font-semibold text-white mb-4">Revenue por producto</h3>
              <div className="space-y-3">
                {revenueByLine.map(pl => (
                  <div key={pl.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{pl.label}</span>
                      <span className="text-xs font-bold text-white">${pl.total.toLocaleString('es-MX')}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(pl.total / maxRevenue) * 100}%` }}
                        transition={{ delay: 0.6, duration: 0.6, ease: 'easeOut' }}
                        className={`h-full rounded-full ${pl.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Quick Actions + Filters ───────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4"
          >
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  className="pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white placeholder-gray-500 text-sm w-56"
                  placeholder="Buscar por nombre..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-primary/50 appearance-none cursor-pointer"
                value={filterProduct}
                onChange={e => setFilterProduct(e.target.value)}
              >
                <option value="">Todos los productos</option>
                {PRODUCT_LINES.map(pl => (
                  <option key={pl.id} value={pl.id}>{pl.label}</option>
                ))}
              </select>
              <select
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-primary/50 appearance-none cursor-pointer"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <select
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-primary/50 appearance-none cursor-pointer"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="created_at">Ordenar: Fecha</option>
                <option value="plan">Ordenar: Plan</option>
                <option value="price">Ordenar: Precio</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setShowAssignPlan(true)} className={btnPrimary}>
                <Plus size={16} />
                Asignar plan
              </button>
              <button
                onClick={() => setShowCreateOrder(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
              >
                <FileText size={16} />
                Crear orden manual
              </button>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
              >
                <Download size={16} />
                Exportar CSV
              </button>
            </div>
          </motion.div>

          {/* ── Subscriptions Table ───────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="glass rounded-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Usuario</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Plan</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Producto</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Precio</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Desde</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sub => (
                    <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-white text-sm font-medium">{sub.profiles?.full_name || '-'}</div>
                        <div className="text-gray-500 text-xs">{sub.profiles?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-white text-sm">{sub.plans?.name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">{sub.plans?.product_line || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-white text-sm font-medium">
                        {sub.plans?.price_mxn != null ? `$${Number(sub.plans.price_mxn).toLocaleString('es-MX')}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[sub.status] || 'bg-white/10 text-gray-400 border-white/10'}`}>
                          {STATUS_LABELS[sub.status] || sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {sub.created_at ? new Date(sub.created_at).toLocaleDateString('es-MX') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {sub.status === 'active' && (
                            <button
                              onClick={() => updateSubStatus(sub.id, 'paused')}
                              className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-gray-400 hover:text-yellow-400 transition-colors"
                              title="Pausar"
                            >
                              <Pause size={14} />
                            </button>
                          )}
                          {sub.status === 'paused' && (
                            <button
                              onClick={() => updateSubStatus(sub.id, 'active')}
                              className="p-1.5 rounded-lg hover:bg-green-500/10 text-gray-400 hover:text-green-400 transition-colors"
                              title="Reactivar"
                            >
                              <Play size={14} />
                            </button>
                          )}
                          {sub.status !== 'cancelled' && (
                            <button
                              onClick={() => updateSubStatus(sub.id, 'cancelled')}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                              title="Cancelar"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                          {sub.status === 'cancelled' && (
                            <button
                              onClick={() => updateSubStatus(sub.id, 'active')}
                              className="p-1.5 rounded-lg hover:bg-green-500/10 text-gray-400 hover:text-green-400 transition-colors"
                              title="Reactivar"
                            >
                              <Play size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        No se encontraron suscripciones con los filtros seleccionados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-white/5 text-xs text-gray-500">
              Mostrando {filtered.length} de {subscriptions.length} suscripciones
            </div>
          </motion.div>
        </>
      )}

      {/* ── Modal: Asignar Plan ───────────────────────────────── */}
      <Modal open={showAssignPlan} onClose={() => setShowAssignPlan(false)} title="Asignar Plan">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Usuario *</label>
            <select className={inputClass} value={planForm.profile_id} onChange={e => setPlanForm({ ...planForm, profile_id: e.target.value })}>
              <option value="">-- Seleccionar usuario --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Plan *</label>
            <select className={inputClass} value={planForm.plan_id} onChange={e => setPlanForm({ ...planForm, plan_id: e.target.value })}>
              <option value="">-- Seleccionar plan --</option>
              {Object.entries(plansByLine).map(([line, linePlans]) => (
                <optgroup key={line} label={line}>
                  {linePlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ${p.price_mxn?.toLocaleString('es-MX')} MXN</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={inputClass + ' resize-none'} rows={2} placeholder="Notas internas..." value={planForm.notes} onChange={e => setPlanForm({ ...planForm, notes: e.target.value })} />
          </div>
          <button onClick={handleAssignPlan} disabled={saving || !planForm.plan_id || !planForm.profile_id} className={btnPrimary + ' w-full justify-center'}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Asignar Plan
          </button>
        </div>
      </Modal>

      {/* ── Modal: Crear Orden Manual ─────────────────────────── */}
      <Modal open={showCreateOrder} onClose={() => setShowCreateOrder(false)} title="Crear Orden Manual">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Usuario *</label>
            <select className={inputClass} value={orderForm.profile_id} onChange={e => setOrderForm({ ...orderForm, profile_id: e.target.value })}>
              <option value="">-- Seleccionar usuario --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Plan *</label>
            <select className={inputClass} value={orderForm.plan_id} onChange={e => setOrderForm({ ...orderForm, plan_id: e.target.value })}>
              <option value="">-- Seleccionar plan --</option>
              {Object.entries(plansByLine).map(([line, linePlans]) => (
                <optgroup key={line} label={line}>
                  {linePlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ${p.price_mxn?.toLocaleString('es-MX')} MXN</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Monto personalizado (MXN)</label>
            <input type="number" className={inputClass} placeholder="Dejar vacio para usar precio del plan" value={orderForm.amount} onChange={e => setOrderForm({ ...orderForm, amount: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={inputClass + ' resize-none'} rows={2} placeholder="Notas internas..." value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} />
          </div>
          <button onClick={handleCreateOrder} disabled={saving || !orderForm.plan_id || !orderForm.profile_id} className={btnPrimary + ' w-full justify-center'}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            Crear Orden
          </button>
        </div>
      </Modal>
    </div>
  )
}
