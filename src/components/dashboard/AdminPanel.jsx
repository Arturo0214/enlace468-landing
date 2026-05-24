import { useState, useEffect } from 'react'
import { Building2, Users, Crown, Plus, Save, Package, Loader2, Shield, X, Calendar, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
const labelClass = "block text-sm font-medium text-gray-400 mb-1"
const btnPrimary = "flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-medium transition-colors disabled:opacity-50"
const btnSecondary = "flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"

const TABS = [
  { id: 'organizations', label: 'Organizaciones', icon: Building2 },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'plans', label: 'Planes y Suscripciones', icon: Package },
]

const ROLES = ['super_admin', 'admin', 'recruiter']
const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', recruiter: 'Reclutador' }
const SUB_STATUSES = ['active', 'paused', 'cancelled']
const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  cancelled: 'bg-red-500/20 text-red-400',
  trialing: 'bg-blue-500/20 text-blue-400',
}

// ── Modal wrapper ──────────────────────────────────────────────────
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

// ── Main component ─────────────────────────────────────────────────
export default function AdminPanel() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('organizations')
  const [loading, setLoading] = useState(true)

  // Data
  const [organizations, setOrganizations] = useState([])
  const [profiles, setProfiles] = useState([])
  const [plans, setPlans] = useState([])
  const [subscriptions, setSubscriptions] = useState([])

  // Modals
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showAssignPlan, setShowAssignPlan] = useState(false)

  // Forms
  const [orgForm, setOrgForm] = useState({ name: '', slug: '' })
  const [userForm, setUserForm] = useState({ email: '', full_name: '', organization_id: '', role: 'recruiter' })
  const [planForm, setPlanForm] = useState({ organization_id: '', profile_id: '', plan_id: '', status: 'active', notes: '', expires_at: '' })

  const [saving, setSaving] = useState(false)

  const isSuperAdmin = profile?.role === 'super_admin'

  // ── Data loading (must be before any early returns per Rules of Hooks)
  useEffect(() => {
    if (isSuperAdmin) loadAllData()
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

  async function loadAllData() {
    setLoading(true)
    try {
      const [orgsRes, profilesRes, plansRes, subsRes] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*, organizations(name)').order('created_at', { ascending: false }),
        supabase.from('plans').select('*').order('product_line, name'),
        supabase.from('subscriptions').select('*, plans(name, product_line), organizations(name), profiles(full_name, email)').order('created_at', { ascending: false }),
      ])
      setOrganizations(orgsRes.data || [])
      setProfiles(profilesRes.data || [])
      setPlans(plansRes.data || [])
      setSubscriptions(subsRes.data || [])
    } catch (err) {
      console.error('Error loading admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Org member counts ──────────────────────────────────────────
  function getMemberCount(orgId) {
    return profiles.filter(p => p.organization_id === orgId).length
  }

  function getActiveSubCount(orgId) {
    return subscriptions.filter(s => s.organization_id === orgId && s.status === 'active').length
  }

  // ── Create organization ────────────────────────────────────────
  async function handleCreateOrg() {
    if (!orgForm.name.trim()) return
    setSaving(true)
    try {
      const slug = orgForm.slug.trim() || orgForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const { error } = await supabase.from('organizations').insert({ name: orgForm.name.trim(), slug })
      if (error) throw error
      setOrgForm({ name: '', slug: '' })
      setShowCreateOrg(false)
      await loadAllData()
    } catch (err) {
      alert('Error al crear organizacion: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Create user profile ────────────────────────────────────────
  async function handleCreateUser() {
    if (!userForm.email.trim() || !userForm.full_name.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').insert({
        email: userForm.email.trim().toLowerCase(),
        full_name: userForm.full_name.trim(),
        organization_id: userForm.organization_id || null,
        role: userForm.role,
      })
      if (error) throw error
      setUserForm({ email: '', full_name: '', organization_id: '', role: 'recruiter' })
      setShowCreateUser(false)
      await loadAllData()
    } catch (err) {
      alert('Error al crear usuario: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Update user inline ─────────────────────────────────────────
  async function updateProfile(id, field, value) {
    try {
      const { error } = await supabase.from('profiles').update({ [field]: value || null }).eq('id', id)
      if (error) throw error
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, [field]: value || null } : p))
      if (field === 'organization_id') {
        const org = organizations.find(o => o.id === value)
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, organizations: org ? { name: org.name } : null } : p))
      }
    } catch (err) {
      alert('Error al actualizar: ' + err.message)
    }
  }

  // ── Assign plan ────────────────────────────────────────────────
  async function handleAssignPlan() {
    if (!planForm.plan_id || (!planForm.organization_id && !planForm.profile_id)) return
    setSaving(true)
    try {
      const payload = {
        plan_id: planForm.plan_id,
        status: planForm.status,
        notes: planForm.notes || null,
        expires_at: planForm.expires_at || null,
        organization_id: planForm.organization_id || null,
        profile_id: planForm.profile_id || null,
      }
      const { error } = await supabase.from('subscriptions').insert(payload)
      if (error) throw error
      setPlanForm({ organization_id: '', profile_id: '', plan_id: '', status: 'active', notes: '', expires_at: '' })
      setShowAssignPlan(false)
      await loadAllData()
    } catch (err) {
      alert('Error al asignar plan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Group plans by product_line ────────────────────────────────
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
          <Crown size={24} className="text-gold" />
          <h1 className="text-2xl font-display font-bold gradient-text">Panel de Administracion</h1>
        </div>
        <p className="text-gray-400 text-sm">Gestiona organizaciones, usuarios y suscripciones de la plataforma</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === id
                ? 'bg-primary/20 text-primary'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <>
          {activeTab === 'organizations' && renderOrganizations()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'plans' && renderPlans()}
        </>
      )}

      {/* ── Modals ────────────────────────────────────────────── */}
      <Modal open={showCreateOrg} onClose={() => setShowCreateOrg(false)} title="Nueva Organizacion">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input className={inputClass} placeholder="Nombre de la organizacion" value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Slug (URL)</label>
            <input className={inputClass} placeholder="mi-organizacion (auto-generado si vacio)" value={orgForm.slug} onChange={e => setOrgForm({ ...orgForm, slug: e.target.value })} />
          </div>
          <button onClick={handleCreateOrg} disabled={saving || !orgForm.name.trim()} className={btnPrimary + ' w-full justify-center'}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Crear Organizacion
          </button>
        </div>
      </Modal>

      <Modal open={showCreateUser} onClose={() => setShowCreateUser(false)} title="Pre-registrar Usuario">
        <p className="text-xs text-gray-500 mb-4">
          Esto crea un perfil pre-registrado. Cuando el usuario inicie sesion con Google OAuth, se le asignara esta organizacion y rol automaticamente.
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Email *</label>
            <input type="email" className={inputClass} placeholder="usuario@empresa.com" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Nombre completo *</label>
            <input className={inputClass} placeholder="Nombre Apellido" value={userForm.full_name} onChange={e => setUserForm({ ...userForm, full_name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Organizacion</label>
            <select className={inputClass} value={userForm.organization_id} onChange={e => setUserForm({ ...userForm, organization_id: e.target.value })}>
              <option value="">Sin organizacion</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Rol</label>
            <select className={inputClass} value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button onClick={handleCreateUser} disabled={saving || !userForm.email.trim() || !userForm.full_name.trim()} className={btnPrimary + ' w-full justify-center'}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Crear Usuario
          </button>
        </div>
      </Modal>

      <Modal open={showAssignPlan} onClose={() => setShowAssignPlan(false)} title="Asignar Plan">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Organizacion</label>
            <select className={inputClass} value={planForm.organization_id} onChange={e => setPlanForm({ ...planForm, organization_id: e.target.value, profile_id: '' })}>
              <option value="">-- Seleccionar organizacion --</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500 uppercase">o</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div>
            <label className={labelClass}>Usuario individual</label>
            <select className={inputClass} value={planForm.profile_id} onChange={e => setPlanForm({ ...planForm, profile_id: e.target.value, organization_id: '' })}>
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
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Estado</label>
              <select className={inputClass} value={planForm.status} onChange={e => setPlanForm({ ...planForm, status: e.target.value })}>
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Expira</label>
              <input type="date" className={inputClass} value={planForm.expires_at} onChange={e => setPlanForm({ ...planForm, expires_at: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea className={inputClass + ' resize-none'} rows={2} placeholder="Notas internas..." value={planForm.notes} onChange={e => setPlanForm({ ...planForm, notes: e.target.value })} />
          </div>
          <button onClick={handleAssignPlan} disabled={saving || !planForm.plan_id || (!planForm.organization_id && !planForm.profile_id)} className={btnPrimary + ' w-full justify-center'}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Asignar Plan
          </button>
        </div>
      </Modal>
    </div>
  )

  // ── Tab: Organizations ─────────────────────────────────────────
  function renderOrganizations() {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold text-white">
            {organizations.length} organizacion{organizations.length !== 1 ? 'es' : ''}
          </h2>
          <button onClick={() => setShowCreateOrg(true)} className={btnPrimary}>
            <Plus size={16} />
            Nueva Organizacion
          </button>
        </div>

        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Organizacion</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Slug</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Miembros</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Suscripciones activas</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Creada</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map(org => (
                  <tr key={org.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-primary" />
                        <span className="text-white font-medium">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{org.slug}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white text-xs">
                        <Users size={12} />
                        {getMemberCount(org.id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                        {getActiveSubCount(org.id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {org.created_at ? new Date(org.created_at).toLocaleDateString('es-MX') : '-'}
                    </td>
                  </tr>
                ))}
                {organizations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No hay organizaciones registradas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Users ─────────────────────────────────────────────────
  function renderUsers() {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold text-white">
            {profiles.length} usuario{profiles.length !== 1 ? 's' : ''}
          </h2>
          <button onClick={() => setShowCreateUser(true)} className={btnPrimary}>
            <Plus size={16} />
            Crear Usuario
          </button>
        </div>

        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Organizacion</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Rol</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{p.full_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.email}</td>
                    <td className="px-4 py-2">
                      <select
                        className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-primary/50"
                        value={p.organization_id || ''}
                        onChange={e => updateProfile(p.id, 'organization_id', e.target.value)}
                      >
                        <option value="">Sin org</option>
                        {organizations.map(org => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-primary/50"
                        value={p.role || 'recruiter'}
                        onChange={e => updateProfile(p.id, 'role', e.target.value)}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No hay usuarios registrados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Plans & Subscriptions ─────────────────────────────────
  function renderPlans() {
    return (
      <div className="space-y-8">
        {/* Plans grid */}
        <div>
          <h2 className="text-lg font-display font-semibold text-white mb-4">Planes disponibles</h2>
          {Object.entries(plansByLine).map(([line, linePlans]) => (
            <div key={line} className="mb-6">
              <h3 className="text-sm font-medium text-primary mb-3 flex items-center gap-2">
                <Package size={14} />
                {line}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {linePlans.map(plan => (
                  <div key={plan.id} className="glass rounded-xl p-4 hover:scale-[1.02] transition-transform">
                    <h4 className="text-white font-medium text-sm">{plan.name}</h4>
                    {plan.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{plan.description}</p>}
                    {plan.price != null && (
                      <div className="mt-2 text-primary font-bold text-lg">
                        ${Number(plan.price).toLocaleString('es-MX')}
                        {plan.interval && <span className="text-xs text-gray-500 font-normal"> / {plan.interval}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <div className="glass rounded-xl p-8 text-center text-gray-500">No hay planes configurados</div>
          )}
        </div>

        {/* Subscriptions list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-white">
              Suscripciones ({subscriptions.length})
            </h2>
            <button onClick={() => setShowAssignPlan(true)} className={btnPrimary}>
              <Plus size={16} />
              Asignar Plan
            </button>
          </div>

          <div className="glass rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Org / Usuario</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Plan</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Inicio</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Expira</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map(sub => (
                    <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-white text-sm font-medium">
                          {sub.organizations?.name || sub.profiles?.full_name || '-'}
                        </div>
                        {sub.profiles?.email && !sub.organizations && (
                          <div className="text-gray-500 text-xs">{sub.profiles.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white text-sm">{sub.plans?.name || '-'}</div>
                        <div className="text-gray-500 text-xs">{sub.plans?.product_line}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-white/10 text-gray-400'}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {sub.created_at ? new Date(sub.created_at).toLocaleDateString('es-MX') : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs flex items-center gap-1">
                        {sub.expires_at ? (
                          <>
                            <Calendar size={12} />
                            {new Date(sub.expires_at).toLocaleDateString('es-MX')}
                          </>
                        ) : (
                          <span className="text-gray-600">Sin expiracion</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {subscriptions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No hay suscripciones registradas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
