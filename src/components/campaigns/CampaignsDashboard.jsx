import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Megaphone, Users, DollarSign, TrendingUp, Loader2, Eye, Pause, Play, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const statusLabels = { draft: 'Borrador', active: 'Activa', paused: 'Pausada', completed: 'Completada', failed: 'Error' }
const statusColors = {
  draft: 'bg-gray-500/15 text-ink-secondary',
  active: 'bg-emerald-500/15 text-emerald-400',
  paused: 'bg-amber-500/15 text-amber-400',
  completed: 'bg-blue-500/15 text-blue-400',
  failed: 'bg-red-500/15 text-red-400',
}
const platformLabels = { facebook: 'Facebook', instagram: 'Instagram', both: 'Facebook + Instagram' }

export default function CampaignsDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { if (profile) loadCampaigns() }, [profile])

  async function loadCampaigns() {
    const { data } = await supabase
      .from('meta_campaigns')
      .select('*, vacancies(title)')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })

    setCampaigns(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter)
  const totalLeads = campaigns.reduce((s, c) => s + (c.leads_count || 0), 0)
  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Campanas Meta</h1>
          <p className="text-ink-secondary mt-1">Lanza campanas de Meta Lead Ads para captar candidatos</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/campaigns/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Nueva campana
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Campanas activas', value: activeCampaigns, icon: Megaphone, color: 'text-blue-400' },
          { label: 'Total leads', value: totalLeads, icon: Users, color: 'text-emerald-400' },
          { label: 'Inversion total', value: `$${totalSpend.toLocaleString()}`, icon: DollarSign, color: 'text-amber-400' },
          { label: 'CPL promedio', value: totalLeads > 0 ? `$${Math.round(totalSpend / totalLeads)}` : '$0', icon: TrendingUp, color: 'text-purple-400' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={16} className={kpi.color} />
              <span className="text-xs text-ink-tertiary">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold text-ink">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { id: 'all', label: 'Todas' },
          { id: 'active', label: 'Activas' },
          { id: 'draft', label: 'Borradores' },
          { id: 'completed', label: 'Completadas' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              filter === f.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-ink-tertiary hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 glass rounded-xl">
          <Megaphone size={48} className="mx-auto text-ink-tertiary mb-4" />
          <h3 className="text-lg font-medium text-ink mb-2">
            {campaigns.length === 0 ? 'Sin campanas aun' : 'No hay campanas con este filtro'}
          </h3>
          <p className="text-ink-secondary text-sm max-w-md mx-auto mb-6">
            Crea tu primera campana de Meta Lead Ads para captar candidatos de forma automatica.
          </p>
          {campaigns.length === 0 && (
            <button
              onClick={() => navigate('/dashboard/campaigns/new')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-medium hover:opacity-90"
            >
              <Plus size={16} /> Crear campana
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((campaign, i) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/dashboard/campaigns/${campaign.id}`)}
              className="glass rounded-xl p-5 cursor-pointer hover:border-blue-500/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-ink group-hover:text-blue-300 transition-colors truncate">{campaign.name}</h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${statusColors[campaign.status]}`}>
                      {statusLabels[campaign.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-ink-tertiary">
                    {campaign.vacancies?.title && (
                      <span className="flex items-center gap-1">
                        <Megaphone size={12} /> {campaign.vacancies.title}
                      </span>
                    )}
                    <span>{platformLabels[campaign.platform]}</span>
                    {campaign.launched_at && (
                      <span>Lanzada {new Date(campaign.launched_at).toLocaleDateString('es-MX')}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6 ml-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-ink">{campaign.leads_count || 0}</p>
                    <p className="text-[10px] text-ink-tertiary">Leads</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-ink">{campaign.impressions || 0}</p>
                    <p className="text-[10px] text-ink-tertiary">Impresiones</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-ink">
                      ${campaign.cost_per_lead ? campaign.cost_per_lead.toFixed(0) : '0'}
                    </p>
                    <p className="text-[10px] text-ink-tertiary">CPL</p>
                  </div>
                  <Eye size={16} className="text-ink-tertiary group-hover:text-blue-400 transition-colors" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
