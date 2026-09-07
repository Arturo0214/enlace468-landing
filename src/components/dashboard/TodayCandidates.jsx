// "Candidatos de hoy" — lo que el sourcing nocturno (cron-auto-source, L-V
// 4/5/6am CDMX) dejó en sourcing_bank en las últimas 24h, agrupado por
// vacante y rankeado por score, con promover/descartar en 1 clic.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sunrise, Loader2, Plus, Ban, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { promoteBankItem } from '../../lib/promote'

const scoreBadgeColor = s => (s >= 75 ? '#00A99D' : s >= 60 ? '#f59e0b' : '#9ca3af')

export default function TodayCandidates() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null) // id en promoción/descarte
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!profile?.organization_id) return
    let cancelled = false
    ;(async () => {
      try {
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        const { data, error } = await supabase
          .from('sourcing_bank')
          .select('*, vacancies(title)')
          .eq('organization_id', profile.organization_id)
          .eq('source', 'auto-sourced') // los descartados cambian de source → quedan fuera
          .is('candidate_id', null)     // los ya promovidos quedan fuera
          .gte('created_at', since)
          .order('score', { ascending: false, nullsFirst: false })
        if (error) throw error
        if (!cancelled) setItems(data || [])
      } catch (e) {
        console.error('TodayCandidates:', e)
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [profile?.organization_id])

  async function promote(item) {
    setBusyId(item.id)
    try {
      const data = await promoteBankItem(supabase, { item, vacancyId: item.vacancy_id, profile })
      if (data) setItems(prev => prev.filter(i => i.id !== item.id))
    } catch (e) { console.error(e) }
    finally { setBusyId(null) }
  }

  // Mismo criterio que SourcingTab: descartar = source='descartado' en el
  // banco → no vuelve a aparecer en ninguna búsqueda de la organización.
  async function discard(item) {
    setBusyId(item.id)
    try {
      const { error } = await supabase.from('sourcing_bank')
        .update({ source: 'descartado' }).eq('id', item.id)
      if (error) throw error
      setItems(prev => prev.filter(i => i.id !== item.id))
    } catch (e) { console.error(e) }
    finally { setBusyId(null) }
  }

  if (loading) return null

  // Sin candidatos hoy → una sola línea (el estado vacío honesto).
  if (items.length === 0) {
    return (
      <div className="glass rounded-xl px-5 py-3 mb-6 flex items-center gap-3">
        <Sunrise size={16} style={{ color: '#00A99D' }} className="flex-shrink-0" />
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-white">Candidatos de hoy — 0 nuevos.</span>{' '}
          El sourcing nocturno corre L-V a las 4-6am (CDMX); actívalo con el switch "Sourcing nocturno automático" en la pestaña Sourcing de tus vacantes.
        </p>
      </div>
    )
  }

  // Agrupar por vacante conservando el orden global (score desc)
  const groups = []
  const byVac = new Map()
  for (const it of items) {
    if (!byVac.has(it.vacancy_id)) {
      const g = { vacancyId: it.vacancy_id, title: it.vacancies?.title || 'Vacante', items: [] }
      byVac.set(it.vacancy_id, g)
      groups.push(g)
    }
    byVac.get(it.vacancy_id).items.push(it)
  }

  return (
    <div className="glass rounded-xl mb-6">
      <button onClick={() => setCollapsed(c => !c)} className="w-full px-5 py-4 flex items-center justify-between" style={{ borderBottom: collapsed ? 'none' : '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,169,157,0.15)' }}>
            <Sunrise size={17} style={{ color: '#00A99D' }} />
          </div>
          <div className="text-left">
            <h2 className="font-display font-semibold text-white">Candidatos de hoy</h2>
            <p className="text-[11px] text-gray-500">{items.length} nuevo{items.length === 1 ? '' : 's'} del sourcing nocturno · rankeados por score</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}>{items.length}</span>
          {collapsed ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronUp size={16} className="text-gray-500" />}
        </div>
      </button>

      {!collapsed && (
        <div className="p-5 space-y-5">
          {groups.map(g => (
            <div key={g.vacancyId}>
              <div className="flex items-center justify-between mb-2">
                <Link to={`/dashboard/vacancies/${g.vacancyId}`} className="text-xs font-semibold text-gray-300 hover:text-white transition-colors">
                  {g.title} <span className="text-gray-500 font-normal">· {g.items.length}</span>
                </Link>
              </div>
              <div className="space-y-2">
                {g.items.map(it => {
                  const score = it.score == null ? null : Math.round(Number(it.score))
                  const busy = busyId === it.id
                  return (
                    <div key={it.id} className="rounded-xl p-3.5 border transition-all bg-white/[0.02] border-white/[0.05] hover:border-white/[0.12]">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: scoreBadgeColor(score ?? 0) }}>
                          {score ?? '—'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <a href={it.url} target="_blank" rel="noopener" className="text-sm font-semibold text-white hover:text-primary-light transition-colors line-clamp-1">
                            {it.full_name || it.title}
                          </a>
                          {(it.current_title || it.current_company) && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">{[it.current_title, it.current_company].filter(Boolean).join(' · ')}</p>
                          )}
                          {it.score_details?.strengths?.length > 0 && (
                            <p className="text-[11px] mt-1" style={{ color: 'rgba(0,169,157,0.85)' }}>✓ {it.score_details.strengths.join(' · ')}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                          <button onClick={() => promote(it)} disabled={busy}
                            className="px-2.5 py-1.5 text-[11px] bg-primary-light/15 text-primary-light rounded-lg font-medium hover:bg-primary-light/25 disabled:opacity-40 flex items-center gap-1 transition-all"
                            title="Crear candidato y agregarlo al pipeline de la vacante">
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Promover al pipeline
                          </button>
                          <button onClick={() => discard(it)} disabled={busy}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                            title="Descartar — no volverá a aparecer">
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                          </button>
                          <a href={it.url} target="_blank" rel="noopener" className="p-1.5 rounded-lg text-gray-600 hover:text-primary-light hover:bg-primary-light/10 transition-all">
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
