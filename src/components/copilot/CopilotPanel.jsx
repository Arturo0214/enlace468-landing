// CopilotPanel — widget "¿Quién está atorado?" (FASE B, §2).
//
// Carga en vivo (al montar) el pipeline activo de la org + su ficha operativa
// (candidate_pipeline_detail) + sla_rules + interacciones recientes, corre el
// motor determinista (src/lib/copilot.js) y muestra los focos priorizados con
// acción sugerida + un resumen IA opcional (/api/copilot-summary).
//
// Tolerante a tablas/campos inexistentes: cualquier query que falle (p. ej. la
// migración aún sin aplicar) se degrada a [] sin romper el panel.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, ChevronDown, ChevronUp, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { buildFocusList, buildDailyPace } from '../../lib/copilot'
import { focusIcon, severityColor, paceColor } from './focusIcons'

const CHUNK = 80        // tope duro para .in() (regla del repo: nunca >80 ids)
const MAX_VISIBLE = 8   // focos mostrados antes de "ver todos"
const INTERACTION_WINDOW_DAYS = 21

/** Lee filas en lotes de ≤80 ids sin reventar el .in(). Falla → []. */
async function fetchInChunks(table, column, ids, select) {
  if (!ids.length) return []
  const out = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in(column, ids.slice(i, i + CHUNK))
    if (error) { console.warn(`[copilot] ${table}:`, error.message); return out }
    out.push(...(data || []))
  }
  return out
}

