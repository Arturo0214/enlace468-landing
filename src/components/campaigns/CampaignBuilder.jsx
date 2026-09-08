import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Megaphone, MapPin, DollarSign, Eye, Rocket, Loader2, Sparkles, X, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import AdPreview from './AdPreview'

const DEFAULT_LOCATIONS = [
  { city: 'Guadalajara', state: 'Jalisco', label: 'Guadalajara 3' },
  { city: 'Guadalajara', state: 'Jalisco', label: 'Guadalajara 4' },
  { city: 'Merida', state: 'Yucatan', label: 'Merida 3' },
  { city: 'Merida', state: 'Yucatan', label: 'Merida 4' },
  { city: 'Merida', state: 'Yucatan', label: 'Merida 6' },
  { city: 'Ixtapaluca', state: 'Estado de Mexico', label: 'Ixtapaluca' },
  { city: 'Mixcoac', state: 'CDMX', label: 'Mixcoac, CDMX' },
  { city: 'Minatitlan', state: 'Veracruz', label: 'Minatitlan, Veracruz' },
  { city: 'Tehuacan', state: 'Puebla', label: 'Tehuacan, Puebla' },
]

const CTA_OPTIONS = ['Aplica ahora', 'Mas informacion', 'Registrate', 'Enviar solicitud', 'Contactanos']

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-surface-1 border border-line focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none text-ink placeholder-gray-500 text-sm"

