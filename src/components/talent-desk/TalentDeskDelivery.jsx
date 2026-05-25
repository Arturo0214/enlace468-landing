import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, User, Building2, BarChart3, ChevronDown, ChevronUp,
  Plus, MessageSquare, FileText, CheckCircle, CalendarClock,
  Download, Star, Loader2, ArrowLeft
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Link } from 'react-router-dom'

const tierConfig = {
  light: { label: 'Light', color: 'text-accent-light', bg: 'bg-accent/10' },
  pro: { label: 'Pro', color: 'text-primary-light', bg: 'bg-primary/10' },
  premium: { label: 'Premium', color: 'text-gold', bg: 'bg-gold/10' },
}

function MatchBar({ score }) {
  const pct = Math.round(score * 100)
  const barColor = pct >= 80 ? 'bg-green-400' : pct >= 60 ? 'bg-gold' : 'bg-accent-light'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <span className="text-xs font-bold text-gray-300 w-10 text-right">{pct}%</span>
    </div>
  )
}

function CandidateCard({ candidate, tier, index }) {
  const [expanded, setExpanded] = useState(false)
  const isPro = tier === 'pro' || tier === 'premium'
  const isPremium = tier === 'premium'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass rounded-xl overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-primary-light font-bold text-sm">
              {candidate.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-sm">{candidate.name}</h3>
              <p className="text-xs text-gray-400">{candidate.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPremium && candidate.contact_made && (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-400">
                <CheckCircle size={12} />
                Contacto realizado
              </span>
            )}
            {isPremium && candidate.interest_status && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                candidate.interest_status === 'interested' ? 'bg-green-500/10 text-green-400'
                : candidate.interest_status === 'pending' ? 'bg-gold/10 text-gold'
                : 'bg-gray-500/10 text-gray-400'
              }`}>
                {candidate.interest_status === 'interested' ? 'Interesado'
                 : candidate.interest_status === 'pending' ? 'Pendiente'
                 : 'No interesado'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          {candidate.company && (
            <span className="flex items-center gap-1">
              <Building2 size={12} />
              {candidate.company}
            </span>
          )}
          {candidate.match_score != null && isPro && (
            <span className="flex items-center gap-1">
              <Star size={12} className="text-gold" />
              Match: {Math.round(candidate.match_score * 100)}%
            </span>
          )}
        </div>

        {isPro && candidate.match_score != null && (
          <div className="mb-3">
            <MatchBar score={candidate.match_score} />
          </div>
        )}

        {/* Ficha resumida - all tiers */}
        <p className="text-sm text-gray-300 leading-relaxed mb-3">{candidate.summary}</p>

        {/* Basic recommendation - light */}
        {candidate.recommendation && (
          <div className="bg-white/[0.03] rounded-lg p-3 mb-3 border border-white/5">
            <p className="text-xs font-medium text-gray-400 mb-1">Recomendacion</p>
            <p className="text-sm text-gray-300">{candidate.recommendation}</p>
          </div>
        )}

        {/* Pro: qualitative comments */}
        {isPro && candidate.qualitative_comments && (
          <div className="bg-white/[0.03] rounded-lg p-3 mb-3 border border-white/5">
            <p className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
              <MessageSquare size={12} />
              Comentarios cualitativos
            </p>
            <p className="text-sm text-gray-300">{candidate.qualitative_comments}</p>
          </div>
        )}

        {/* Pro: suggested outreach */}
        {isPro && candidate.suggested_message && (
          <div className="bg-primary/5 rounded-lg p-3 mb-3 border border-primary/10">
            <p className="text-xs font-medium text-primary-light mb-1">Mensaje sugerido</p>
            <p className="text-sm text-gray-300 italic">"{candidate.suggested_message}"</p>
          </div>
        )}

        {/* Premium: suggested agenda */}
        {isPremium && candidate.suggested_agenda && (
          <div className="bg-gold/5 rounded-lg p-3 mb-3 border border-gold/10">
            <p className="text-xs font-medium text-gold mb-1 flex items-center gap-1">
              <CalendarClock size={12} />
              Agenda sugerida de entrevista
            </p>
            <p className="text-sm text-gray-300">{candidate.suggested_agenda}</p>
          </div>
        )}

        {/* Expandable full ficha */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-primary-light hover:text-white transition-colors mt-1"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Ocultar ficha completa' : 'Ver ficha completa'}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                {candidate.experience && (
                  <div>
                    <p className="text-xs font-medium text-gray-400">Experiencia</p>
                    <p className="text-sm text-gray-300">{candidate.experience}</p>
                  </div>
                )}
                {candidate.education && (
                  <div>
                    <p className="text-xs font-medium text-gray-400">Educacion</p>
                    <p className="text-sm text-gray-300">{candidate.education}</p>
                  </div>
                )}
                {candidate.skills?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills.map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-300">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {candidate.location && (
                  <div>
                    <p className="text-xs font-medium text-gray-400">Ubicacion</p>
                    <p className="text-sm text-gray-300">{candidate.location}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-end">
        <button className="flex items-center gap-1.5 text-xs font-medium text-primary-light hover:text-white transition-colors">
          <Plus size={14} />
          Agregar a banco
        </button>
      </div>
    </motion.div>
  )
}

export default function TalentDeskDelivery() {
  const { vacancyId } = useParams()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [delivery, setDelivery] = useState(null)
  const [vacancy, setVacancy] = useState(null)

  useEffect(() => {
    if (profile && vacancyId) loadDelivery()
  }, [profile, vacancyId])

  async function loadDelivery() {
    // Load vacancy info
    const { data: vac } = await supabase
      .from('vacancies')
      .select('*')
      .eq('id', vacancyId)
      .single()
    setVacancy(vac)

    // Load talent desk delivery data
    const { data } = await supabase
      .from('talent_desk_deliveries')
      .select('*')
      .eq('vacancy_id', vacancyId)
      .single()
    setDelivery(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary-light" />
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="text-center py-16">
        <Package size={48} className="text-gray-600 mx-auto mb-4" />
        <h2 className="text-lg font-display font-bold text-white mb-2">Sin entrega disponible</h2>
        <p className="text-gray-400 text-sm mb-6">Aun no hay resultados de Talent Desk para esta vacante.</p>
        <Link
          to="/dashboard/talent-desk"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-light hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          Volver a Talent Desk
        </Link>
      </div>
    )
  }

  const tier = delivery.tier || 'light'
  const tc = tierConfig[tier] || tierConfig.light
  const candidates = delivery.candidates || []
  const isPro = tier === 'pro' || tier === 'premium'

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Link
          to="/dashboard/talent-desk"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Talent Desk
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-display font-bold text-white">
                {vacancy?.title || 'Vacante'}
              </h1>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${tc.bg} ${tc.color}`}>
                {tc.label}
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              {candidates.length} candidato{candidates.length !== 1 ? 's' : ''} entregados
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {candidates.map((candidate, i) => (
          <CandidateCard key={candidate.id || i} candidate={candidate} tier={tier} index={i} />
        ))}
      </div>

      {/* Executive report */}
      {isPro && delivery.executive_summary && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                <FileText size={20} className="text-primary-light" />
              </div>
              <h2 className="text-lg font-display font-bold text-white">Reporte Ejecutivo</h2>
            </div>
            {delivery.report_url && (
              <a
                href={delivery.report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
              >
                <Download size={16} />
                Descargar reporte
              </a>
            )}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{delivery.executive_summary}</p>
        </motion.div>
      )}
    </div>
  )
}
