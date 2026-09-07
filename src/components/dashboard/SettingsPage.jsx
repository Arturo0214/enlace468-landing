import { useState, useEffect } from 'react'
import { Save, Building2, User, Shield, Package, Crown, ListOrdered, RotateCcw, Timer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { DEFAULT_STAGE_LABELS, STAGE_KEYS, setCachedStageLabels } from '../../lib/stageLabels'
import { useStageLabels } from '../../lib/useStageLabels'

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
const labelClass = "block text-sm font-medium text-gray-400 mb-1"

// ── SLAs por etapa (FASE 6) ──
// Etapas con SLA (hired/rejected son terminales, sin límite) y días default —
// espejo del seed de la migración 20260908020000_sla_notifications.sql.
const SLA_STAGES = ['sourced', 'contacted', 'screening', 'interviewing', 'evaluated', 'presented', 'shortlist', 'offer']
const DEFAULT_SLA_DAYS = { sourced: 5, contacted: 3, screening: 5, interviewing: 7, evaluated: 3, presented: 7, shortlist: 5, offer: 5 }

/** ¿El error es "la tabla no existe"? (42P01 = Postgres, PGRST205 = PostgREST) */
function isMissingTable(error) {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /does not exist|could not find the table/i.test(error.message || '')
}

export default function SettingsPage() {
  const { profile, session } = useAuth()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [profileForm, setProfileForm] = useState({
    full_name: '', email: '', phone: '',
  })

  const [orgForm, setOrgForm] = useState({
    name: '', logo_url: '',
  })

  const [members, setMembers] = useState([])
  const [subscriptions, setSubscriptions] = useState([])

  // ── Etapas del proceso (solo admin/super_admin) ──
  // Los stages internos (sourced, contacted…) no cambian en BD; aquí se editan
  // las etiquetas visibles, guardadas en organizations.settings.stage_labels.
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  const { labels: orgStageLabels, loading: stageLabelsLoading } = useStageLabels()
  const [stageForm, setStageForm] = useState(null)
  const [savingStages, setSavingStages] = useState(false)
  const [stagesSaved, setStagesSaved] = useState(false)
  const [stagesError, setStagesError] = useState(null)
  // Antes de que el usuario edite, el formulario muestra las etiquetas
  // actuales de la org (derivado — sin setState en effect).
  const stageFormValues = stageForm ?? (stageLabelsLoading ? null : orgStageLabels)

  async function saveStageLabels() {
    setSavingStages(true)
    setStagesError(null)
    try {
      // Solo guardamos los overrides (etiqueta distinta al default y no vacía).
      const overrides = {}
      for (const key of STAGE_KEYS) {
        const v = (stageFormValues?.[key] || '').trim()
        if (v && v !== DEFAULT_STAGE_LABELS[key]) overrides[key] = v
      }
      // Merge sobre settings FRESCOS para no pisar otras keys del jsonb.
      const { data: org, error: readError } = await supabase
        .from('organizations').select('settings').eq('id', profile.organization_id).single()
      if (readError) throw readError
      const newSettings = { ...(org?.settings || {}), stage_labels: overrides }
      const { error: updateError } = await supabase
        .from('organizations').update({ settings: newSettings }).eq('id', profile.organization_id)
      if (updateError) throw updateError
      // Refresca el cache module-level → todos los componentes montados se enteran.
      setCachedStageLabels(profile.organization_id, overrides)
      setStagesSaved(true)
      setTimeout(() => setStagesSaved(false), 2000)
    } catch (err) {
      setStagesError(err.message || 'No se pudo guardar')
    } finally {
      setSavingStages(false)
    }
  }

  // ── SLAs por etapa (solo admin/super_admin) ──
  // slaForm: map stage → { max_days, is_active }; null = cargando.
  // slaMissing: la tabla sla_rules no existe en prod (migración pendiente).
  const [slaForm, setSlaForm] = useState(null)
  const [slaMissing, setSlaMissing] = useState(false)
  const [savingSla, setSavingSla] = useState(false)
  const [slaSaved, setSlaSaved] = useState(false)
  const [slaError, setSlaError] = useState(null)

  async function loadSlaRules() {
    const { data, error } = await supabase
      .from('sla_rules')
      .select('stage, max_days, is_active')
      .eq('organization_id', profile.organization_id)
    if (error) {
      if (isMissingTable(error)) setSlaMissing(true)
      else setSlaError(error.message)
      return
    }
    const byStage = {}
    for (const r of data || []) byStage[r.stage] = r
    const form = {}
    for (const stage of SLA_STAGES) {
      // Sin fila para la etapa (org creada antes del seed) → default editable.
      form[stage] = {
        max_days: byStage[stage]?.max_days ?? DEFAULT_SLA_DAYS[stage],
        is_active: byStage[stage]?.is_active ?? true,
      }
    }
    setSlaForm(form)
  }

  async function saveSlaRules() {
    setSavingSla(true)
    setSlaError(null)
    try {
      const rows = SLA_STAGES.map(stage => {
        const days = parseInt(slaForm[stage]?.max_days, 10)
        if (!Number.isFinite(days) || days < 1) throw new Error(`"${orgStageLabels[stage] || stage}" necesita un límite de al menos 1 día`)
        return {
          organization_id: profile.organization_id,
          stage,
          max_days: days,
          is_active: !!slaForm[stage].is_active,
          updated_at: new Date().toISOString(),
        }
      })
      const { error } = await supabase
        .from('sla_rules')
        .upsert(rows, { onConflict: 'organization_id,stage' })
      if (error) throw error
      setSlaSaved(true)
      setTimeout(() => setSlaSaved(false), 2000)
    } catch (err) {
      setSlaError(err.message || 'No se pudo guardar')
    } finally {
      setSavingSla(false)
    }
  }

  useEffect(() => {
    if (profile) {
      setProfileForm({ full_name: profile.full_name || '', email: profile.email || '', phone: profile.phone || '' })
      if (profile.organizations) {
        setOrgForm({ name: profile.organizations.name || '', logo_url: profile.organizations.logo_url || '' })
      }
      loadMembers()
      loadSubscriptions()
      if (profile.role === 'admin' || profile.role === 'super_admin') loadSlaRules()
    }
  }, [profile])

  async function loadMembers() {
    const { data } = await supabase.from('profiles').select('*').eq('organization_id', profile.organization_id).order('created_at')
    setMembers(data || [])
  }

  async function loadSubscriptions() {
    const { data } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .or(`organization_id.eq.${profile.organization_id},profile_id.eq.${profile.id}`)
      .eq('status', 'active')
    setSubscriptions(data || [])
  }

  async function saveProfile() {
    setSaving(true)
    try {
      await supabase.from('profiles').update({
        full_name: profileForm.full_name,
        phone: profileForm.phone || null,
      }).eq('id', profile.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  async function saveOrg() {
    setSaving(true)
    try {
      await supabase.from('organizations').update({
        name: orgForm.name,
        logo_url: orgForm.logo_url || null,
      }).eq('id', profile.organization_id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  const tabs = [
    { id: 'profile', label: 'Mi perfil', icon: User },
    { id: 'plan', label: 'Mi plan', icon: Package },
    { id: 'org', label: 'Organizacion', icon: Building2 },
    ...(isAdmin ? [{ id: 'stages', label: 'Etapas', icon: ListOrdered }] : []),
    ...(isAdmin ? [{ id: 'sla', label: 'SLAs', icon: Timer }] : []),
    { id: 'team', label: 'Equipo', icon: Shield },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-white mb-6">Configuracion</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === id ? 'border-primary text-primary-light' : 'border-transparent text-gray-400 hover:text-white'
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <div className="glass-strong rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-4 mb-6">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-white text-2xl font-bold">
                {profileForm.full_name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">{profileForm.full_name}</h2>
              <p className="text-sm text-gray-400">{profileForm.email}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary-light font-medium mt-1 inline-block">{profile?.role}</span>
            </div>
          </div>

          <div>
            <label className={labelClass}>Nombre completo</label>
            <input type="text" value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={profileForm.email} disabled className={inputClass + ' opacity-50 cursor-not-allowed'} />
            <p className="text-xs text-gray-500 mt-1">El email no se puede cambiar</p>
          </div>
          <div>
            <label className={labelClass}>Telefono</label>
            <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} placeholder="55 1234 5678" className={inputClass} />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90">
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saved && <span className="text-sm text-green-400">Guardado</span>}
          </div>
        </div>
      )}

      {/* Plan */}
      {activeTab === 'plan' && (
        <div className="glass-strong rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
              <Crown size={20} className="text-accent" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-white">Plan activo</h2>
              <p className="text-sm text-gray-400">Planes y suscripciones de tu cuenta</p>
            </div>
          </div>

          {subscriptions.length === 0 ? (
            <div className="text-center py-8">
              <Package size={40} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 mb-1">Sin plan activo</p>
              <p className="text-sm text-gray-500">Contacta a tu administrador para activar un plan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map(sub => (
                <div key={sub.id} className="glass rounded-xl p-5 border border-accent/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-white text-lg">{sub.plans?.name}</h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-green-500/15 text-green-400 font-medium">Activo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Precio</p>
                      <p className="text-white font-semibold">
                        ${sub.plans?.price_mxn?.toLocaleString()} MXN
                        <span className="text-gray-400 text-sm font-normal ml-1">
                          /{sub.plans?.billing_cycle === 'monthly' ? 'mes' : sub.plans?.billing_cycle === 'per_vacancy' ? 'vacante' : 'pago unico'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Desde</p>
                      <p className="text-white text-sm">{new Date(sub.started_at).toLocaleDateString('es-MX')}</p>
                    </div>
                  </div>
                  {sub.plans?.features && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Incluye:</p>
                      <ul className="space-y-1.5">
                        {(typeof sub.plans.features === 'string' ? JSON.parse(sub.plans.features) : sub.plans.features).map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                            <div className="w-4 h-4 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent"><path d="M20 6L9 17l-5-5"/></svg>
                            </div>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sub.expires_at && (
                    <p className="text-xs text-gray-500 mt-3">Expira: {new Date(sub.expires_at).toLocaleDateString('es-MX')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Organization */}
      {activeTab === 'org' && (
        <div className="glass-strong rounded-2xl p-6 space-y-4">
          <div>
            <label className={labelClass}>Nombre de la organizacion</label>
            <input type="text" value={orgForm.name} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>URL del logo</label>
            <input type="url" value={orgForm.logo_url} onChange={e => setOrgForm(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." className={inputClass} />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button onClick={saveOrg} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90">
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saved && <span className="text-sm text-green-400">Guardado</span>}
          </div>
        </div>
      )}

      {/* Etapas del proceso */}
      {activeTab === 'stages' && isAdmin && (
        <div className="glass-strong rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <ListOrdered size={20} className="text-primary-light" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-white">Etapas del proceso</h2>
              <p className="text-sm text-gray-400">Personaliza como se llama cada etapa del journey en toda la plataforma</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-5 mt-3">
            Los nombres aplican para toda tu organizacion (kanban, reportes, campanas). El orden y la logica del proceso no cambian.
          </p>

          {stageFormValues == null ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {STAGE_KEYS.map((key, i) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary-light flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="w-28 text-xs text-gray-500 font-mono flex-shrink-0" title="Nombre interno (no cambia)">{key}</span>
                    <input
                      type="text"
                      value={stageFormValues[key] ?? ''}
                      onChange={e => setStageForm({ ...stageFormValues, [key]: e.target.value })}
                      placeholder={DEFAULT_STAGE_LABELS[key]}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>

              {stagesError && (
                <p className="text-sm text-red-400 mt-4">Error al guardar: {stagesError}</p>
              )}

              <div className="flex items-center gap-3 pt-5">
                <button onClick={saveStageLabels} disabled={savingStages}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90">
                  <Save size={16} /> {savingStages ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button onClick={() => setStageForm({ ...DEFAULT_STAGE_LABELS })} disabled={savingStages}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50">
                  <RotateCcw size={14} /> Restaurar nombres sugeridos
                </button>
                {stagesSaved && <span className="text-sm text-green-400">Guardado</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* SLAs por etapa */}
      {activeTab === 'sla' && isAdmin && (
        <div className="glass-strong rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Timer size={20} className="text-primary-light" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-white">SLAs por etapa</h2>
              <p className="text-sm text-gray-400">Días máximos que un candidato puede llevar en cada etapa antes de alertar</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-5 mt-3">
            Cada mañana (L-V, 7:30am) el sistema revisa el pipeline: los candidatos que exceden el límite de su etapa generan una notificación en la campana y un email resumen. Un candidato atorado se re-alerta cada 72 horas como máximo.
          </p>

          {slaMissing ? (
            <div className="rounded-xl p-4 text-sm text-amber-300" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              La tabla de SLAs no existe todavía en la base de datos — aplica la migración <code className="font-mono text-xs">20260908020000_sla_notifications.sql</code> para activar esta sección.
            </div>
          ) : slaForm == null ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 px-1 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                  <span className="flex-1">Etapa</span>
                  <span className="w-28 text-center">Días máximos</span>
                  <span className="w-16 text-center">Activa</span>
                </div>
                {SLA_STAGES.map((stage, i) => {
                  const row = slaForm[stage]
                  return (
                    <div key={stage} className={`flex items-center gap-3 rounded-lg px-1 py-1 ${row.is_active ? '' : 'opacity-50'}`}>
                      <span className="w-6 h-6 rounded bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary-light flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-white truncate">{orgStageLabels[stage] || stage}</span>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={row.max_days}
                        disabled={!row.is_active}
                        onChange={e => setSlaForm(f => ({ ...f, [stage]: { ...f[stage], max_days: e.target.value } }))}
                        className={inputClass + ' !w-28 text-center disabled:cursor-not-allowed'}
                      />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.is_active}
                        aria-label={`SLA de ${orgStageLabels[stage] || stage} ${row.is_active ? 'activo' : 'inactivo'}`}
                        onClick={() => setSlaForm(f => ({ ...f, [stage]: { ...f[stage], is_active: !f[stage].is_active } }))}
                        className={`w-16 flex justify-center flex-shrink-0`}
                      >
                        <span className={`w-9 h-5 rounded-full relative transition-colors ${row.is_active ? 'bg-accent' : 'bg-white/10'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${row.is_active ? 'left-[18px]' : 'left-0.5'}`} />
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>

              {slaError && (
                <p className="text-sm text-red-400 mt-4">Error al guardar: {slaError}</p>
              )}

              <div className="flex items-center gap-3 pt-5">
                <button onClick={saveSlaRules} disabled={savingSla}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90">
                  <Save size={16} /> {savingSla ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => setSlaForm(Object.fromEntries(SLA_STAGES.map(s => [s, { max_days: DEFAULT_SLA_DAYS[s], is_active: true }])))}
                  disabled={savingSla}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50">
                  <RotateCcw size={14} /> Restaurar sugeridos
                </button>
                {slaSaved && <span className="text-sm text-green-400">Guardado</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Team */}
      {activeTab === 'team' && (
        <div className="glass-strong rounded-2xl">
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="font-display font-semibold text-white">Miembros del equipo ({members.length})</h2>
          </div>
          {members.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No hay miembros.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {members.map(member => (
                <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-gray-300 font-bold">
                        {member.full_name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-white">{member.full_name}</div>
                      <div className="text-xs text-gray-400">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      member.role === 'admin' ? 'bg-primary/20 text-primary-light' : 'bg-white/5 text-gray-400'
                    }`}>
                      {member.role === 'admin' ? 'Admin' : 'Reclutador'}
                    </span>
                    {member.id === profile?.id && (
                      <span className="text-xs text-gray-500">(tu)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
