import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Phone, MapPin, Tag, Edit2, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import CandidateForm from './CandidateForm'

const stageLabels = { sourced: 'Sourced', contacted: 'Contactado', interviewing: 'Entrevista', evaluated: 'Evaluado', presented: 'Presentado', offer: 'Oferta', hired: 'Contratado', rejected: 'Rechazado' }
const stageColors = { sourced: 'bg-gray-500/20 text-gray-300', contacted: 'bg-blue-500/20 text-blue-400', interviewing: 'bg-purple-500/20 text-purple-400', evaluated: 'bg-gold/20 text-gold', presented: 'bg-accent/20 text-accent', offer: 'bg-green-500/20 text-green-400', hired: 'bg-green-600/20 text-green-300', rejected: 'bg-red-500/20 text-red-400' }

export default function CandidateProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [candidate, setCandidate] = useState(null)
  const [vacancies, setVacancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => { loadCandidate() }, [id])

  async function loadCandidate() {
    const { data, error } = await supabase.from('candidates').select('*').eq('id', id).single()
    if (error) { navigate('/dashboard/candidates'); return }
    setCandidate(data)
    const { data: vcs } = await supabase.from('vacancy_candidates').select('*, vacancies(title, company_name, status)').eq('candidate_id', id).order('created_at', { ascending: false })
    setVacancies(vcs || []); setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>
  if (!candidate) return null

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/dashboard/candidates')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm transition-colors">
        <ArrowLeft size={16} /> Candidatos
      </button>

      <div className="glass-strong rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-gray-300">
            <User size={28} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-display font-bold text-white">{candidate.full_name}</h1>
              <button onClick={() => setShowEdit(true)} className="text-gray-400 hover:text-primary transition-colors"><Edit2 size={16} /></button>
            </div>
            {candidate.current_title && <p className="text-gray-300">{candidate.current_title}{candidate.current_company ? ` en ${candidate.current_company}` : ''}</p>}
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-400">
              {candidate.email && <a href={`mailto:${candidate.email}`} className="flex items-center gap-1 hover:text-primary transition-colors"><Mail size={14} /> {candidate.email}</a>}
              {candidate.phone && <a href={`tel:${candidate.phone}`} className="flex items-center gap-1 hover:text-primary transition-colors"><Phone size={14} /> {candidate.phone}</a>}
              {candidate.linkedin_url && <a href={candidate.linkedin_url} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-primary transition-colors"><ExternalLink size={14} /> LinkedIn</a>}
              {candidate.location && <span className="flex items-center gap-1"><MapPin size={14} /> {candidate.location}</span>}
            </div>
            {(candidate.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {candidate.tags.map(tag => <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400 flex items-center gap-1"><Tag size={10} /> {tag}</span>)}
              </div>
            )}
          </div>
          <div className="text-right text-sm text-gray-500">
            {candidate.years_experience && <div>{candidate.years_experience} anos exp.</div>}
            {candidate.salary_expectation && <div>${Number(candidate.salary_expectation).toLocaleString()} MXN</div>}
            {candidate.source && <div className="mt-1">Fuente: {candidate.source}</div>}
          </div>
        </div>
        {candidate.notes && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-sm font-medium text-gray-400 mb-1">Notas</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{candidate.notes}</p>
          </div>
        )}
      </div>

      <div className="glass rounded-xl">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-display font-semibold text-white">Historial de vacantes ({vacancies.length})</h2>
        </div>
        {vacancies.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No ha participado en ninguna vacante.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {vacancies.map(vc => (
              <div key={vc.id} className="px-5 py-4 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors" onClick={() => navigate(`/dashboard/vacancies/${vc.vacancy_id}`)}>
                <div>
                  <div className="font-medium text-white text-sm">{vc.vacancies?.title}</div>
                  {vc.vacancies?.company_name && <div className="text-xs text-gray-400">{vc.vacancies.company_name}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {vc.match_score != null && <span className="text-xs font-medium text-gold">{Math.round(vc.match_score)}%</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColors[vc.stage] || ''}`}>{stageLabels[vc.stage] || vc.stage}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEdit && <CandidateForm initial={candidate} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); loadCandidate() }} />}
    </div>
  )
}
