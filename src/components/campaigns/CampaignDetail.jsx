import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Megaphone, Users, DollarSign, TrendingUp, Eye, MousePointer, Pause, Play, Square, Loader2, ExternalLink, MapPin, Clock, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useStageLabels } from '../../lib/useStageLabels'
import AdPreview from './AdPreview'
import CampaignFunnel from './CampaignFunnel'
import WhatsAppConversations from './WhatsAppConversations'

const statusLabels = { draft: 'Borrador', active: 'Activa', paused: 'Pausada', completed: 'Completada', failed: 'Error' }
const statusColors = {
  draft: 'bg-gray-500/15 text-ink-secondary',
  active: 'bg-emerald-500/15 text-emerald-400',
  paused: 'bg-amber-500/15 text-amber-400',
  completed: 'bg-blue-500/15 text-blue-400',
  failed: 'bg-red-500/15 text-red-400',
}

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  // Etiquetas de etapa configurables por org (Configuración → Etapas).
  const { getLabel } = useStageLabels()
  const [campaign, setCampaign] = useState(null)
  const [leads, setLeads] = useState([])
  const [funnelData, setFunnelData] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => { if (profile) loadCampaign() }, [id, profile])

  async function loadCampaign() {
    const { data, error } = await supabase
      .from('meta_campaigns')
      .select('*, vacancies(title, company_name, location)')
      .eq('id', id)
      .single()

    if (error || !data) { navigate('/dashboard/campaigns'); return }
    setCampaign(data)
    await loadLeads(data)
    setLoading(false)
  }

  async function loadLeads(camp) {
    if (!camp.vacancy_id) {
      // Load candidates with source=meta_ads for this org
      const { data } = await supabase
        .from('candidates')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('source', 'meta_ads')
        .order('created_at', { ascending: false })
        .limit(100)

      setLeads(data || [])
      buildFunnel([], data || [])
      return
    }

    // Load candidates linked to the vacancy
    const { data } = await supabase
      .from('vacancy_candidates')
      .select('stage, match_score, created_at, candidates(id, full_name, email, phone, location, current_title, source, created_at)')
      .eq('vacancy_id', camp.vacancy_id)

    const all = data || []
    const metaLeads = all.filter(vc => vc.candidates?.source === 'meta_ads')
    setLeads(metaLeads)
    buildFunnel(all, metaLeads)
  }

  function buildFunnel(vacancyCandidates, metaLeads) {
    const stages = {}
    const source = vacancyCandidates.length > 0 ? vacancyCandidates : metaLeads

    source.forEach(item => {
      const stage = item.stage || 'sourced'
      stages[stage] = (stages[stage] || 0) + 1
    })

    const funnelOrder = ['sourced', 'contacted', 'interviewing', 'evaluated', 'presented', 'offer', 'hired']
    const funnel = funnelOrder
      .filter(s => stages[s])
      .map(s => ({ label: getLabel(s), count: stages[s] || 0 }))

    if (funnel.length === 0) {
      funnel.push({ label: 'Leads captados', count: metaLeads.length || campaign?.leads_count || 0 })
    }

    setFunnelData(funnel)
  }

  async function updateStatus(newStatus) {
    setUpdating(true)
    const updates = { status: newStatus }
    if (newStatus === 'completed') updates.ended_at = new Date().toISOString()

    await supabase.from('meta_campaigns').update(updates).eq('id', id)
    setCampaign(prev => ({ ...prev, ...updates }))
    setUpdating(false)
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-blue-400" size={24} /></div>
  if (!campaign) return null

  const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(1) : '0'
  const convRate = campaign.clicks > 0 ? ((campaign.leads_count / campaign.clicks) * 100).toFixed(1) : '0'

  return (
    <div>
      <button onClick={() => navigate('/dashboard/campaigns')} className="flex items-center gap-1.5 text-ink-tertiary hover:text-ink mb-4 text-xs transition-colors">
        <ArrowLeft size={14} /> Campanas
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-display font-bold text-ink">{campaign.name}</h1>
            <span className={`text-[11px] px-2.5 py-0.5 rounded font-medium ${statusColors[campaign.status]}`}>
              {statusLabels[campaign.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-tertiary">
            {campaign.vacancies?.title && (
              <button
                onClick={() => navigate(`/dashboard/vacancies/${campaign.vacancy_id}`)}
                className="flex items-center gap-1 hover:text-blue-400 transition-colors"
              >
                <Megaphone size={12} /> {campaign.vacancies.title}
              </button>
            )}
            {campaign.launched_at && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> Lanzada {new Date(campaign.launched_at).toLocaleDateString('es-MX')}
              </span>
            )}
          </div>
        </div>

        {/* Status actions */}
        <div className="flex items-center gap-2">
          {campaign.status === 'active' && (
            <button
              onClick={() => updateStatus('paused')}
              disabled={updating}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/25 transition-colors disabled:opacity-50"
            >
              <Pause size={14} /> Pausar
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={() => updateStatus('active')}
              disabled={updating}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
            >
              <Play size={14} /> Reanudar
            </button>
          )}
          {(campaign.status === 'active' || campaign.status === 'paused') && (
            <button
              onClick={() => updateStatus('completed')}
              disabled={updating}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-ink-secondary rounded-lg text-xs font-medium hover:bg-white/15 transition-colors disabled:opacity-50"
            >
              <Square size={14} /> Finalizar
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Leads', value: campaign.leads_count || leads.length, icon: Users, color: 'text-emerald-400' },
          { label: 'Impresiones', value: (campaign.impressions || 0).toLocaleString(), icon: Eye, color: 'text-blue-400' },
          { label: 'Clics', value: campaign.clicks || 0, icon: MousePointer, color: 'text-cyan-400' },
          { label: 'CPL', value: `$${campaign.cost_per_lead ? campaign.cost_per_lead.toFixed(0) : '0'}`, icon: DollarSign, color: 'text-amber-400' },
          { label: 'Conv. rate', value: `${convRate}%`, icon: TrendingUp, color: 'text-purple-400' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <kpi.icon size={14} className={kpi.color} />
              <span className="text-[10px] text-ink-tertiary uppercase">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold text-ink">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { id: 'overview', label: 'Funnel' },
          { id: 'whatsapp', label: 'WhatsApp' },
          { id: 'leads', label: `Leads (${leads.length})` },
          { id: 'preview', label: 'Preview' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-ink-tertiary hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW / FUNNEL */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Funnel de conversion</h3>
            {funnelData.length > 0 ? (
              <CampaignFunnel data={funnelData} />
            ) : (
              <p className="text-sm text-ink-tertiary py-8 text-center">Aun no hay datos de conversion</p>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Metricas de campana</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-xs text-ink-tertiary">Inversion total</span>
                <span className="text-sm font-medium text-ink">${(campaign.spend || 0).toLocaleString()} MXN</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-xs text-ink-tertiary">Presupuesto {campaign.budget_type === 'daily' ? 'diario' : 'total'}</span>
                <span className="text-sm font-medium text-ink">${(campaign.budget_amount || 0).toLocaleString()} MXN</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-xs text-ink-tertiary">CTR</span>
                <span className="text-sm font-medium text-ink">{ctr}%</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-xs text-ink-tertiary">Tasa de conversion</span>
                <span className="text-sm font-medium text-ink">{convRate}%</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-ink-tertiary">Plataforma</span>
                <span className="text-sm font-medium text-ink">
                  {campaign.platform === 'both' ? 'Facebook + Instagram' : campaign.platform === 'facebook' ? 'Facebook' : 'Instagram'}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* WHATSAPP CONVERSATIONS */}
      {activeTab === 'whatsapp' && (
        <WhatsAppConversations />
      )}

      {/* LEADS TABLE */}
      {activeTab === 'leads' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl overflow-hidden">
          {leads.length === 0 ? (
            <div className="py-12 text-center">
              <Users size={32} className="mx-auto text-ink-tertiary mb-3" />
              <p className="text-ink-secondary text-sm">Aun no se han captado leads desde esta campana</p>
              <p className="text-ink-tertiary text-xs mt-1">Los leads aparecen aqui en tiempo real cuando llegan del formulario de Meta</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-line">
                    <th className="px-4 py-3 text-[10px] font-semibold text-ink-tertiary uppercase">Candidato</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-ink-tertiary uppercase">Contacto</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-ink-tertiary uppercase">Ubicacion</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-ink-tertiary uppercase">Etapa</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-ink-tertiary uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const candidate = lead.candidates || lead
                    const stage = lead.stage || 'sourced'
                    return (
                      <tr
                        key={i}
                        onClick={() => candidate.id && navigate(`/dashboard/candidates/${candidate.id}`)}
                        className="border-b border-line hover:bg-white/[0.02] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-300 text-xs font-bold">
                              {candidate.full_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-ink">{candidate.full_name}</p>
                              {candidate.current_title && <p className="text-[11px] text-ink-tertiary">{candidate.current_title}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {candidate.email && <p className="text-xs text-ink-secondary">{candidate.email}</p>}
                            {candidate.phone && <p className="text-xs text-ink-tertiary">{candidate.phone}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {candidate.location && (
                            <span className="flex items-center gap-1 text-xs text-ink-secondary">
                              <MapPin size={10} /> {candidate.location}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-medium">
                            {getLabel(stage)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-ink-tertiary">
                            {new Date(candidate.created_at || lead.created_at).toLocaleDateString('es-MX')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* CONFIG */}
      {activeTab === 'config' && (
        <div className="space-y-5">
          {/* Creative + Copy side by side */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3">
              {/* Creative image */}
              {campaign.ad_image_url && (
                <div className="lg:col-span-1 p-5 flex items-center justify-center" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                  <img src={campaign.ad_image_url} alt="Creative" className="rounded-xl shadow-lg w-full max-w-[280px]" />
                </div>
              )}
              {/* Ad copy */}
              <div className={`${campaign.ad_image_url ? 'lg:col-span-2' : 'lg:col-span-3'} p-6`}>
                <div className="flex items-center gap-2 mb-4">
                  <Megaphone size={16} className="text-blue-400" />
                  <h3 className="text-sm font-semibold text-ink">Contenido del anuncio</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Titulo</p>
                    <p className="text-sm font-medium text-ink">{campaign.ad_headline || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1.5">Texto del anuncio</p>
                    <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{campaign.ad_body || '—'}</p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="px-4 py-2 rounded-lg bg-blue-500/15 text-blue-300 text-xs font-semibold">
                      {campaign.ad_cta || 'Enviar mensaje'}
                    </div>
                    <span className="text-[10px] text-ink-tertiary">Boton de accion del anuncio</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Targeting grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Locations */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={14} className="text-emerald-400" />
                <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Ubicaciones</h4>
              </div>
              <div className="space-y-1.5">
                {(campaign.locations || []).map((loc, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs text-gray-200">{loc.city}</span>
                    <span className="text-[10px] text-ink-tertiary">{loc.state}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Demographics */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-purple-400" />
                <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Demograficos</h4>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg" style={{ background: 'rgba(168,85,247,0.08)' }}>
                  <p className="text-[9px] text-ink-tertiary uppercase mb-1">Rango de edad</p>
                  <p className="text-lg font-bold text-ink">{campaign.age_min} — {campaign.age_max} <span className="text-xs font-normal text-ink-secondary">anos</span></p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'rgba(168,85,247,0.08)' }}>
                  <p className="text-[9px] text-ink-tertiary uppercase mb-1">Plataforma</p>
                  <p className="text-sm font-medium text-ink">{campaign.platform === 'both' ? 'Facebook + Instagram' : campaign.platform}</p>
                </div>
              </div>
            </motion.div>

            {/* Budget */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={14} className="text-amber-400" />
                <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Presupuesto</h4>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)' }}>
                  <p className="text-[9px] text-ink-tertiary uppercase mb-1">{campaign.budget_type === 'daily' ? 'Presupuesto diario' : 'Presupuesto total'}</p>
                  <p className="text-2xl font-bold text-ink">${(campaign.budget_amount || 0).toLocaleString()} <span className="text-xs font-normal text-ink-secondary">MXN</span></p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)' }}>
                  <p className="text-[9px] text-ink-tertiary uppercase mb-1">Invertido</p>
                  <p className="text-lg font-bold text-ink">${(campaign.spend || 0).toLocaleString()} <span className="text-xs font-normal text-ink-secondary">MXN</span></p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Interests */}
          {campaign.interests?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-5">
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-3">Intereses de segmentacion</h4>
              <div className="flex flex-wrap gap-2">
                {campaign.interests.map((int, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-200" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {int}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* PREVIEW */}
      {activeTab === 'preview' && (
        <div className="flex flex-col md:flex-row gap-6 items-start justify-center">
          <div className="text-center">
            <p className="text-xs text-ink-tertiary mb-3">Facebook</p>
            <AdPreview
              headline={campaign.ad_headline}
              body={campaign.ad_body}
              cta={campaign.ad_cta}
              imageUrl={campaign.ad_image_url}
              companyName={campaign.vacancies?.company_name || 'SELECTA Consultores'}
              platform="facebook"
            />
          </div>
          <div className="text-center">
            <p className="text-xs text-ink-tertiary mb-3">Instagram</p>
            <AdPreview
              headline={campaign.ad_headline}
              body={campaign.ad_body}
              cta={campaign.ad_cta}
              imageUrl={campaign.ad_image_url}
              companyName={campaign.vacancies?.company_name || 'SELECTA Consultores'}
              platform="instagram"
            />
          </div>
        </div>
      )}
    </div>
  )
}
