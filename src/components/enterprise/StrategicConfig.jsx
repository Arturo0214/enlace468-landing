import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, Building2, Users, FileText, Clock, Image,
  Bell, Save, Plus, Trash2, Edit2, Check, X, Shield, Star
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

/* ───── TABS ───── */
const TABS = [
  { id: 'org', label: 'Organizacion', icon: Building2 },
  { id: 'team', label: 'Equipo', icon: Users },
  { id: 'scoring', label: 'Scorecards', icon: FileText },
  { id: 'sla', label: 'SLAs', icon: Clock },
  { id: 'branding', label: 'Branding', icon: Image },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
]

/* ───── DEFAULT DATA ───── */

const DEFAULT_ORG = {
  name: '',
  industry: '',
  size: '',
  website: '',
  description: '',
}

const DEFAULT_TEAM = [
  { id: 1, name: 'Maria Lopez', email: 'maria@empresa.com', role: 'recruiter_lead', active: true },
  { id: 2, name: 'Carlos Ruiz', email: 'carlos@empresa.com', role: 'recruiter', active: true },
  { id: 3, name: 'Ana Torres', email: 'ana@empresa.com', role: 'recruiter', active: true },
]

const ROLE_LABELS = {
  admin: 'Administrador',
  recruiter_lead: 'Recruiter Lead',
  recruiter: 'Recruiter',
  viewer: 'Solo lectura',
}

const DEFAULT_SCORECARDS = [
  {
    id: 1,
    name: 'Tecnologia / Ingenieria',
    competencies: [
      'Habilidad tecnica',
      'Resolucion de problemas',
      'Trabajo en equipo',
      'Comunicacion',
      'Capacidad de aprendizaje',
    ],
  },
  {
    id: 2,
    name: 'Comercial / Ventas',
    competencies: [
      'Orientacion a resultados',
      'Negociacion',
      'Comunicacion persuasiva',
      'Manejo de objeciones',
      'Conocimiento del mercado',
    ],
  },
  {
    id: 3,
    name: 'Operaciones / Administracion',
    competencies: [
      'Organizacion',
      'Atencion al detalle',
      'Manejo de prioridades',
      'Proactividad',
      'Trabajo bajo presion',
    ],
  },
]

const DEFAULT_SLAS = [
  { stage: 'Screening inicial', days: 3, color: '#3b82f6' },
  { stage: 'Entrevista telefonica', days: 5, color: '#8b5cf6' },
  { stage: 'Entrevista tecnica', days: 7, color: '#f59e0b' },
  { stage: 'Entrevista final', days: 5, color: '#f97316' },
  { stage: 'Oferta', days: 3, color: '#10b981' },
  { stage: 'Cierre total', days: 30, color: '#22c55e' },
]

const DEFAULT_NOTIFICATIONS = {
  slaWarning: true,
  slaBreached: true,
  newCandidate: true,
  interviewReminder: true,
  weeklyReport: true,
  candidateStuck: true,
  teamActivity: false,
}

