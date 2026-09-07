// ---------------------------------------------------------------------------
// Centro de Depuración (FASE 2) — higiene de la base de candidatos.
//
// Tab "Extranjeros":   corre el diagnóstico anti-extranjeros (checkForeign,
//                      mismas señales que el sourcing) sobre TODO el banco de
//                      la org y sobre los candidatos activos en pipelines.
// Tab "Desactualizados": lee los verify_status que deja el cron de verificación
//                      (cambio_empleo / desactualizado / link_muerto / fantasma).
//
// Nada se borra: banco → source='descartado' + nota con la razón; pipeline →
// stage='rejected' + rejection_reason. Y SIEMPRE con revisión humana antes
// (checkboxes + confirmación) — Karina aprueba purgas, nunca descarte silencioso.
// ---------------------------------------------------------------------------
import { useState } from 'react'
import { Globe, Clock, AlertTriangle, Loader2, ExternalLink, CheckSquare, Square, Trash2, RefreshCw, ShieldQuestion } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { checkForeign } from '../../lib/promote'
import { verifyBadge } from '../../lib/verifyBadge'

const PAGE = 1000 // paginado de lectura (el límite de 80 es solo para .in() con ids)
const STALE_STATUSES = ['cambio_empleo', 'desactualizado', 'link_muerto', 'fantasma']

