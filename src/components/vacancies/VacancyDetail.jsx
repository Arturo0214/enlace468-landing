import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Users, Search, Send, BarChart3, Loader2, CheckCircle, Copy, ChevronDown, ChevronUp, Star, Download, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import VacancyPipeline from './VacancyPipeline'
import SourcingTab from './SourcingTab'
import ScreeningTab from './ScreeningTab'
import ScorecardBuilder from './ScorecardBuilder'
import ScreeningPanel from './ScreeningPanel'
import PipelineKanban from './PipelineKanban'
import ExecutiveReport from './ExecutiveReport'

const tabs = [
  { id: 'details', label: 'Vacante', icon: FileText },
  { id: 'scorecard', label: 'Scorecard', icon: Star },
  { id: 'sourcing', label: 'Sourcing', icon: Search },
  { id: 'screening', label: 'Screening', icon: Filter },
  { id: 'pipeline', label: 'Pipeline', icon: Users },
  { id: 'outreach', label: 'Outreach', icon: Send },
  { id: 'report', label: 'Reporte', icon: BarChart3 },
]

const statusLabels = { draft: 'Borrador', open: 'Abierta', on_hold: 'En pausa', closed_filled: 'Cerrada', closed_cancelled: 'Cancelada' }
const statusColors = { draft: 'bg-gray-600/20 text-gray-400', open: 'bg-emerald-500/10 text-emerald-400', on_hold: 'bg-amber-500/10 text-amber-400', closed_filled: 'bg-blue-500/10 text-blue-400', closed_cancelled: 'bg-red-500/10 text-red-400' }

const msgTemplates = [
  { id: 'connection', name: 'Invitacion', body: `Hola {{nombre}},\n\nTu perfil me parece muy relevante para una oportunidad como {{puesto}} en {{empresa}}. Me gustaria conectar y platicarte al respecto.\n\nSaludos,\n{{reclutador}}` },
  { id: 'followup_1', name: 'Seguimiento 1', body: `Hola {{nombre}},\n\nTe contacte hace unos dias sobre {{puesto}}. ¿Tienes 15 minutos para una llamada?\n\n{{reclutador}}` },
  { id: 'followup_2', name: 'Seguimiento final', body: `{{nombre}}, solo confirmo si hay interes en {{puesto}}. Si no es el momento, sin problema. Si conoces a alguien, agradeceria la referencia.\n\n{{reclutador}}` },
  { id: 'interest', name: 'Interes confirmado', body: `{{nombre}}, perfecto. Los detalles:\n\n• {{puesto}} — {{empresa}}\n• {{ubicacion}}\n• {{salario}}\n\n¿Agendamos videollamada?\n\n{{reclutador}}` },
  { id: 'rejection', name: 'Cierre', body: `{{nombre}}, gracias por tu tiempo. Avanzamos con otro perfil pero me gustaria mantener el contacto para futuras oportunidades.\n\n{{reclutador}}` },
]

function exportCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function VacancyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [vacancy, setVacancy] = useState(null)
  const [activeTab, setActiveTab] = useState('details')
  const [loading, setLoading] = useState(true)
  const [addedIds, setAddedIds] = useState(new Set())
  const [addingId, setAddingId] = useState(null)
  const [expandedTemplate, setExpandedTemplate] = useState(null)
  const [copied, setCopied] = useState(null)
  const [pipelineStats, setPipelineStats] = useState(null)
  const [pipelineCandidates, setPipelineCandidates] = useState([])

  useEffect(() => { if (profile) loadVacancy() }, [id, profile])

  async function loadVacancy() {
    const { data, error } = await supabase.from('vacancies').select('*').eq('id', id).eq('organization_id', profile.organization_id).single()
    if (error || !data) { navigate('/dashboard/vacancies'); return }
    setVacancy(data); setLoading(false)
  }

  function getPreviewData() {
    if (!vacancy) return {}
    return {
      nombre: '[Nombre]', puesto: vacancy.title, empresa: vacancy.company_name || 'Enlace 468',
      ubicacion: `${vacancy.location || ''} (${vacancy.modality || ''})`,
      salario: vacancy.salary_min && vacancy.salary_max ? `$${Number(vacancy.salary_min).toLocaleString()} - $${Number(vacancy.salary_max).toLocaleString()} MXN` : 'A convenir',
      reclutador: profile?.full_name || 'Enlace 468',
    }
  }

  function replaceVars(text) {
    const d = getPreviewData()
    return text.replace(/\{\{(\w+)\}\}/g, (_, k) => d[k] || `{{${k}}}`)
  }

  function copyMsg(text) {
    navigator.clipboard.writeText(replaceVars(text))
    setCopied(text); setTimeout(() => setCopied(null), 2000)
  }

  async function loadReport() {
    const { data } = await supabase.from('vacancy_candidates').select('stage, match_score, candidates(full_name, current_title, current_company, email, phone, linkedin_url)').eq('vacancy_id', id)
    if (data) {
      const stages = {}
      data.forEach(vc => { stages[vc.stage] = (stages[vc.stage] || 0) + 1 })
      const top = [...data].filter(d => d.match_score).sort((a, b) => b.match_score - a.match_score).slice(0, 5)
      setPipelineStats({ total: data.length, stages, top })
      setPipelineCandidates(data)
    }
  }

  function exportReport() {
    exportCSV(pipelineCandidates.map(vc => ({
      Nombre: vc.candidates?.full_name || '', Puesto: vc.candidates?.current_title || '',
      Empresa: vc.candidates?.current_company || '', Email: vc.candidates?.email || '',
      Telefono: vc.candidates?.phone || '', LinkedIn: vc.candidates?.linkedin_url || '',
      Etapa: vc.stage, Match: vc.match_score || '',
    })), `reporte_${vacancy?.title?.replace(/\s/g, '_')}.csv`)
  }

  useEffect(() => { if (activeTab === 'report') loadReport() }, [activeTab])

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-light border-t-transparent" /></div>
  if (!vacancy) return null

  return (
    <div>
      <button onClick={() => navigate('/dashboard/vacancies')} className="flex items-center gap-1.5 text-gray-500 hover:text-white mb-4 text-xs transition-colors">
        <ArrowLeft size={14} /> Vacantes
      </button>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-display font-bold text-white">{vacancy.title}</h1>
            <select
              value={vacancy.status}
              onChange={async (e) => {
                const newStatus = e.target.value
                await supabase.from('vacancies').update({ status: newStatus, closed_at: newStatus.startsWith('closed') ? new Date().toISOString() : null }).eq('id', id)
                setVacancy(prev => ({ ...prev, status: newStatus }))
              }}
              className={`text-[11px] px-2 py-0.5 rounded font-medium cursor-pointer outline-none ${statusColors[vacancy.status] || ''}`}
              style={{ background: 'transparent', border: 'none', WebkitAppearance: 'none', appearance: 'none', paddingRight: '14px', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'8\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'3\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 2px center' }}
            >
              {Object.entries(statusLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          {vacancy.company_name && <p className="text-sm text-gray-400">{vacancy.company_name}{vacancy.location ? ` · ${vacancy.location}` : ''}</p>}
        </div>
      </div>

      <div className="flex gap-0.5 mb-5 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button key={tabId} onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tabId ? 'border-primary-light text-primary-light' : 'border-transparent text-gray-500 hover:text-white'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* DETALLES */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-5 space-y-5">
            {vacancy.description && <div><h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Descripcion</h3><p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{vacancy.description}</p></div>}
            {vacancy.challenges && <div><h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Retos</h3><p className="text-sm text-gray-300 whitespace-pre-wrap">{vacancy.challenges}</p></div>}
            {vacancy.team_info && <div><h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Equipo</h3><p className="text-sm text-gray-300 whitespace-pre-wrap">{vacancy.team_info}</p></div>}
            {vacancy.competencies?.length > 0 && (
              <div><h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Competencias</h3>
                <div className="space-y-1.5">{vacancy.competencies.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                    <div><span className="text-sm font-medium text-white">{c.name}</span>{c.description && <span className="text-xs text-gray-500 ml-2">— {c.description}</span>}</div>
                    <span className="text-[11px] font-semibold text-primary-light bg-primary-light/10 px-2 py-0.5 rounded">{c.weight}%</span>
                  </div>
                ))}</div>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { l: 'Modalidad', v: vacancy.modality }, { l: 'Prioridad', v: vacancy.priority },
                vacancy.salary_min && { l: 'Salario', v: `$${Number(vacancy.salary_min).toLocaleString()} — $${Number(vacancy.salary_max).toLocaleString()}` },
                vacancy.target_date && { l: 'Fecha limite', v: new Date(vacancy.target_date).toLocaleDateString('es-MX') },
              ].filter(Boolean).map(s => (
                <div key={s.l} className="bg-white/[0.02] rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">{s.l}</div>
                  <div className="text-sm text-white mt-0.5">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end"><button onClick={() => setActiveTab('sourcing')} className="flex items-center gap-2 px-4 py-2 bg-primary-light text-white rounded-lg text-sm font-medium hover:bg-primary-light/90">Buscar candidatos <Search size={14} /></button></div>
        </div>
      )}

      {/* SCORECARD */}
      {activeTab === 'scorecard' && (
        <ScorecardBuilder
          vacancy={vacancy}
          onSave={async (scorecard) => {
            await supabase.from('vacancies').update({ scorecard }).eq('id', id)
            setVacancy(prev => ({ ...prev, scorecard }))
          }}
        />
      )}

      {/* SOURCING */}
      {activeTab === 'sourcing' && (
        <SourcingTab vacancy={vacancy} profile={profile} vacancyId={id} addedIds={addedIds} setAddedIds={setAddedIds} addingId={addingId} setAddingId={setAddingId} setActiveTab={setActiveTab} />
      )}

      {/* SCREENING */}
      {activeTab === 'screening' && (
        <ScreeningPanel vacancyId={id} scorecard={vacancy?.scorecard} />
      )}

      {/* PIPELINE */}
      {activeTab === 'pipeline' && (
        <VacancyPipeline vacancyId={id} vacancy={vacancy} />
      )}

      {/* OUTREACH */}
      {activeTab === 'outreach' && (
        <div className="space-y-3">
          <div className="glass rounded-xl p-4 mb-1">
            <p className="text-sm text-gray-300">Templates para <strong className="text-white">{vacancy.title}</strong> — variables auto-rellenadas. Copia y pega en LinkedIn o Waalaxy.</p>
          </div>
          {msgTemplates.map((t, i) => (
            <div key={t.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
              <button onClick={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-primary-light/10 flex items-center justify-center text-[11px] font-bold text-primary-light">{i + 1}</span>
                  <span className="text-sm font-medium text-white">{t.name}</span>
                </div>
                {expandedTemplate === t.id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
              </button>
              {expandedTemplate === t.id && (
                <div className="px-3.5 pb-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="mt-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{replaceVars(t.body)}</pre>
                  </div>
                  <button onClick={() => copyMsg(t.body)} className="flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-primary-light/15 text-primary-light rounded text-xs font-medium hover:bg-primary-light/25">
                    {copied === t.body ? <><CheckCircle size={12} /> Copiado</> : <><Copy size={12} /> Copiar mensaje</>}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end pt-2"><button onClick={() => setActiveTab('report')} className="flex items-center gap-2 px-4 py-2 bg-primary-light text-white rounded-lg text-sm font-medium hover:bg-primary-light/90">Ver reporte <BarChart3 size={14} /></button></div>
        </div>
      )}

      {/* REPORTE EJECUTIVO */}
      {activeTab === 'report' && (
        <ExecutiveReport vacancy={vacancy} candidates={pipelineCandidates} />
      )}
    </div>
  )
}