export default function StrategicConfig() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('org')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // State for each tab
  const [org, setOrg] = useState(DEFAULT_ORG)
  const [team, setTeam] = useState(DEFAULT_TEAM)
  const [scorecards, setScorecards] = useState(DEFAULT_SCORECARDS)
  const [slas, setSlas] = useState(DEFAULT_SLAS)
  const [branding, setBranding] = useState({ companyName: '', logoUrl: '' })
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS)

  // Editing states
  const [editingScorecard, setEditingScorecard] = useState(null)
  const [newCompetency, setNewCompetency] = useState('')

  useEffect(() => {
    if (profile?.organizations) {
      setOrg({
        name: profile.organizations.name || '',
        industry: profile.organizations.industry || '',
        size: profile.organizations.size || '',
        website: profile.organizations.website || '',
        description: profile.organizations.description || '',
      })
      setBranding({
        companyName: profile.organizations.name || '',
        logoUrl: profile.organizations.logo_url || '',
      })
    }
  }, [profile])

  const handleSave = async () => {
    setSaving(true)
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 800))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Link to="/dashboard/enterprise" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ChevronLeft size={16} /> Enterprise Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Configuracion estrategica</h1>
            <p className="text-sm text-gray-400 mt-1">Administra tu organizacion, equipo, scorecards y SLAs</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-light transition-all disabled:opacity-50"
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary/20 text-primary-light'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* Organization Profile */}
          {activeTab === 'org' && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Perfil de la organizacion</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { key: 'name', label: 'Nombre de la empresa', placeholder: 'Mi Empresa S.A. de C.V.' },
                  { key: 'industry', label: 'Industria', placeholder: 'Tecnologia, Finanzas, Retail...' },
                  { key: 'size', label: 'Tamano', placeholder: '50-200 empleados' },
                  { key: 'website', label: 'Sitio web', placeholder: 'https://miempresa.com' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">{field.label}</label>
                    <input
                      type="text"
                      value={org[field.key]}
                      onChange={e => setOrg({ ...org, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:border-primary/50 focus:outline-none transition-colors"
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Descripcion</label>
                  <textarea
                    value={org.description}
                    onChange={e => setOrg({ ...org, description: e.target.value })}
                    placeholder="Breve descripcion de la empresa para contexto en reportes..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:border-primary/50 focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Team Management */}
          {activeTab === 'team' && (
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Equipo de reclutamiento</h2>
                <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/20 text-primary-light text-sm font-medium hover:bg-primary/30 transition-colors">
                  <Plus size={14} />
                  Agregar miembro
                </button>
              </div>
              <div className="space-y-3">
                {team.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary-light text-xs font-bold">
                        {member.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{member.name}</p>
                        <p className="text-[11px] text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        member.role === 'admin' ? 'bg-gold/10 text-gold' :
                        member.role === 'recruiter_lead' ? 'bg-purple-500/10 text-purple-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        {ROLE_LABELS[member.role]}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${member.active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                      <button className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scoring Templates */}
          {activeTab === 'scoring' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Plantillas de scorecard por familia de puesto</h2>
                <button
                  onClick={() => {
                    setScorecards([...scorecards, {
                      id: Date.now(),
                      name: 'Nueva familia',
                      competencies: ['Competencia 1'],
                    }])
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/20 text-primary-light text-sm font-medium hover:bg-primary/30 transition-colors"
                >
                  <Plus size={14} />
                  Nueva plantilla
                </button>
              </div>
              {scorecards.map((card) => (
                <motion.div
                  key={card.id}
                  layout
                  className="glass rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    {editingScorecard === card.id ? (
                      <input
                        autoFocus
                        value={card.name}
                        onChange={e => setScorecards(scorecards.map(c => c.id === card.id ? { ...c, name: e.target.value } : c))}
                        onBlur={() => setEditingScorecard(null)}
                        onKeyDown={e => e.key === 'Enter' && setEditingScorecard(null)}
                        className="text-sm font-semibold text-white bg-white/5 border border-white/10 px-2 py-1 rounded focus:outline-none focus:border-primary/50"
                      />
                    ) : (
                      <h3
                        className="text-sm font-semibold text-white cursor-pointer hover:text-primary-light transition-colors flex items-center gap-2"
                        onClick={() => setEditingScorecard(card.id)}
                      >
                        <Star size={14} className="text-amber-400" />
                        {card.name}
                        <Edit2 size={12} className="text-gray-600" />
                      </h3>
                    )}
                    <button
                      onClick={() => setScorecards(scorecards.filter(c => c.id !== card.id))}
                      className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {card.competencies.map((comp, ci) => (
                      <div key={ci} className="flex items-center gap-2 group">
                        <span className="text-xs text-gray-500 w-5 text-right">{ci + 1}.</span>
                        <input
                          value={comp}
                          onChange={e => {
                            const updated = [...card.competencies]
                            updated[ci] = e.target.value
                            setScorecards(scorecards.map(c => c.id === card.id ? { ...c, competencies: updated } : c))
                          }}
                          className="flex-1 text-sm text-gray-300 bg-transparent border-b border-transparent hover:border-white/10 focus:border-primary/30 py-1 focus:outline-none transition-colors"
                        />
                        <button
                          onClick={() => {
                            const updated = card.competencies.filter((_, i) => i !== ci)
                            setScorecards(scorecards.map(c => c.id === card.id ? { ...c, competencies: updated } : c))
                          }}
                          className="p-1 rounded text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        placeholder="Agregar competencia..."
                        value={editingScorecard === `new-${card.id}` ? newCompetency : ''}
                        onFocus={() => setEditingScorecard(`new-${card.id}`)}
                        onChange={e => setNewCompetency(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newCompetency.trim()) {
                            setScorecards(scorecards.map(c =>
                              c.id === card.id ? { ...c, competencies: [...c.competencies, newCompetency.trim()] } : c
                            ))
                            setNewCompetency('')
                          }
                        }}
                        className="text-xs text-gray-500 bg-transparent border-b border-dashed border-white/10 py-1 focus:outline-none focus:border-primary/30 placeholder-gray-700 flex-1"
                      />
                      <Plus size={12} className="text-gray-700" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* SLA Configuration */}
          {activeTab === 'sla' && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Configuracion de SLAs por etapa</h2>
              <p className="text-xs text-gray-500 mb-6">Define los dias maximo que un candidato debe permanecer en cada etapa antes de generar una alerta.</p>
              <div className="space-y-4">
                {slas.map((sla, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: sla.color }} />
                    <span className="text-sm text-white font-medium flex-1">{sla.stage}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={sla.days}
                        onChange={e => {
                          const updated = [...slas]
                          updated[i] = { ...sla, days: parseInt(e.target.value) || 1 }
                          setSlas(updated)
                        }}
                        className="w-16 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center focus:border-primary/50 focus:outline-none"
                      />
                      <span className="text-xs text-gray-500">dias</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <p className="text-xs text-blue-400">
                  <strong>Nota:</strong> Cuando un candidato exceda el SLA de una etapa, se generara una alerta automatica
                  visible en el Enterprise Dashboard y se notificara al recruiter asignado.
                </p>
              </div>
            </div>
          )}

          {/* Branding */}
          {activeTab === 'branding' && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Branding de reportes</h2>
              <p className="text-xs text-gray-500 mb-6">Personaliza como aparece tu empresa en reportes ejecutivos y documentos generados.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Nombre en reportes</label>
                  <input
                    type="text"
                    value={branding.companyName}
                    onChange={e => setBranding({ ...branding, companyName: e.target.value })}
                    placeholder="Nombre de la empresa"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:border-primary/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">URL del logotipo</label>
                  <input
                    type="text"
                    value={branding.logoUrl}
                    onChange={e => setBranding({ ...branding, logoUrl: e.target.value })}
                    placeholder="https://miempresa.com/logo.png"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:border-primary/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              {branding.logoUrl && (
                <div className="mt-6">
                  <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10 inline-block">
                    <img src={branding.logoUrl} alt="Logo preview" className="h-12 object-contain" onError={e => e.target.style.display = 'none'} />
                  </div>
                </div>
              )}
              <div className="mt-6 p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <p className="text-sm text-white font-medium mb-1">Vista previa de encabezado de reporte</p>
                <div className="flex items-center gap-3 mt-3">
                  {branding.logoUrl && (
                    <img src={branding.logoUrl} alt="" className="h-8 object-contain" onError={e => e.target.style.display = 'none'} />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{branding.companyName || 'Mi Empresa'}</p>
                    <p className="text-[10px] text-gray-500">Reporte de reclutamiento | Mayo 2026</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Preferencias de notificaciones</h2>
              <p className="text-xs text-gray-500 mb-6">Configura que notificaciones recibir para tu equipo de reclutamiento.</p>
              <div className="space-y-4">
                {[
                  { key: 'slaWarning', label: 'Alerta de SLA proximo a vencer', desc: 'Notificar cuando una vacante este al 80% de su SLA' },
                  { key: 'slaBreached', label: 'SLA excedido', desc: 'Alerta inmediata cuando se rebasa el SLA de una etapa' },
                  { key: 'newCandidate', label: 'Nuevo candidato aplicado', desc: 'Notificar cuando se recibe una nueva aplicacion' },
                  { key: 'interviewReminder', label: 'Recordatorio de entrevista', desc: 'Recordatorio 1 hora antes de cada entrevista programada' },
                  { key: 'weeklyReport', label: 'Reporte semanal', desc: 'Resumen ejecutivo cada lunes con metricas de la semana anterior' },
                  { key: 'candidateStuck', label: 'Candidato estancado', desc: 'Alerta cuando un candidato lleva mas de 5 dias sin avance' },
                  { key: 'teamActivity', label: 'Actividad del equipo', desc: 'Resumen diario de acciones realizadas por cada recruiter' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5">
                    <div>
                      <p className="text-sm text-white font-medium">{item.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        notifications[item.key] ? 'bg-primary' : 'bg-gray-700'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        notifications[item.key] ? 'left-5.5 translate-x-0.5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
