import { useState, useEffect } from 'react'
import { Save, Building2, User, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
const labelClass = "block text-sm font-medium text-gray-400 mb-1"

export default function SettingsPage() {
  const { profile, session } = useAuth()
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

  useEffect(() => {
    if (profile) {
      setProfileForm({ full_name: profile.full_name || '', email: profile.email || '', phone: profile.phone || '' })
      if (profile.organizations) {
        setOrgForm({ name: profile.organizations.name || '', logo_url: profile.organizations.logo_url || '' })
      }
      loadMembers()
    }
  }, [profile])

  async function loadMembers() {
    const { data } = await supabase.from('profiles').select('*').eq('organization_id', profile.organization_id).order('created_at')
    setMembers(data || [])
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
    } catch (err) { alert('Error: ' + err.message) }
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
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  const tabs = [
    { id: 'profile', label: 'Mi perfil', icon: User },
    { id: 'org', label: 'Organizacion', icon: Building2 },
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
