import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Users, Clock, AlertTriangle, TrendingUp, Star, Zap, ExternalLink, Globe, UserPlus, FileText, X, Mail, Phone, MapPin, Briefcase, Trash2, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const STAGES = [
  { id: 'sourced', label: 'Sourced', color: 'border-gray-400', bg: 'bg-gray-400', sla: 3 },
  { id: 'contacted', label: 'Contactado', color: 'border-blue-400', bg: 'bg-blue-400', sla: 2 },
  { id: 'screening', label: 'Screening', color: 'border-cyan-400', bg: 'bg-cyan-400', sla: 3 },
  { id: 'interviewing', label: 'Entrevista', color: 'border-purple-400', bg: 'bg-purple-400', sla: 5 },
  { id: 'shortlist', label: 'Shortlist', color: 'border-amber-400', bg: 'bg-amber-400', sla: 3 },
  { id: 'presented', label: 'Presentado', color: 'border-accent', bg: 'bg-accent', sla: 5 },
  { id: 'offer', label: 'Oferta', color: 'border-green-400', bg: 'bg-green-400', sla: 3 },
  { id: 'hired', label: 'Contratado', color: 'border-emerald-500', bg: 'bg-emerald-500', sla: null },
  { id: 'rejected', label: 'Rechazado', color: 'border-red-400', bg: 'bg-red-400', sla: null },
]

const SOURCE_ICONS = {
  linkedin: ExternalLink,
  referral: UserPlus,
  jobboard: Globe,
  internal: FileText,
}

const SOURCE_COLORS = {
  linkedin: 'bg-blue-500/15 text-blue-400',
  referral: 'bg-purple-500/15 text-purple-400',
  jobboard: 'bg-cyan-500/15 text-cyan-400',
  internal: 'bg-amber-500/15 text-amber-400',
}

function daysInStage(stageChangedAt) {
  if (!stageChangedAt) return 0
  return Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / (1000 * 60 * 60 * 24))
}

function agingColor(days, sla) {
  if (!sla) return 'text-gray-500'
  if (days <= sla * 0.5) return 'text-emerald-400'
  if (days <= sla) return 'text-amber-400'
  return 'text-red-400'
}

function agingBg(days, sla) {
  if (!sla) return 'bg-gray-500/10'
  if (days <= sla * 0.5) return 'bg-emerald-500/10'
  if (days <= sla) return 'bg-amber-500/10'
  return 'bg-red-500/10'
}