export default function CopilotPanel() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState([])
  const [details, setDetails] = useState([])
  const [slaRules, setSlaRules] = useState([])
  const [interactions, setInteractions] = useState([])
  const [pace, setPace] = useState(null)
  const [showAll, setShowAll] = useState(false)
  // `now` capturado una vez por carga: mantiene buildFocusList puro/estable
  // (evita llamar Date.now() en render) y evita recomputar en cada tick.
  const [loadedAt, setLoadedAt] = useState(0)

  const [summary, setSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  const orgId = profile?.organization_id || null

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        // 1. Pipeline activo de vacantes abiertas (mismo criterio que cron-sla).
        const { data: cands, error: cErr } = await supabase
          .from('vacancy_candidates')
          .select('id, stage, stage_changed_at, created_at, vacancy_id, candidates(full_name), vacancies!inner(id, title, organization_id, status)')
          .eq('vacancies.organization_id', orgId)
          .eq('vacancies.status', 'open')
          .not('stage', 'in', '(hired,rejected)')
          .limit(1000)
        if (cErr) throw cErr
        const activeCands = cands || []
        const ids = activeCands.map(c => c.id)

        // 2. Ficha operativa + interacciones recientes (por lotes ≤80).
        const sinceIso = new Date(Date.now() - INTERACTION_WINDOW_DAYS * 86400000).toISOString()
        const [detailRows, slaRes, interRows] = await Promise.all([
          fetchInChunks('candidate_pipeline_detail', 'vacancy_candidate_id', ids,
            'vacancy_candidate_id, psychometric_sent_at, psychometric_result, accepted_at, docs_requested_at, docs_confirmed_at, docs_uploaded, cnsf_paid_at, cnsf_exam_date'),
          supabase.from('sla_rules').select('stage, max_days, is_active').eq('organization_id', orgId),
          fetchRecentInteractions(ids, sinceIso),
        ])

        if (cancelled) return
        setCandidates(activeCands)
        setDetails(detailRows)
        setSlaRules(slaRes.error ? [] : (slaRes.data || []))
        setInteractions(interRows)

        // 3. Ritmo del día: interacciones outbound de HOY (proxy de conexiones).
        const pace = await computeTodayPace(orgId)
        if (!cancelled) { setPace(pace); setLoadedAt(Date.now()) }
      } catch (e) {
        console.warn('[copilot] carga:', e.message)
        if (!cancelled) { setCandidates([]); setDetails([]); setSlaRules([]); setInteractions([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orgId])

  const focusList = useMemo(
    () => buildFocusList({ candidates, details, slaRules, interactions, now: loadedAt || undefined }),
    [candidates, details, slaRules, interactions, loadedAt],
  )

  // Resumen IA: se pide una vez cuando ya hay focos y pace listos.
  useEffect(() => {
    if (loading || !orgId) return
    let cancelled = false
    ;(async () => {
      setSummaryLoading(true)
      try {
        const { data: sess } = await supabase.auth.getSession()
        const token = sess?.session?.access_token
        if (!token) return
        const res = await fetch('/api/copilot-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            organization_id: orgId,
            focusList: focusList.slice(0, 50),
            pace,
          }),
        })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && json?.summary) setSummary(json.summary)
      } catch { /* silencioso: la lista se muestra sin párrafo */ }
      finally { if (!cancelled) setSummaryLoading(false) }
    })()
    return () => { cancelled = true }
    // Recalcula solo cuando cambia la firma de los focos (no en cada render).
  }, [loading, orgId, focusList.length, pace?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!orgId || loading) return null

  const visible = showAll ? focusList : focusList.slice(0, MAX_VISIBLE)
  const altas = focusList.filter(f => f.severity === 'alta').length

  return (
    <div className="glass rounded-xl mb-6">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: collapsed ? 'none' : '1px solid var(--border-default)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,169,157,0.15)' }}>
            <Compass size={17} style={{ color: '#00A99D' }} />
          </div>
          <div className="text-left">
            <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Copiloto — tu foco de hoy</h2>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {focusList.length === 0
                ? 'Sin focos pendientes'
                : `${focusList.length} foco${focusList.length === 1 ? '' : 's'}${altas > 0 ? ` · ${altas} urgente${altas === 1 ? '' : 's'}` : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pace && (
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: `${paceColor(pace.status)}22`, color: paceColor(pace.status) }}
              title={`Conexiones hoy: ${pace.sentToday}/${pace.neededPerDay} para la meta del mes`}>
              <span className="w-2 h-2 rounded-full" style={{ background: paceColor(pace.status) }} />
              {pace.sentToday}/{pace.neededPerDay} hoy
            </span>
          )}
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: 'linear-gradient(90deg, #00A99D, #071B49)' }}>
            {focusList.length}
          </span>
          {collapsed ? <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} />}
        </div>
      </button>

      {!collapsed && (
        <div className="p-5 space-y-4">
          {/* Resumen IA */}
          {(summary || summaryLoading) && (
            <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3" style={{ background: 'rgba(0,169,157,0.06)', border: '1px solid rgba(0,169,157,0.15)' }}>
              <Sparkles size={15} style={{ color: '#00A99D' }} className="flex-shrink-0 mt-0.5" />
              {summaryLoading && !summary
                ? <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Redactando tu resumen…</p>
                : <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{summary}</p>}
            </div>
          )}

          {/* Estado vacío */}
          {focusList.length === 0 ? (
            <div className="flex items-center gap-3 py-2">
              <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sin focos pendientes. Todo tu pipeline al día.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {visible.map((f, i) => {
                  const cfg = focusIcon(f.type)
                  const Icon = cfg.icon
                  return (
                    <div key={`${f.candidateId}-${f.type}-${i}`}
                      className="rounded-xl p-3.5 border transition-all flex items-start gap-3"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border-default)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}1f` }}>
                        <Icon size={15} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{f.candidateName}</span>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: severityColor(f.severity) }} title={`Severidad ${f.severity}`} />
                          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{f.vacancyTitle}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{f.message}</p>
                      </div>
                      <button
                        onClick={() => f.vacancyId && navigate(`/dashboard/vacancies/${f.vacancyId}`)}
                        disabled={!f.vacancyId}
                        className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
                        style={{ background: 'rgba(0,169,157,0.12)', color: '#00A99D' }}
                        title="Ir a la vacante del candidato">
                        <span className="hidden sm:inline">{f.action}</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {focusList.length > MAX_VISIBLE && (
                <button onClick={() => setShowAll(s => !s)} className="text-xs font-medium hover:underline" style={{ color: '#00A99D' }}>
                  {showAll ? 'Ver menos' : `Ver los ${focusList.length} focos`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Interacciones recientes de los candidatos activos (por lotes ≤80). */
async function fetchRecentInteractions(ids, sinceIso) {
  if (!ids.length) return []
  const out = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('candidate_interactions')
      .select('vacancy_candidate_id, direction, created_at')
      .in('vacancy_candidate_id', ids.slice(i, i + CHUNK))
      .gte('created_at', sinceIso)
    if (error) { console.warn('[copilot] candidate_interactions:', error.message); return out }
    out.push(...(data || []))
  }
  return out
}

/**
 * Ritmo del día: cuenta interacciones outbound de HOY en la org (proxy de
 * conexiones enviadas) vs la cuota diaria del embudo. Falla → pace null.
 */
async function computeTodayPace(orgId) {
  try {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    // candidate_interactions no tiene organization_id directo → filtro por la
    // vacante de la org vía el embed !inner.
    const { data, error } = await supabase
      .from('candidate_interactions')
      .select('id, direction, vacancy_candidates!inner(vacancies!inner(organization_id))')
      .eq('direction', 'outbound')
      .eq('vacancy_candidates.vacancies.organization_id', orgId)
      .gte('created_at', startOfDay.toISOString())
      .limit(1000)
    if (error) { console.warn('[copilot] pace:', error.message); return buildDailyPace({ connectionsToday: 0 }) }
    return buildDailyPace({ connectionsToday: (data || []).length, monthGoalFC: 3 })
  } catch (e) {
    console.warn('[copilot] pace:', e.message)
    return buildDailyPace({ connectionsToday: 0 })
  }
}