/** Trae todas las páginas de una query supabase (fn recibe from,to y regresa el builder). */
async function fetchAll(buildQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

/** Ejecuta updates fila por fila en tandas chicas (notas distintas por fila). */
async function updateRowByRow(rows, doUpdate, concurrency = 8) {
  for (let i = 0; i < rows.length; i += concurrency) {
    const errors = await Promise.all(rows.slice(i, i + concurrency).map(r => doUpdate(r).then(({ error }) => error)))
    const err = errors.find(Boolean)
    if (err) throw err
  }
}

function stampNote(existing, reason) {
  const stamp = `[Depuracion ${new Date().toLocaleDateString('es-MX')}] ${reason}`
  return existing ? `${existing}\n${stamp}` : stamp
}

export default function CleanupCenter() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('foreign')

  // Estado por tab: { rows, scanned, unavailable } + selección compartida por tab
  const [state, setState] = useState({
    foreign: { rows: [], scanned: false },
    stale: { rows: [], scanned: false, unavailable: false },
  })
  const [selected, setSelected] = useState(new Set())
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [discarding, setDiscarding] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [doneMsg, setDoneMsg] = useState(null)

  const current = state[tab]
  const rows = current.rows
  const selectedRows = rows.filter(r => selected.has(r.key))

  function setTabState(t, patch) {
    setState(prev => ({ ...prev, [t]: { ...prev[t], ...patch } }))
  }

  function switchTab(t) {
    setTab(t)
    setSelected(new Set(state[t].rows.map(r => r.key)))
    setConfirming(false)
    setError(null)
    setDoneMsg(null)
  }

  function toggle(key) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setConfirming(false)
  }

  function toggleAll() {
    setSelected(prev => (prev.size === rows.length ? new Set() : new Set(rows.map(r => r.key))))
    setConfirming(false)
  }

  // ── Diagnóstico "Extranjeros" ──────────────────────────────────
  async function scanForeign() {
    setScanning(true)
    setError(null)
    setDoneMsg(null)
    try {
      // 1. Banco de sourcing completo de la org (todas las vacantes), sin los
      //    ya descartados. Paginado: el banco puede tener miles de filas.
      const bank = await fetchAll((from, to) => supabase
        .from('sourcing_bank')
        .select('id, vacancy_id, title, full_name, current_title, current_company, snippet, url, notes, source')
        .eq('organization_id', profile.organization_id)
        .neq('source', 'descartado')
        .order('id')
        .range(from, to))

      // 2. Candidatos ACTIVOS en pipelines (RLS acota a la org vía vacancies).
      const vcs = await fetchAll((from, to) => supabase
        .from('vacancy_candidates')
        .select('id, stage, vacancy_id, candidates(id, full_name, current_title, current_company, notes, linkedin_url, location)')
        .not('stage', 'in', '(hired,rejected)')
        .order('id')
        .range(from, to))

      const found = []
      for (const item of bank) {
        const { foreign, reason } = checkForeign(item)
        if (foreign) {
          found.push({
            key: `bank:${item.id}`, kind: 'bank', id: item.id, reason,
            name: item.full_name || item.title || 'Sin nombre',
            subtitle: [item.current_title, item.current_company].filter(Boolean).join(' · ') || item.snippet?.slice(0, 90),
            url: item.url || null, notes: item.notes || null,
          })
        }
      }
      for (const vc of vcs) {
        const c = vc.candidates || {}
        const { foreign, reason } = checkForeign({
          full_name: c.full_name, current_title: c.current_title, current_company: c.current_company,
          notes: c.notes, location: c.location, url: c.linkedin_url,
        })
        if (foreign) {
          found.push({
            key: `vc:${vc.id}`, kind: 'pipeline', id: vc.id, reason,
            name: c.full_name || 'Sin nombre',
            subtitle: [c.current_title, c.current_company].filter(Boolean).join(' · '),
            url: c.linkedin_url || null, stage: vc.stage,
          })
        }
      }
      setTabState('foreign', { rows: found, scanned: true })
      setSelected(new Set(found.map(r => r.key))) // default: todo marcado
    } catch (e) {
      setError(e.message || 'Error al diagnosticar')
    } finally {
      setScanning(false)
    }
  }

  // ── Diagnóstico "Desactualizados" ──────────────────────────────
  async function scanStale() {
    setScanning(true)
    setError(null)
    setDoneMsg(null)
    try {
      const bank = await fetchAll((from, to) => supabase
        .from('sourcing_bank')
        .select('id, title, full_name, current_title, current_company, url, notes, verify_status, last_verified_at')
        .eq('organization_id', profile.organization_id)
        .neq('source', 'descartado')
        .in('verify_status', STALE_STATUSES)
        .order('id')
        .range(from, to))

      const cands = await fetchAll((from, to) => supabase
        .from('candidates')
        .select('id, full_name, current_title, current_company, linkedin_url, notes, verify_status, last_verified_at')
        .eq('organization_id', profile.organization_id)
        .in('verify_status', STALE_STATUSES)
        .order('id')
        .range(from, to))

      const found = [
        ...bank.map(item => ({
          key: `bank:${item.id}`, kind: 'bank', id: item.id,
          reason: `verificacion: ${item.verify_status}`,
          name: item.full_name || item.title || 'Sin nombre',
          subtitle: [item.current_title, item.current_company].filter(Boolean).join(' · '),
          url: item.url || null, notes: item.notes || null,
          verifyStatus: item.verify_status, lastVerifiedAt: item.last_verified_at,
        })),
        ...cands.map(c => ({
          key: `cand:${c.id}`, kind: 'candidate', id: c.id,
          reason: `verificacion: ${c.verify_status}`,
          name: c.full_name || 'Sin nombre',
          subtitle: [c.current_title, c.current_company].filter(Boolean).join(' · '),
          url: c.linkedin_url || null, notes: c.notes || null,
          verifyStatus: c.verify_status, lastVerifiedAt: c.last_verified_at,
        })),
      ]
      setTabState('stale', { rows: found, scanned: true, unavailable: false })
      setSelected(new Set(found.map(r => r.key)))
    } catch (e) {
      // Columnas verify_status aún no existen en prod (migración local sin
      // aplicar / el cron no ha corrido) → estado vacío informativo.
      if (e?.code === '42703' || /column|verify_status/i.test(e?.message || '')) {
        setTabState('stale', { rows: [], scanned: true, unavailable: true })
        setSelected(new Set())
      } else {
        setError(e.message || 'Error al diagnosticar')
      }
    } finally {
      setScanning(false)
    }
  }

  // ── Descarte (aprobado por el reclutador) ──────────────────────
  async function discardSelected() {
    if (!selectedRows.length) return
    setDiscarding(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      const reasonPrefix = tab === 'foreign' ? 'Extranjero' : 'Perfil desactualizado'

      // Banco → source='descartado' + nota con la razón (fila por fila: la
      // nota es distinta en cada una).
      const bankRows = selectedRows.filter(r => r.kind === 'bank')
      await updateRowByRow(bankRows, r => supabase
        .from('sourcing_bank')
        .update({ source: 'descartado', notes: stampNote(r.notes, `${reasonPrefix}: ${r.reason}`) })
        .eq('id', r.id))

      // Pipeline → rejected + rejection_reason (mismo payload → lotes de ≤80).
      const vcIds = selectedRows.filter(r => r.kind === 'pipeline').map(r => r.id)
      for (let i = 0; i < vcIds.length; i += 80) {
        const { error: vcError } = await supabase
          .from('vacancy_candidates')
          .update({ stage: 'rejected', stage_changed_at: now, rejection_reason: 'foreign_profile' })
          .in('id', vcIds.slice(i, i + 80))
        if (vcError) throw vcError
      }

      // Candidatos desactualizados → nota en el candidato + rechazar sus
      // procesos ACTIVOS (el candidato no se borra del banco).
      const candRows = selectedRows.filter(r => r.kind === 'candidate')
      await updateRowByRow(candRows, r => supabase
        .from('candidates')
        .update({ notes: stampNote(r.notes, `${reasonPrefix}: ${r.reason}`) })
        .eq('id', r.id))
      const candIds = candRows.map(r => r.id)
      for (let i = 0; i < candIds.length; i += 80) {
        const { error: rejError } = await supabase
          .from('vacancy_candidates')
          .update({ stage: 'rejected', stage_changed_at: now, rejection_reason: 'stale_profile' })
          .in('candidate_id', candIds.slice(i, i + 80))
          .not('stage', 'in', '(hired,rejected)')
        if (rejError) throw rejError
      }

      // Bitácora de la purga (quién aprobó y cuántos).
      await supabase.from('activity_log').insert({
        organization_id: profile.organization_id,
        entity_type: 'cleanup',
        entity_id: profile.id,
        action: `Depuracion: ${selectedRows.length} perfil${selectedRows.length === 1 ? '' : 'es'} descartado${selectedRows.length === 1 ? '' : 's'} (${tab === 'foreign' ? 'extranjeros' : 'desactualizados'})`,
        details: { tab, count: selectedRows.length, bank: bankRows.length, pipeline: vcIds.length, candidates: candIds.length },
        performed_by: profile.id,
      })

      const discardedKeys = new Set(selectedRows.map(r => r.key))
      setTabState(tab, { rows: rows.filter(r => !discardedKeys.has(r.key)) })
      setSelected(new Set())
      setConfirming(false)
      setDoneMsg(`${selectedRows.length} perfil${selectedRows.length === 1 ? '' : 'es'} descartado${selectedRows.length === 1 ? '' : 's'}. Nada se borro: quedan marcados con la razon.`)
    } catch (e) {
      setError(e.message || 'Error al descartar')
    } finally {
      setDiscarding(false)
    }
  }

  const scan = tab === 'foreign' ? scanForeign : scanStale
  const allSelected = rows.length > 0 && selected.size === rows.length

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-white mb-1">Depuracion</h1>
        <p className="text-sm text-gray-400">Higiene de la base: perfiles extranjeros y desactualizados, siempre con revision antes de descartar</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { id: 'foreign', label: 'Extranjeros', icon: Globe },
          { id: 'stale', label: 'Desactualizados', icon: Clock },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => switchTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === id ? 'border-primary text-primary-light' : 'border-transparent text-gray-400 hover:text-white'
            }`}>
            <Icon size={16} /> {label}
            {state[id].scanned && state[id].rows.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">{state[id].rows.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Banner de falsos positivos */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-4">
        <AlertTriangle size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-300/90 leading-relaxed">
          Revisa antes de descartar — los nombres/colonias mexicanas (Roma, Leon...) pueden dar falsos positivos.
          Desmarca cualquier perfil que si sea de Mexico. Nada se elimina: los descartados quedan marcados con la razon.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={scan} disabled={scanning || discarding}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {scanning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {scanning ? 'Diagnosticando...' : current.scanned ? 'Volver a diagnosticar' : 'Ejecutar diagnostico'}
        </button>

        {rows.length > 0 && (
          <>
            <button onClick={toggleAll} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
              {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
              {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
            {!confirming ? (
              <button onClick={() => setConfirming(true)} disabled={selectedRows.length === 0 || discarding}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40">
                <Trash2 size={14} /> Descartar seleccionados ({selectedRows.length})
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">¿Confirmas el descarte de {selectedRows.length}?</span>
                <button onClick={discardSelected} disabled={discarding}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
                  {discarding ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Si, descartar
                </button>
                <button onClick={() => setConfirming(false)} disabled={discarding}
                  className="px-3 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300 mb-4">{error}</div>
      )}
      {doneMsg && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300 mb-4">{doneMsg}</div>
      )}

      {/* Resultados */}
      {!current.scanned ? (
        <div className="glass rounded-xl text-center py-14">
          <ShieldQuestion size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm text-gray-400 mb-1">
            {tab === 'foreign'
              ? 'Ejecuta el diagnostico para revisar el banco y los pipelines de toda la organizacion'
              : 'Ejecuta el diagnostico para revisar los perfiles marcados por la verificacion automatica'}
          </p>
          <p className="text-xs text-gray-600">El diagnostico no cambia nada: solo lista los sospechosos para tu revision</p>
        </div>
      ) : tab === 'stale' && current.unavailable ? (
        <div className="glass rounded-xl text-center py-14">
          <Clock size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm text-gray-400 mb-1">La verificacion automatica aun no corre</p>
          <p className="text-xs text-gray-600">Cuando el cron de verificacion marque perfiles (cambio de empleo, links muertos...), apareceran aqui</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl text-center py-14">
          <CheckSquare size={32} className="mx-auto text-emerald-500/60 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Sin perfiles {tab === 'foreign' ? 'extranjeros detectados' : 'desactualizados pendientes'}</p>
          <p className="text-xs text-gray-600">La base esta limpia en esta categoria</p>
        </div>
      ) : (
        <div className="glass rounded-xl divide-y divide-white/5 overflow-hidden">
          {rows.map(r => {
            const vb = r.verifyStatus ? verifyBadge(r.verifyStatus) : null
            return (
              <div key={r.key} className={`flex items-start gap-3 px-4 py-3 transition-colors ${selected.has(r.key) ? 'bg-red-500/[0.03]' : ''}`}>
                <button onClick={() => toggle(r.key)} className="mt-0.5 text-gray-400 hover:text-white flex-shrink-0">
                  {selected.has(r.key) ? <CheckSquare size={16} className="text-red-400" /> : <Square size={16} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{r.name}</span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      r.kind === 'pipeline' ? 'bg-purple-500/15 text-purple-300' : r.kind === 'candidate' ? 'bg-blue-500/15 text-blue-300' : 'bg-teal-500/15 text-teal-300'
                    }`}>
                      {r.kind === 'pipeline' ? 'En pipeline' : r.kind === 'candidate' ? 'Candidato' : 'Banco'}
                    </span>
                    {vb && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: vb.bg, color: vb.fg }}>
                        {vb.icon} {vb.label}
                      </span>
                    )}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener" className="text-primary-light/70 hover:text-primary-light flex-shrink-0">
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  {r.subtitle && <p className="text-xs text-gray-500 truncate mt-0.5">{r.subtitle}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-red-500/10 text-red-300/90 border border-red-500/15">
                      {r.reason}
                    </span>
                    {r.lastVerifiedAt && (
                      <span className="text-[10px] text-gray-600">
                        Verificado: {new Date(r.lastVerifiedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
