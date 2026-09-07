// Campana de notificaciones del Topbar (FASE 6).
//
// Badge con el conteo de no-leídas (mías + las de toda mi org, es decir
// recipient_id = auth.uid() OR recipient_id IS NULL — RLS acota a la org) y
// dropdown con la lista. Click en una notificación → se marca leída y navega
// según entity_type (vacancy_candidate → la vacante del candidato).
//
// Poll cada 60s del conteo + refresh de la lista al abrir. TOLERANTE a que la
// tabla `notifications` aún no exista en prod (migración 20260908020000 sin
// aplicar): ante 42P01/PGRST205 la campana se desmonta sola (render null) y
// deja de pollear — cero ruido en consola para el usuario.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const POLL_MS = 60000
const LIST_LIMIT = 30

/** ¿El error es "la tabla no existe"? (42P01 = Postgres, PGRST205 = PostgREST) */
function isMissingTable(error) {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /does not exist|could not find the table/i.test(error.message || '')
}

function timeAgo(iso) {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  if (diff < 60000) return 'ahora'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days}d`
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const userId = profile?.id || null
  const orgId = profile?.organization_id || null

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loadingList, setLoadingList] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const rootRef = useRef(null)

  // Filtro común: mías o de toda mi org (RLS acota recipient NULL a mi org).
  const scopeFilter = useCallback(q => (
    q.eq('organization_id', orgId).or(`recipient_id.eq.${userId},recipient_id.is.null`)
  ), [orgId, userId])

  const refreshCount = useCallback(async () => {
    if (!userId || !orgId) return
    const { count, error } = await scopeFilter(
      supabase.from('notifications').select('id', { count: 'exact', head: true })
    ).is('read_at', null)
    if (error) {
      if (isMissingTable(error)) setTableMissing(true)
      return
    }
    setUnread(count || 0)
  }, [userId, orgId, scopeFilter])

  const refreshList = useCallback(async () => {
    if (!userId || !orgId) return
    setLoadingList(true)
    try {
      const { data, error } = await scopeFilter(
        supabase.from('notifications').select('*')
      ).order('created_at', { ascending: false }).limit(LIST_LIMIT)
      if (error) {
        if (isMissingTable(error)) setTableMissing(true)
        return
      }
      setItems(data || [])
    } finally {
      setLoadingList(false)
    }
  }, [userId, orgId, scopeFilter])

  // Conteo inicial (diferido un tick — sin setState síncrono en el effect)
  // + poll cada 60s. Se apaga solo si la tabla no existe.
  useEffect(() => {
    if (!userId || !orgId || tableMissing) return
    const first = setTimeout(refreshCount, 0)
    const id = setInterval(refreshCount, POLL_MS)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [userId, orgId, tableMissing, refreshCount])

  // Cerrar con click fuera.
  useEffect(() => {
    if (!open) return
    const onDown = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) { refreshList(); refreshCount() }
  }

  async function handleClick(n) {
    // Optimista: pintar leída de inmediato.
    if (!n.read_at) {
      const readAt = new Date().toISOString()
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: readAt } : x))
      setUnread(prev => Math.max(0, prev - 1))
      await supabase.from('notifications').update({ read_at: readAt }).eq('id', n.id)
    }
    // Navegación según la entidad referida.
    if (n.entity_type === 'vacancy_candidate' && n.entity_id) {
      const { data } = await supabase
        .from('vacancy_candidates')
        .select('vacancy_id')
        .eq('id', n.entity_id)
        .maybeSingle()
      if (data?.vacancy_id) {
        setOpen(false)
        navigate(`/dashboard/vacancies/${data.vacancy_id}`)
      }
    } else if (n.entity_type === 'vacancy' && n.entity_id) {
      setOpen(false)
      navigate(`/dashboard/vacancies/${n.entity_id}`)
    }
  }

  async function markAllRead() {
    if (!unread || markingAll) return
    setMarkingAll(true)
    try {
      const readAt = new Date().toISOString()
      const { error } = await scopeFilter(
        supabase.from('notifications').update({ read_at: readAt })
      ).is('read_at', null)
      if (!error) {
        setItems(prev => prev.map(x => x.read_at ? x : { ...x, read_at: readAt }))
        setUnread(0)
      }
    } finally {
      setMarkingAll(false)
    }
  }

  // Sin sesión completa o sin tabla (migración pendiente) → sin campana.
  if (!userId || !orgId || tableMissing) return null

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={toggleOpen}
        className="p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white relative transition-colors"
        title="Notificaciones"
        aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl shadow-2xl z-50 overflow-hidden glass-strong"
          style={{ border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notificaciones</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-[11px] font-medium text-accent hover:opacity-80 disabled:opacity-50 transition-opacity"
              >
                {markingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loadingList && !items.length ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="animate-spin text-gray-500" />
              </div>
            ) : !items.length ? (
              <div className="py-10 text-center">
                <Bell size={24} className="mx-auto text-gray-600 mb-2" />
                <p className="text-sm text-gray-500">Sin notificaciones</p>
              </div>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex gap-2.5 items-start"
                  style={{ borderBottom: '1px solid var(--border-default)' }}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-accent'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] leading-snug ${n.read_at ? 'font-normal' : 'font-semibold'}`} style={{ color: 'var(--text-primary)' }}>
                      {n.title}
                    </span>
                    {n.body && <span className="block text-xs text-gray-400 mt-0.5 leading-snug">{n.body}</span>}
                    <span className="block text-[10px] text-gray-500 mt-1">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
