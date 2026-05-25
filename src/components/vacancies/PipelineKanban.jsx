import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Users, Clock, AlertTriangle, TrendingUp, Star, Zap, ExternalLink, Globe, UserPlus, FileText } from 'lucide-react'
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
                                  className={`glass rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:border-primary/20 transition-all ${
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
    </div>
  )
}
