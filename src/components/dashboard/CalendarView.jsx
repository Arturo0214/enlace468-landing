import { useEffect, useState } from 'react'
import { Calendar, Clock, User, Video, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const stageLabels = { phone_screen: 'Filtro telefonico', technical: 'Tecnica', cultural: 'Cultural', final: 'Final', client: 'Cliente' }
const statusColors = { scheduled: 'bg-accent/20 text-accent', completed: 'bg-green-500/20 text-green-400', cancelled: 'bg-red-500/20 text-red-400', no_show: 'bg-gold/20 text-gold' }

const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function CalendarView() {
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => { loadInterviews() }, [])

  async function loadInterviews() {
    const { data } = await supabase
      .from('interviews')
      .select('*, vacancy_candidates(*, candidates(full_name), vacancies(title))')
      .order('scheduled_at', { ascending: true })
    setInterviews(data || [])
    setLoading(false)
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  function getInterviewsForDay(day) {
    return interviews.filter(i => {
      const d = new Date(i.scheduled_at)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)) }

  const selectedInterviews = selectedDate ? getInterviewsForDay(selectedDate) : []

  const upcomingInterviews = interviews
    .filter(i => new Date(i.scheduled_at) >= today && i.status === 'scheduled')
    .slice(0, 5)

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-white mb-6">Calendario</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 glass-strong rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-semibold text-white text-lg">{MONTHS[month]} {year}</h2>
            <div className="flex gap-2">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"><ChevronRight size={20} /></button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(d => <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>)}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayInterviews = getInterviewsForDay(day)
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
              const isSelected = selectedDate === day

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(day === selectedDate ? null : day)}
                  className={`relative p-2 rounded-lg text-sm text-center transition-all min-h-[48px] ${
                    isSelected ? 'bg-primary/20 border border-primary/40 text-white' :
                    isToday ? 'bg-accent/10 border border-accent/30 text-white' :
                    'hover:bg-white/5 text-gray-300'
                  }`}
                >
                  <span className={isToday ? 'font-bold' : ''}>{day}</span>
                  {dayInterviews.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {dayInterviews.slice(0, 3).map((_, j) => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full bg-primary" />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Selected day or upcoming */}
          <div className="glass rounded-xl">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-display font-semibold text-white">
                {selectedDate ? `${selectedDate} de ${MONTHS[month]}` : 'Proximas entrevistas'}
              </h3>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" /></div>
              ) : (selectedDate ? selectedInterviews : upcomingInterviews).length === 0 ? (
                <div className="text-center py-6">
                  <Calendar size={32} className="mx-auto text-gray-600 mb-2" />
                  <p className="text-gray-500 text-sm">{selectedDate ? 'Sin entrevistas este dia' : 'No hay entrevistas programadas'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(selectedDate ? selectedInterviews : upcomingInterviews).map(interview => (
                    <div key={interview.id} className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span className="text-sm font-medium text-white">
                            {interview.vacancy_candidates?.candidates?.full_name || 'Candidato'}
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[interview.status] || ''}`}>
                          {interview.status === 'scheduled' ? 'Agendada' : interview.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 space-y-1">
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(interview.scheduled_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                          {interview.duration_minutes && ` · ${interview.duration_minutes} min`}
                        </div>
                        {interview.vacancy_candidates?.vacancies?.title && (
                          <div className="text-gray-500">{interview.vacancy_candidates.vacancies.title}</div>
                        )}
                        {interview.interview_type && (
                          <span className="inline-block text-xs px-2 py-0.5 rounded bg-white/5 text-gray-400">
                            {stageLabels[interview.interview_type] || interview.interview_type}
                          </span>
                        )}
                        {interview.meet_link && (
                          <a href={interview.meet_link} target="_blank" rel="noopener" className="flex items-center gap-1 text-accent hover:text-accent-light">
                            <Video size={12} /> Google Meet
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