export default function CampaignBuilder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const [vacancies, setVacancies] = useState([])
  const [saving, setSaving] = useState(false)
  const [previewPlatform, setPreviewPlatform] = useState('facebook')

  const [form, setForm] = useState({
    vacancy_id: searchParams.get('vacancy_id') || '',
    name: '',
    platform: 'both',
    ad_headline: '',
    ad_body: '',
    ad_cta: 'Aplica ahora',
    locations: DEFAULT_LOCATIONS.map(l => ({ ...l, selected: true })),
    age_min: 21,
    age_max: 45,
    interests: ['mecanica automotriz', 'valuacion vehicular', 'prestamos', 'ventas'],
    budget_type: 'daily',
    budget_amount: 300,
  })

  const [newInterest, setNewInterest] = useState('')

  useEffect(() => { if (profile) loadVacancies() }, [profile])

  async function loadVacancies() {
    const { data } = await supabase
      .from('vacancies')
      .select('id, title, company_name, location, salary_min, salary_max, description')
      .eq('organization_id', profile.organization_id)
      .in('status', ['open', 'draft'])
      .order('created_at', { ascending: false })

    setVacancies(data || [])

    // Auto-select vacancy from URL param
    const vid = searchParams.get('vacancy_id')
    if (vid && data?.length) {
      const v = data.find(x => x.id === vid)
      if (v) populateFromVacancy(v)
    }
  }

  function populateFromVacancy(v) {
    const salary = v.salary_min && v.salary_max
      ? `$${Number(v.salary_min).toLocaleString()} - $${Number(v.salary_max).toLocaleString()} MXN`
      : ''

    setForm(prev => ({
      ...prev,
      vacancy_id: v.id,
      name: `Campana Meta — ${v.title}`,
      ad_headline: `Se busca: ${v.title}${v.location ? ` — ${v.location}` : ''}`,
      ad_body: generateAdBody(v, salary),
    }))
  }

  function generateAdBody(v, salary) {
    const parts = []
    parts.push(`Estamos buscando ${v.title}${v.company_name ? ` para ${v.company_name}` : ''}.`)
    if (salary) parts.push(`Sueldo: ${salary} + comisiones.`)
    parts.push('Prestaciones de ley, apoyo para traslados.')
    parts.push('Requisitos: bachillerato, licencia de manejo, conocimiento en mecanica.')
    parts.push('Aplica ahora y unete a nuestro equipo.')
    return parts.join('\n')
  }

  function handleVacancyChange(e) {
    const vid = e.target.value
    const v = vacancies.find(x => x.id === vid)
    if (v) populateFromVacancy(v)
    else setForm(prev => ({ ...prev, vacancy_id: vid }))
  }

  function toggleLocation(index) {
    setForm(prev => ({
      ...prev,
      locations: prev.locations.map((l, i) => i === index ? { ...l, selected: !l.selected } : l),
    }))
  }

  function addInterest() {
    if (!newInterest.trim()) return
    setForm(prev => ({ ...prev, interests: [...prev.interests, newInterest.trim()] }))
    setNewInterest('')
  }

  function removeInterest(index) {
    setForm(prev => ({ ...prev, interests: prev.interests.filter((_, i) => i !== index) }))
  }

  const selectedLocations = form.locations.filter(l => l.selected)
  const estimatedReach = form.budget_type === 'daily'
    ? form.budget_amount * 120
    : form.budget_amount * 8

  async function handleSave(launch = false) {
    if (!form.name.trim()) return alert('Nombre de campana requerido')
    setSaving(true)

    const campaignData = {
      organization_id: profile.organization_id,
      created_by: profile.id,
      vacancy_id: form.vacancy_id || null,
      name: form.name,
      status: launch ? 'active' : 'draft',
      platform: form.platform,
      ad_headline: form.ad_headline,
      ad_body: form.ad_body,
      ad_cta: form.ad_cta,
      locations: selectedLocations.map(l => ({ city: l.city, state: l.state })),
      age_min: form.age_min,
      age_max: form.age_max,
      interests: form.interests,
      budget_type: form.budget_type,
      budget_amount: form.budget_amount,
      n8n_webhook_url: import.meta.env.VITE_N8N_CAMPAIGN_WEBHOOK_URL || null,
      launched_at: launch ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
      .from('meta_campaigns')
      .insert(campaignData)
      .select('id')
      .single()

    if (error) {
      console.error(error)
      alert('Error al guardar: ' + error.message)
      setSaving(false)
      return
    }

    // If launching, trigger n8n webhook
    if (launch && campaignData.n8n_webhook_url) {
      try {
        const vacancy = vacancies.find(v => v.id === form.vacancy_id)
        await fetch(campaignData.n8n_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'launch_campaign',
            campaign_id: data.id,
            vacancy_title: vacancy?.title || form.name,
            ad_headline: form.ad_headline,
            ad_body: form.ad_body,
            ad_cta: form.ad_cta,
            locations: selectedLocations.map(l => `${l.city}, ${l.state}`),
            budget_type: form.budget_type,
            budget_amount: form.budget_amount,
            age_min: form.age_min,
            age_max: form.age_max,
            interests: form.interests,
            callback_url: `${window.location.origin}/api/meta-lead-webhook`,
            organization_id: profile.organization_id,
            vacancy_id: form.vacancy_id,
          }),
        })
      } catch (err) {
        console.warn('n8n webhook call failed (campaign saved anyway):', err)
      }
    }

    // Log activity
    await supabase.from('activity_log').insert({
      organization_id: profile.organization_id,
      entity_type: 'meta_campaign',
      entity_id: data.id,
      action: launch ? 'campaign_launched' : 'campaign_created',
      details: { name: form.name, platform: form.platform },
      performed_by: profile.id,
    })

    navigate(`/dashboard/campaigns/${data.id}`)
  }

  return (
    <div>
      <button onClick={() => navigate('/dashboard/campaigns')} className="flex items-center gap-1.5 text-ink-tertiary hover:text-ink mb-4 text-xs transition-colors">
        <ArrowLeft size={14} /> Campanas
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
          <Megaphone size={20} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-ink">Nueva Campana Meta</h1>
          <p className="text-ink-secondary text-sm">Configura y lanza una campana de Lead Ads en Facebook/Instagram</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form - 2 cols */}
        <div className="lg:col-span-2 space-y-5">

          {/* Vacancy selector */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
            <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-blue-400" /> Vacante asociada
            </h2>
            <select
              value={form.vacancy_id}
              onChange={handleVacancyChange}
              className={inputClass}
            >
              <option value="">Selecciona una vacante (opcional)</option>
              {vacancies.map(v => (
                <option key={v.id} value={v.id}>{v.title}{v.company_name ? ` — ${v.company_name}` : ''}</option>
              ))}
            </select>
          </motion.div>

          {/* Ad content */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-5">
            <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
              <Megaphone size={16} className="text-blue-400" /> Contenido del anuncio
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-tertiary mb-1 block">Nombre de la campana *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Campana Meta — Valuador Autos GDL"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-ink-tertiary mb-1 block">Titulo del anuncio</label>
                <input
                  type="text"
                  value={form.ad_headline}
                  onChange={e => setForm(p => ({ ...p, ad_headline: e.target.value }))}
                  placeholder="Se busca: Valuador de Autos y/o Moto"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-ink-tertiary mb-1 block">Texto del anuncio</label>
                <textarea
                  value={form.ad_body}
                  onChange={e => setForm(p => ({ ...p, ad_body: e.target.value }))}
                  rows={5}
                  placeholder="Describe la oportunidad laboral..."
                  className={inputClass + ' resize-none'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-tertiary mb-1 block">CTA (llamada a la accion)</label>
                  <select value={form.ad_cta} onChange={e => setForm(p => ({ ...p, ad_cta: e.target.value }))} className={inputClass}>
                    {CTA_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-ink-tertiary mb-1 block">Plataforma</label>
                  <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} className={inputClass}>
                    <option value="both">Facebook + Instagram</option>
                    <option value="facebook">Solo Facebook</option>
                    <option value="instagram">Solo Instagram</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Targeting */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-5">
            <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-blue-400" /> Segmentacion
            </h2>

            <div className="space-y-4">
              {/* Locations */}
              <div>
                <label className="text-xs text-ink-tertiary mb-2 block">Ubicaciones objetivo ({selectedLocations.length} seleccionadas)</label>
                <div className="flex flex-wrap gap-2">
                  {form.locations.map((loc, i) => (
                    <button
                      key={i}
                      onClick={() => toggleLocation(i)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        loc.selected
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-surface-1 text-ink-tertiary border border-line hover:border-line-strong'
                      }`}
                    >
                      <MapPin size={12} />
                      {loc.label}
                      {loc.selected && <span className="text-blue-400">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-tertiary mb-1 block">Edad minima</label>
                  <input
                    type="number"
                    value={form.age_min}
                    onChange={e => setForm(p => ({ ...p, age_min: parseInt(e.target.value) || 18 }))}
                    min={18} max={65}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-tertiary mb-1 block">Edad maxima</label>
                  <input
                    type="number"
                    value={form.age_max}
                    onChange={e => setForm(p => ({ ...p, age_max: parseInt(e.target.value) || 65 }))}
                    min={18} max={65}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="text-xs text-ink-tertiary mb-2 block">Intereses</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.interests.map((interest, i) => (
                    <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-1 text-ink-secondary text-xs border border-line">
                      {interest}
                      <button onClick={() => removeInterest(i)} className="text-ink-tertiary hover:text-red-400 ml-0.5"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newInterest}
                    onChange={e => setNewInterest(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                    placeholder="Agregar interes..."
                    className={inputClass + ' flex-1'}
                  />
                  <button onClick={addInterest} className="px-3 py-2 bg-surface-1 border border-line rounded-lg text-ink-secondary hover:text-ink hover:bg-white/10 transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Budget */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-xl p-5">
            <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
              <DollarSign size={16} className="text-blue-400" /> Presupuesto
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-ink-tertiary mb-1 block">Tipo</label>
                <select value={form.budget_type} onChange={e => setForm(p => ({ ...p, budget_type: e.target.value }))} className={inputClass}>
                  <option value="daily">Diario</option>
                  <option value="total">Total de campana</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-tertiary mb-1 block">Monto (MXN)</label>
                <input
                  type="number"
                  value={form.budget_amount}
                  onChange={e => setForm(p => ({ ...p, budget_amount: parseFloat(e.target.value) || 0 }))}
                  min={0}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-1 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-ink-tertiary uppercase">Alcance estimado</p>
                <p className="text-sm font-semibold text-ink mt-0.5">{estimatedReach.toLocaleString()} personas</p>
              </div>
              <div className="bg-surface-1 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-ink-tertiary uppercase">CPL estimado</p>
                <p className="text-sm font-semibold text-ink mt-0.5">$15 — $40 MXN</p>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-ink rounded-xl text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
              Guardar borrador
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              Lanzar campana
            </button>
          </div>
        </div>

        {/* Preview - 1 col */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <Eye size={14} className="text-blue-400" /> Preview
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPreviewPlatform('facebook')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      previewPlatform === 'facebook' ? 'bg-blue-500/20 text-blue-300' : 'text-ink-tertiary hover:text-white'
                    }`}
                  >
                    Facebook
                  </button>
                  <button
                    onClick={() => setPreviewPlatform('instagram')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      previewPlatform === 'instagram' ? 'bg-pink-500/20 text-pink-300' : 'text-ink-tertiary hover:text-white'
                    }`}
                  >
                    Instagram
                  </button>
                </div>
              </div>

              <div className="flex justify-center">
                <AdPreview
                  headline={form.ad_headline}
                  body={form.ad_body}
                  cta={form.ad_cta}
                  companyName="SELECTA Consultores"
                  platform={previewPlatform}
                />
              </div>
            </div>

            {/* Summary card */}
            <div className="glass rounded-xl p-4">
              <h3 className="text-sm font-semibold text-ink mb-3">Resumen</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Plataforma</span>
                  <span className="text-ink">{form.platform === 'both' ? 'FB + IG' : form.platform === 'facebook' ? 'Facebook' : 'Instagram'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Ubicaciones</span>
                  <span className="text-ink">{selectedLocations.length} ciudades</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Edad</span>
                  <span className="text-ink">{form.age_min} — {form.age_max} anos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Presupuesto</span>
                  <span className="text-ink">${form.budget_amount.toLocaleString()} MXN/{form.budget_type === 'daily' ? 'dia' : 'total'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-tertiary">Alcance est.</span>
                  <span className="text-ink">{estimatedReach.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
