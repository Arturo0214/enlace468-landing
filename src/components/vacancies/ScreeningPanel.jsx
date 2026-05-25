import { useEffect, useState, useMemo } from 'react'
import { Search, SlidersHorizontal, ArrowUpDown, Users, Star, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, HelpCircle, ThumbsUp, ThumbsDown, MessageSquare, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'

const RECOMMENDATION_BADGES = {
  advance: { label: 'Avanzar', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', icon: ThumbsUp },
  evaluate: { label: 'Evaluar mas', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', icon: HelpCircle },
  reject: { label: 'No viable', color: 'bg-red-500/15 text-red-400 border-red-500/20', icon: ThumbsDown },
}

function scoreColor(score) {
  if (score >= 4) return 'text-emerald-400'
  if (score >= 3) return 'text-amber-400'
  if (score >= 2) return 'text-orange-400'
  return 'text-red-400'
}

function scoreBg(score) {
  if (score >= 4) return 'bg-emerald-400'
  if (score >= 3) return 'bg-amber-400'
  if (score >= 2) return 'bg-orange-400'
  return 'bg-red-400'
}

function matchColor(pct) {
  if (pct >= 80) return 'text-emerald-400'
  if (pct >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function matchBg(pct) {
  if (pct >= 80) return 'bg-emerald-400'
  if (pct >= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function ScreeningPanel({ vacancyId, scorecard }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('score_desc')
  const [filterRec, setFilterRec] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [compareIds, setCompareIds] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const criteriaNames = scorecard?.criteria?.map(c => c.name) || []

  useEffect(() => { loadCandidates() }, [vacancyId])

  async function loadCandidates() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vacancy_candidates')
      .select('*, candidates(full_name, current_title, current_company, email, linkedin_url)')
      .eq('vacancy_id', vacancyId)
      .order('created_at')

    if (!error && data) {
      setCandidates(data.map(vc => {
        const md = vc.match_details || {}
        return {
          id: vc.id,
          candidateId: vc.candidate_id,
          name: vc.candidates?.full_name || 'Sin nombre',
          title: vc.candidates?.current_title || '',
          company: vc.candidates?.current_company || '',
          matchScore: vc.match_score,
          overallScore: md.overallScore || 0,
          scores: md.scores || {},
          evidence: md.evidence || {},
          greenFlags: md.greenFlags || {},
          redFlags: md.redFlags || {},
          recommendation: md.recommendation || '',
          strengths: (md.criteria || scorecard?.criteria || []).filter(c => (md.scores?.[c.name] || 0) >= 4),
          gaps: (md.criteria || scorecard?.criteria || []).filter(c => (md.scores?.[c.name] || 0) <= 2 && md.scores?.[c.name] != null),
          pending: (md.criteria || scorecard?.criteria || []).filter(c => md.scores?.[c.name] == null),
          stage: vc.stage,
        }
      }))
    }
    setLoading(false)
  }

  // Filtered and sorted candidates
  const displayed = useMemo(() => {
    let list = [...candidates]

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q)
      )
    }

    // Filter by recommendation
    if (filterRec !== 'all') {
      list = list.filter(c => c.recommendation === filterRec)
    }

    // Sort
    switch (sortBy) {
      case 'score_desc':
        list.sort((a, b) => (b.overallScore || b.matchScore || 0) - (a.overallScore || a.matchScore || 0))
        break
      case 'score_asc':
        list.sort((a, b) => (a.overallScore || a.matchScore || 0) - (b.overallScore || b.matchScore || 0))
        break
      case 'name_asc':
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'match_desc':
        list.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        break
    }

    return list
  }, [candidates, searchTerm, sortBy, filterRec])

  // Compare candidates
  function toggleCompare(id) {
    setCompareIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 4 ? [...prev, id] : prev
    )
  }

  const compareCandidates = useMemo(
    () => compareIds.map(id => candidates.find(c => c.id === id)).filter(Boolean),
    [compareIds, candidates]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary-light" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* AI Disclaimer Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20"
      >
        <Search size={18} className="text-blue-400 flex-shrink-0" />
        <p className="text-sm text-blue-300/90">
          Analisis asistido por IA — La plataforma no decide. Requiere revision humana.
        </p>
      </motion.div>

      {/* Controls bar */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar candidato..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] focus:border-primary-light/40 outline-none text-sm text-white placeholder-gray-600"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-300 focus:border-primary-light/40 outline-none cursor-pointer"
            >
              <option value="score_desc">Mayor puntaje</option>
              <option value="score_asc">Menor puntaje</option>
              <option value="match_desc">Mayor match</option>
              <option value="name_asc">Nombre A-Z</option>
            </select>
            <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all ${
              showFilters || filterRec !== 'all'
                ? 'border-primary-light/30 bg-primary-light/10 text-primary-light'
                : 'border-white/[0.08] bg-white/[0.04] text-gray-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal size={12} /> Filtros
          </button>

          {/* Compare button */}
          {compareIds.length >= 2 && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => setShowCompare(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-primary to-primary-light text-white text-xs font-medium hover:opacity-90"
            >
              <Users size={12} /> Comparar ({compareIds.length})
            </motion.button>
          )}
        </div>

        {/* Filter bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-3 mt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider self-center mr-1">Recomendacion:</span>
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'advance', label: 'Avanzar' },
                  { id: 'evaluate', label: 'Evaluar mas' },
                  { id: 'reject', label: 'No viable' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilterRec(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all ${
                      filterRec === f.id
                        ? 'border-primary-light/30 bg-primary-light/10 text-primary-light'
                        : 'border-white/[0.06] text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-white">{displayed.length}</span> candidato{displayed.length !== 1 ? 's' : ''}
        </p>
        {compareIds.length > 0 && (
          <button onClick={() => setCompareIds([])} className="text-[10px] text-gray-500 hover:text-gray-300">
            Limpiar seleccion
          </button>
        )}
      </div>

      {/* Candidate cards */}
      <div className="space-y-2">
        {displayed.map((c, idx) => {
          const isExpanded = expandedId === c.id
          const isComparing = compareIds.includes(c.id)
          const recBadge = RECOMMENDATION_BADGES[c.recommendation]
          const RecIcon = recBadge?.icon

          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`glass rounded-xl overflow-hidden transition-all ${
                isComparing ? 'ring-1 ring-primary-light/30' : ''
              }`}
            >
              {/* Header row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02]"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
              >
                {/* Compare checkbox */}
                <button
                  onClick={e => { e.stopPropagation(); toggleCompare(c.id) }}
                  className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                    isComparing
                      ? 'border-primary-light bg-primary-light/20 text-primary-light'
                      : 'border-white/[0.1] hover:border-white/[0.2]'
                  }`}
                >
                  {isComparing && <CheckCircle size={11} />}
                </button>

                {/* Rank number */}
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                  {idx + 1}
                </div>

                {/* Name and title */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{c.name}</h3>
                    {recBadge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${recBadge.color} flex items-center gap-1`}>
                        {RecIcon && <RecIcon size={9} />} {recBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {c.title}{c.company ? ` · ${c.company}` : ''}
                  </p>
                </div>

                {/* Match score */}
                {c.matchScore != null && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Star size={12} className="text-amber-500" />
                    <span className={`text-sm font-bold ${matchColor(c.matchScore)}`}>
                      {Math.round(c.matchScore)}%
                    </span>
                  </div>
                )}

                {/* Mini criteria bars */}
                {criteriaNames.length > 0 && Object.keys(c.scores).length > 0 && (
                  <div className="hidden sm:flex items-end gap-0.5 h-6 flex-shrink-0">
                    {criteriaNames.slice(0, 6).map(name => {
                      const val = c.scores[name] || 0
                      return (
                        <div key={name} className="w-2 rounded-full bg-white/[0.06] h-full relative" title={`${name}: ${val}/5`}>
                          <div
                            className={`absolute bottom-0 w-full rounded-full ${scoreBg(val)}`}
                            style={{ height: `${(val / 5) * 100}%` }}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Overall score gauge */}
                {c.overallScore > 0 && (
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        className={`${scoreBg(c.overallScore).replace('bg-', 'stroke-')}`}
                        strokeWidth="3"
                        strokeDasharray={`${(c.overallScore / 5) * 100}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor(c.overallScore)}`}>
                      {c.overallScore.toFixed(1)}
                    </span>
                  </div>
                )}

                {isExpanded ? <ChevronUp size={14} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />}
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-0 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      {/* Per-criterion bars */}
                      {criteriaNames.length > 0 && (
                        <div className="pt-3">
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Criterios</p>
                          <div className="space-y-1.5">
                            {criteriaNames.map(name => {
                              const val = c.scores[name] || 0
                              const criterion = scorecard?.criteria?.find(cr => cr.name === name)
                              return (
                                <div key={name} className="flex items-center gap-3">
                                  <span className="text-[11px] text-gray-400 w-36 truncate" title={name}>{name}</span>
                                  <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${scoreBg(val)}`}
                                      style={{ width: `${(val / 5) * 100}%` }}
                                    />
                                  </div>
                                  <span className={`text-[11px] font-medium w-6 text-right ${scoreColor(val)}`}>{val || '-'}</span>
                                  {criterion?.weight && (
                                    <span className="text-[9px] text-gray-600 w-8">{criterion.weight}%</span>
                                  )}
                                  {c.greenFlags[name] && <CheckCircle size={10} className="text-emerald-400" />}
                                  {c.redFlags[name] && <XCircle size={10} className="text-red-400" />}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Strengths */}
                      {c.strengths.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Fortalezas</p>
                          <div className="flex flex-wrap gap-1">
                            {c.strengths.map(s => (
                              <span key={s.name} className="text-[10px] px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gaps */}
                      {c.gaps.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Brechas</p>
                          <div className="flex flex-wrap gap-1">
                            {c.gaps.map(g => (
                              <span key={g.name} className="text-[10px] px-2 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">
                                {g.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pending */}
                      {c.pending.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Pendientes</p>
                          <div className="flex flex-wrap gap-1">
                            {c.pending.map(p => (
                              <span key={p.name} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.06]">
                                {p.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Empty state */}
      {displayed.length === 0 && !loading && (
        <div className="glass rounded-xl py-12 text-center">
          <Users size={32} className="mx-auto text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">
            {candidates.length === 0
              ? 'No hay candidatos en esta vacante'
              : 'Ningun candidato coincide con los filtros'}
          </p>
        </div>
      )}

      {/* ─── Compare side-by-side modal ─── */}
      <AnimatePresence>
        {showCompare && compareCandidates.length >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCompare(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111827] rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-auto border border-white/[0.08]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <h2 className="text-base font-display font-bold text-white">Comparar candidatos</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">{compareCandidates.length} candidatos seleccionados</p>
                </div>
                <button onClick={() => setShowCompare(false)} className="text-gray-500 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>

              {/* Comparison table */}
              <div className="p-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 pr-4 text-[10px] text-gray-500 uppercase tracking-wider font-semibold w-40">Criterio</th>
                      {compareCandidates.map(c => (
                        <th key={c.id} className="py-2 px-3 text-center">
                          <div className="text-xs font-medium text-white">{c.name}</div>
                          <div className="text-[10px] text-gray-500 truncate max-w-[140px] mx-auto">{c.title}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Match score row */}
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-2.5 pr-4 text-[11px] text-gray-400">Match score</td>
                      {compareCandidates.map(c => (
                        <td key={c.id} className="py-2.5 px-3 text-center">
                          {c.matchScore != null ? (
                            <span className={`text-sm font-bold ${matchColor(c.matchScore)}`}>{Math.round(c.matchScore)}%</span>
                          ) : <span className="text-gray-600">-</span>}
                        </td>
                      ))}
                    </tr>

                    {/* Overall score row */}
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-2.5 pr-4 text-[11px] text-gray-400 font-medium">Puntaje global</td>
                      {compareCandidates.map(c => (
                        <td key={c.id} className="py-2.5 px-3 text-center">
                          <span className={`text-base font-bold ${scoreColor(c.overallScore)}`}>
                            {c.overallScore ? c.overallScore.toFixed(1) : '-'}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Criteria rows */}
                    {criteriaNames.map(name => (
                      <tr key={name} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="py-2.5 pr-4 text-[11px] text-gray-400 truncate max-w-[160px]" title={name}>{name}</td>
                        {compareCandidates.map(c => {
                          const val = c.scores[name] || 0
                          return (
                            <td key={c.id} className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${scoreBg(val)}`} style={{ width: `${(val / 5) * 100}%` }} />
                                </div>
                                <span className={`text-xs font-medium ${scoreColor(val)}`}>{val || '-'}</span>
                                {c.greenFlags[name] && <CheckCircle size={9} className="text-emerald-400" />}
                                {c.redFlags[name] && <XCircle size={9} className="text-red-400" />}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}

                    {/* Recommendation row */}
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td className="py-3 pr-4 text-[11px] text-gray-400 font-medium">Recomendacion</td>
                      {compareCandidates.map(c => {
                        const badge = RECOMMENDATION_BADGES[c.recommendation]
                        const BadgeIcon = badge?.icon
                        return (
                          <td key={c.id} className="py-3 px-3 text-center">
                            {badge ? (
                              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-medium border ${badge.color}`}>
                                {BadgeIcon && <BadgeIcon size={10} />} {badge.label}
                              </span>
                            ) : <span className="text-gray-600 text-[11px]">Sin evaluar</span>}
                          </td>
                        )
                      })}
                    </tr>

                    {/* Strengths row */}
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-2.5 pr-4 text-[11px] text-gray-400 align-top">Fortalezas</td>
                      {compareCandidates.map(c => (
                        <td key={c.id} className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {c.strengths.length > 0
                              ? c.strengths.map(s => (
                                <span key={s.name} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400">{s.name}</span>
                              ))
                              : <span className="text-[10px] text-gray-600">-</span>
                            }
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* Gaps row */}
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-2.5 pr-4 text-[11px] text-gray-400 align-top">Brechas</td>
                      {compareCandidates.map(c => (
                        <td key={c.id} className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {c.gaps.length > 0
                              ? c.gaps.map(g => (
                                <span key={g.name} className="text-[9px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">{g.name}</span>
                              ))
                              : <span className="text-[10px] text-gray-600">-</span>
                            }
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
