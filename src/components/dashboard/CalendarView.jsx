import { useEffect, useMemo, useState } from 'react'
import { Calendar, Clock, User, Video, ChevronLeft, ChevronRight, Flag, CheckCircle2, ChevronDown, Users, CalendarClock, Link2, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { getCalendarEventsRange } from '../../lib/googleApi'
import { entregaUrgencia, urgenciaStyle, esActiva, parseLocalDate, ENTREGAS_EMAILS, isEntregasMember } from '../../lib/entregas'

const stageLabels = { phone_screen: 'Filtro telefonico', technical: 'Tecnica', cultural: 'Cultural', final: 'Final', client: 'Cliente' }
const statusColors = { scheduled: 'bg-accent/20 text-accent', completed: 'bg-green-500/20 text-green-400', cancelled: 'bg-red-500/20 text-red-400', no_show: 'bg-gold/20 text-gold' }

const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Colores estables por persona (para comparar los 3 calendarios)
const PERSON_PALETTE = ['#00A99D', '#4A6FC9', '#E0A449', '#C084FC']
const firstName = (n) => (n || '').split(' ')[0]

export default function CalendarView() {
  const { profile, getProviderToken, signInWithGoogle } = useAuth()
  const [interviews, setInterviews] = useState([])
  const [entregas, setEntregas] = useState([])
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [calOwner, setCalOwner] = useState('')      // '' hasta resolver, luego 'todos' | id
  const [menuOpen, setMenuOpen] = useState(false)
  // Google Calendar real
  const [gEvents, setGEvents] = useState([])        // [{...ev, owner_id}]
  const [gStatus, setGStatus] = useState({})        // owner_id -> 'ok'|'denied'|'error'
  const [gLoading, setGLoading] = useState(false)
  const [needConnect, setNeedConnect] = useState(false)

  const esMiembro = isEntregasMember(profile)

  useEffect(() => { loadData() }, [])
  // default: el calendario del usuario actual (si es miembro), si no, los 3 juntos
  useEffect(() => {
    if (!calOwner && profile) setCalOwner(esMiembro ? profile.id : 'todos')
  }, [profile, esMiembro, calOwner])

  async function loadData() {
    const [iv, en, ad] = await Promise.all([
      supabase.from('interviews')
        .select('*, vacancy_candidates(*, candidates(full_name), vacancies(title))')
        .order('scheduled_at', { ascending: true }),
      supabase.from('admin_entregas')
        .select('*, owner:profiles!admin_entregas_owner_id_fkey(full_name)')
        .order('due_date', { ascending: true }),
      supabase.from('profiles').select('id, full_name, email').in('email', ENTREGAS_EMAILS).order('full_name'),
    ])
    setInterviews(iv.data || [])
    setEntregas(en.data || [])
    setAdmins(ad.data || [])
    setLoading(false)
  }

  // Mapa id -> color (orden alfabético estable)
  const colorMap = useMemo(() => {
    const m = {}
    admins.forEach((a, i) => { m[a.id] = PERSON_PALETTE[i % PERSON_PALETTE.length] })
    return m
  }, [admins])
  const colorOf = (id) => colorMap[id] || '#9CA3AF'
  const nameOf = (id) => firstName(admins.find(a => a.id === id)?.full_name) || 'Admin'

  // Entregas visibles según el calendario elegido
  const entregasView = useMemo(() => {
    if (!calOwner || calOwner === 'todos') return entregas
    return entregas.filter(e => e.owner_id === calOwner)
  }, [entregas, calOwner])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  // ── Google Calendar real (del usuario y, si lo compartieron, de los demás) ──
  useEffect(() => {
    if (!esMiembro || !calOwner || admins.length === 0) return
    let cancel = false
    ;(async () => {
      const token = getProviderToken()
      if (!token) { setNeedConnect(true); setGEvents([]); setGStatus({}); return }
      setNeedConnect(false); setGLoading(true)
      const targets = calOwner === 'todos' ? admins : admins.filter(a => a.id === calOwner)
      const timeMin = new Date(year, month, 1 - 7).toISOString()
      const timeMax = new Date(year, month + 1, 7).toISOString()
      const status = {}; const all = []; let auth401 = false
      await Promise.all(targets.map(async t => {
        const calId = t.id === profile.id ? 'primary' : t.email
        try {
          const evs = await getCalendarEventsRange(token, calId, timeMin, timeMax)
          status[t.id] = 'ok'
          evs.forEach(ev => all.push({ ...ev, owner_id: t.id }))
        } catch (e) {
          if (e.status === 401) auth401 = true
          status[t.id] = (e.status === 403 || e.status === 404) ? 'denied' : 'error'
        }
      }))
      if (cancel) return
      setGEvents(all); setGStatus(status); setGLoading(false)
      if (auth401) setNeedConnect(true)
    })()
    return () => { cancel = true }
  }, [calOwner, admins, year, month, profile, esMiembro]) // eslint-disable-line react-hooks/exhaustive-deps

  function gEventDate(ev) {
    return ev.allDay ? parseLocalDate(ev.start) : new Date(ev.start)
  }
  function getGoogleForDay(day) {
    return gEvents.filter(ev => {
      const d = gEventDate(ev)
      return d && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  function getInterviewsForDay(day) {
    return interviews.filter(i => {
      const d = new Date(i.scheduled_at)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }
  function getEntregasForDay(day) {
    return entregasView.filter(e => {
      const d = parseLocalDate(e.due_date)
      return d && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)) }

  const selectedInterviews = selectedDate ? getInterviewsForDay(selectedDate) : []
  const selectedEntregas = selectedDate ? getEntregasForDay(selectedDate) : []

  const upcomingInterviews = interviews
    .filter(i => new Date(i.scheduled_at) >= today && i.status === 'scheduled')
    .slice(0, 5)

  const upcomingEntregas = entregasView
    .filter(esActiva)
    .map(e => ({ ...e, _u: entregaUrgencia(e) }))
    .sort((a, b) => a._u.sort - b._u.sort)
    .slice(0, 6)

  const verTodos = calOwner === 'todos'
  const opciones = [
    { key: 'todos', label: 'Los 3 juntos', color: null },
    ...admins.map(a => ({ key: a.id, label: `${firstName(a.full_name)}${a.id === profile?.id ? ' (yo)' : ''}`, color: colorOf(a.id) })),
  ]
  const opActual = opciones.find(o => o.key === calOwner)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-display font-bold text-white">Calendario</h1>

        {esMiembro && (
          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors">
              {verTodos ? <Users size={15} className="text-accent" />
                : <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(calOwner) }} />}
              <span>Entregas de: <b className="font-semibold">{opActual?.label || '—'}</b></span>
              <ChevronDown size={15} className="text-gray-400" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-56 z-50 glass-strong rounded-xl p-1.5 border border-white/10">
                  {opciones.map(o => (
                    <button key={o.key} onClick={() => { setCalOwner(o.key); setMenuOpen(false) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        calOwner === o.key ? 'bg-primary/20 text-white' : 'text-gray-300 hover:bg-white/5'
                      }`}>
                      {o.color ? <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: o.color }} />
                        : <Users size={15} className="text-accent flex-shrink-0" />}
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

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
              const dayEntregas = getEntregasForDay(day)
              const dayGoogle = getGoogleForDay(day)
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
              const isSelected = selectedDate === day
              // "Ocupados" ese día = quien tenga entrega o evento real de Google (para empatar los 3)
              const ownersBusy = verTodos
                ? [...new Set([...dayEntregas.map(e => e.owner_id), ...dayGoogle.map(e => e.owner_id)])]
                : []

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
                  {(dayInterviews.length > 0 || dayEntregas.length > 0 || dayGoogle.length > 0) && (
                    <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
                      {dayInterviews.slice(0, 2).map((_, j) => (
                        <div key={`i${j}`} className="w-1.5 h-1.5 rounded-full bg-primary" />
                      ))}
                      {verTodos ? (
                        ownersBusy.slice(0, 3).map(oid => (
                          <div key={`o${oid}`} className="w-1.5 h-1.5 rounded-full" style={{ background: colorOf(oid) }} />
                        ))
                      ) : (
                        <>
                          {dayEntregas.slice(0, 2).map((e, j) => (
                            <div key={`e${j}`} className="w-1.5 h-1.5 rounded-full" style={{ background: urgenciaStyle(entregaUrgencia(e)).dot }} />
                          ))}
                          {dayGoogle.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-gray-400" title="Eventos de agenda" />}
                        </>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Leyenda al comparar los 3 */}
          {verTodos && admins.length > 0 && (
            <div className="flex items-center gap-4 mt-5 pt-4 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[11px] text-gray-500 uppercase tracking-wide">Calendarios:</span>
              {admins.map(a => (
                <span key={a.id} className="flex items-center gap-1.5 text-xs text-gray-300">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(a.id) }} />
                  {firstName(a.full_name)}{a.id === profile?.id ? ' (yo)' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Entrevistas */}
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

          {/* Entregas */}
          <div className="glass rounded-xl">
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <CheckCircle2 size={16} className="text-accent" />
              <h3 className="font-display font-semibold text-white">
                {selectedDate ? 'Entregas de este dia' : 'Entregas pendientes'}
              </h3>
              {!verTodos && opActual && (
                <span className="ml-auto text-[11px] flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: colorOf(calOwner) }} />{opActual.label}
                </span>
              )}
            </div>
            <div className="p-4">
              {(() => {
                const lista = selectedDate
                  ? selectedEntregas.map(e => ({ ...e, _u: entregaUrgencia(e) }))
                  : upcomingEntregas
                if (loading) return <div className="text-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent mx-auto" /></div>
                if (lista.length === 0) return (
                  <div className="text-center py-6">
                    <CheckCircle2 size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-gray-500 text-sm">{selectedDate ? 'Sin entregas este dia' : 'Sin entregas pendientes'}</p>
                  </div>
                )
                return (
                  <div className="space-y-2.5">
                    {lista.map(e => {
                      const s = urgenciaStyle(e._u)
                      return (
                        <div key={e.id} className={`bg-white/[0.03] rounded-lg p-3 border ${s.card} flex gap-2.5`}>
                          <div className={`w-1 rounded-full flex-shrink-0 ${s.bar} ${s.pulse ? 'animate-pulse' : ''}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {e.priority === 'high' && <Flag size={12} className="text-red-400 flex-shrink-0" />}
                              <span className="text-sm font-medium text-white truncate">{e.title}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.badge}`}>{e._u.label}</span>
                              <span className="text-[10px] flex items-center gap-1 text-gray-400">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorOf(e.owner_id) }} />
                                {nameOf(e.owner_id)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Agenda real de Google */}
          {esMiembro && (
            <div className="glass rounded-xl">
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <CalendarClock size={16} className="text-primary-light" />
                <h3 className="font-display font-semibold text-white">Agenda real · Google</h3>
                {gLoading && <div className="ml-auto animate-spin rounded-full h-4 w-4 border-2 border-primary-light border-t-transparent" />}
              </div>
              <div className="p-4">
                {needConnect ? (
                  <div className="text-center py-5">
                    <CalendarClock size={28} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-gray-400 text-sm mb-3">Conecta tu Google Calendar para ver tu agenda real aquí.</p>
                    <button onClick={() => signInWithGoogle()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-medium">
                      <Link2 size={15} /> Conectar Google Calendar
                    </button>
                  </div>
                ) : (() => {
                  const now = new Date()
                  const base = selectedDate ? getGoogleForDay(selectedDate)
                    : gEvents.filter(ev => gEventDate(ev) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
                  const lista = [...base].sort((a, b) => gEventDate(a) - gEventDate(b)).slice(0, selectedDate ? 50 : 8)
                  const denied = admins.filter(a => gStatus[a.id] === 'denied')
                  return (
                    <>
                      {lista.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 py-5">{selectedDate ? 'Sin eventos este día' : 'Sin eventos próximos'}</p>
                      ) : (
                        <div className="space-y-2">
                          {lista.map(ev => (
                            <div key={`${ev.owner_id}-${ev.id}`} className="flex gap-2.5 bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                              <span className="w-1 rounded-full flex-shrink-0" style={{ background: colorOf(ev.owner_id) }} />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-white truncate">{ev.title}</div>
                                <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                                  <span className="flex items-center gap-1"><Clock size={10} />
                                    {ev.allDay ? 'Todo el día'
                                      : gEventDate(ev).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {verTodos && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: colorOf(ev.owner_id) }} />{nameOf(ev.owner_id)}</span>}
                                  {ev.location && <span className="flex items-center gap-1 truncate max-w-[120px]"><MapPin size={10} />{ev.location}</span>}
                                  {ev.meetLink && <a href={ev.meetLink} target="_blank" rel="noopener" className="flex items-center gap-1 text-accent"><Video size={10} />Meet</a>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {denied.length > 0 && (
                        <p className="text-[11px] text-gold-light/80 mt-3 leading-snug">
                          {denied.map(a => firstName(a.full_name)).join(' y ')} {denied.length > 1 ? 'no han' : 'no ha'} compartido su Google Calendar contigo. Pídele(s) compartirlo para verlo aquí.
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