function initials(name) {
  if (!name) return '??'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function scoreColor(score) {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  return 'bg-red-500/20 text-red-400 border-red-500/30'
}

export default function PipelineKanban({ vacancyId, vacancyTitle }) {
  const { profile } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedVC, setSelectedVC] = useState(null)
  const [deleting, setDeleting] = useState(null)

  async function removeFromPipeline(vcId) {
    setDeleting(vcId)
    await supabase.from('vacancy_candidates').delete().eq('id', vcId)
    setCandidates(prev => prev.filter(c => c.id !== vcId))
    if (selectedVC?.id === vcId) setSelectedVC(null)
    setDeleting(null)
  }

  const loadPipeline = useCallback(async () => {
    const { data } = await supabase
      .from('vacancy_candidates')
      .select('*, candidates(*)')
      .eq('vacancy_id', vacancyId)
      .order('created_at')
    setCandidates(data || [])
    setLoading(false)
  }, [vacancyId])

  useEffect(() => { loadPipeline() }, [loadPipeline])

  async function handleDragEnd(result) {
    if (!result.destination) return
    const newStage = result.destination.droppableId
    const vcId = result.draggableId

    // Optimistic update
    setCandidates(prev =>
      prev.map(c =>
        c.id === vcId
          ? { ...c, stage: newStage, stage_changed_at: new Date().toISOString() }
          : c
      )
    )

    const { error } = await supabase
      .from('vacancy_candidates')
      .update({ stage: newStage, stage_changed_at: new Date().toISOString() })
      .eq('id', vcId)

    if (error) {
      loadPipeline()
      return
    }

    const candidate = candidates.find(c => c.id === vcId)
    if (candidate && profile) {
      await supabase.from('activity_log').insert({
        organization_id: profile.organization_id,
        entity_type: 'vacancy_candidate',
        entity_id: vcId,
        action: `${candidate.candidates?.full_name} → ${STAGES.find(s => s.id === newStage)?.label}`,
        details: { vacancy_id: vacancyId, to_stage: newStage },
        performed_by: profile.id,
      })
    }
  }

  // Metrics
  const total = candidates.length
  const activeStages = ['contacted', 'screening', 'interviewing', 'shortlist', 'presented', 'offer']
  const active = candidates.filter(c => activeStages.includes(c.stage)).length
  const avgScore = candidates.filter(c => c.match_score != null).length > 0
    ? Math.round(candidates.filter(c => c.match_score != null).reduce((s, c) => s + c.match_score, 0) / candidates.filter(c => c.match_score != null).length)
    : null
  const overSLA = candidates.filter(c => {
    const stage = STAGES.find(s => s.id === c.stage)
    return stage?.sla && daysInStage(c.stage_changed_at) > stage.sla
  }).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-light border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top metrics bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total pipeline', value: total, icon: Users, color: 'text-white', iconColor: 'text-primary-light' },
          { label: 'En proceso', value: active, icon: TrendingUp, color: 'text-blue-400', iconColor: 'text-blue-400' },
          { label: 'Score promedio', value: avgScore != null ? `${avgScore}%` : '--', icon: Star, color: avgScore >= 70 ? 'text-emerald-400' : 'text-amber-400', iconColor: avgScore >= 70 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Fuera de SLA', value: overSLA, icon: AlertTriangle, color: overSLA > 0 ? 'text-red-400' : 'text-emerald-400', iconColor: overSLA > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map((m, i) => (
          <div key={i} className="glass rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">{m.label}</span>
              <m.icon size={14} className={m.iconColor} />
            </div>
            <div className={`text-xl font-bold font-display ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-2.5 overflow-x-auto pb-4 -mx-1 px-1">
          {STAGES.map(stage => {
            const items = candidates.filter(c => c.stage === stage.id)
            return (
              <Droppable key={stage.id} droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-shrink-0 w-60 rounded-xl border-t-2 ${stage.color} transition-colors ${
                      snapshot.isDraggingOver ? 'bg-primary/10 border-primary-light/30' : 'bg-white/[0.02]'
                    }`}
                    style={{ border: '1px solid rgba(255,255,255,0.05)', borderTopWidth: '2px' }}
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          {stage.label}
                        </h3>
                        <span className="text-[10px] text-gray-500 bg-white/[0.06] px-1.5 py-0.5 rounded-md font-medium">
                          {items.length}
                        </span>
                      </div>
                      {stage.sla && (
                        <span className="text-[9px] text-gray-600 flex items-center gap-0.5" title={`SLA: ${stage.sla} dias`}>
                          <Clock size={8} /> {stage.sla}d
                        </span>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="px-2 pb-2 space-y-1.5 min-h-[80px]">
                      <AnimatePresence>
                        {items.map((vc, index) => {
                          const days = daysInStage(vc.stage_changed_at)
                          const c = vc.candidates || {}
                          const source = vc.source || c.source
                          const SourceIcon = SOURCE_ICONS[source] || Zap

                          return (
                            <Draggable key={vc.id} draggableId={vc.id} index={index}>
                              {(provided, snapshot) => (
                                <motion.div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.15 }}
                                  onClick={() => !snapshot.isDragging && setSelectedVC(vc)}
                                  className={`glass rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:border-primary/20 transition-all group ${
                                    snapshot.isDragging ? 'shadow-lg shadow-primary/20 rotate-1 scale-105' : ''
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    {/* Initials avatar */}
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0">
                                      <span className="text-[10px] font-bold text-gray-200">
                                        {initials(c.full_name)}
                                      </span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium text-white truncate">
                                        {c.full_name}
                                      </div>
                                      {c.current_title && (
                                        <div className="text-[10px] text-gray-500 truncate">
                                          {c.current_title}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Bottom row: score, days, source */}
                                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    {vc.match_score != null && (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${scoreColor(vc.match_score)}`}>
                                        {Math.round(vc.match_score)}%
                                      </span>
                                    )}

                                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${agingBg(days, stage.sla)} ${agingColor(days, stage.sla)}`}>
                                      <Clock size={8} /> {days}d
                                    </span>

                                    {source && (
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${SOURCE_COLORS[source] || 'bg-gray-500/15 text-gray-400'}`}>
                                        <SourceIcon size={8} />
                                      </span>
                                    )}
                                    <div className="flex-1" />
                                    <button
                                      onClick={e => { e.stopPropagation(); removeFromPipeline(vc.id) }}
                                      disabled={deleting === vc.id}
                                      className="text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded p-0.5 transition-all opacity-0 group-hover:opacity-100"
                                      title="Eliminar del pipeline"
                                    >
                                      {deleting === vc.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </Draggable>
                          )
                        })}
                      </AnimatePresence>
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            )
          })}
        </div>
      </DragDropContext>

      {/* Candidate Detail Modal */}
      <AnimatePresence>
        {selectedVC && (() => {
          const c = selectedVC.candidates || {}
          const details = selectedVC.match_details || {}
          const days = daysInStage(selectedVC.stage_changed_at)
          const stageDef = STAGES.find(s => s.id === selectedVC.stage)

          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedVC(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="glass-strong rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-start justify-between p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-white text-lg font-bold">
                      {initials(c.full_name)}
                    </div>
                    <div>
                      <h2 className="text-lg font-display font-bold text-white">{c.full_name}</h2>
                      {c.current_title && <p className="text-sm text-gray-400 flex items-center gap-1"><Briefcase size={12} /> {c.current_title}</p>}
                      {c.current_company && <p className="text-xs text-gray-500">{c.current_company}</p>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedVC(null)} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Stage + Score badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold border-2 ${stageDef?.color} ${stageDef?.bg}/20`} style={{ color: 'var(--text-primary)' }}>
                      {stageDef?.label}
                    </span>
                    {selectedVC.match_score != null && (
                      <span className={`text-xs px-3 py-1 rounded-full font-bold border ${scoreColor(selectedVC.match_score)}`}>
                        Match: {Math.round(selectedVC.match_score)}%
                      </span>
                    )}
                    <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${agingBg(days, stageDef?.sla)} ${agingColor(days, stageDef?.sla)}`}>
                      <Clock size={10} /> {days} días en etapa
                    </span>
                  </div>

                  {/* Contact info */}
                  <div className="grid grid-cols-2 gap-2">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-2 glass rounded-lg px-3 py-2.5 hover:border-primary/20 transition-all">
                        <Mail size={14} className="text-gray-500" /><span className="text-xs text-gray-300 truncate">{c.email}</span>
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-2 glass rounded-lg px-3 py-2.5 hover:border-primary/20 transition-all">
                        <Phone size={14} className="text-gray-500" /><span className="text-xs text-gray-300">{c.phone}</span>
                      </a>
                    )}
                    {c.location && (
                      <div className="flex items-center gap-2 glass rounded-lg px-3 py-2.5">
                        <MapPin size={14} className="text-gray-500" /><span className="text-xs text-gray-300">{c.location}</span>
                      </div>
                    )}
                    {c.linkedin_url && (
                      <a href={c.linkedin_url} target="_blank" rel="noopener" className="flex items-center gap-2 glass rounded-lg px-3 py-2.5 hover:border-primary/20 transition-all border-primary-light/10">
                        <ExternalLink size={14} className="text-primary-light" /><span className="text-xs text-primary-light">LinkedIn</span>
                      </a>
                    )}
                  </div>

                  {/* Match details */}
                  {details.strengths?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Fortalezas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {details.strengths.map((s, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {details.gaps?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Brechas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {details.gaps.map((g, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/15">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {details.pending_questions?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Preguntas pendientes</p>
                      <ul className="space-y-1.5">
                        {details.pending_questions.map((q, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                            <span className="text-amber-400 mt-0.5">?</span> {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedVC.notes && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Notas</p>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedVC.notes}</p>
                    </div>
                  )}

                  {/* Recommendation */}
                  {details.recommendation && (
                    <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider">Recomendación:</span>
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        details.recommendation === 'advance' ? 'bg-emerald-500/15 text-emerald-400' :
                        details.recommendation === 'evaluate' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>
                        {details.recommendation === 'advance' ? 'Avanzar' : details.recommendation === 'evaluate' ? 'Evaluar más' : 'No viable'}
                      </span>
                    </div>
                  )}

                  {/* Delete button */}
                  <div className="pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
                    <button
                      onClick={() => removeFromPipeline(selectedVC.id)}
                      disabled={deleting === selectedVC.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                    >
                      {deleting === selectedVC.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Eliminar del pipeline
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
