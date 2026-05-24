import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Briefcase, Users, GraduationCap, Calendar, Settings, LogOut, ChevronsLeft, ChevronsRight, Shield, Sparkles, Zap } from 'lucide-react'
import { useAuth } from '../../lib/auth'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio', end: true },
  { to: '/dashboard/vacancies', icon: Briefcase, label: 'Vacantes' },
  { to: '/dashboard/candidates', icon: Users, label: 'Candidatos' },
  { to: '/dashboard/recruiter-tools', icon: Zap, label: 'Recruiter Pro' },
  { to: '/dashboard/academy', icon: GraduationCap, label: 'Academy' },
  { to: '/dashboard/calendar', icon: Calendar, label: 'Calendario' },
  { to: '/dashboard/marca-vende', icon: Sparkles, label: 'Tu Marca Vende' },
  { to: '/dashboard/settings', icon: Settings, label: 'Configuracion' },
]

const adminItem = { to: '/dashboard/admin', icon: Shield, label: 'Admin Panel' }

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const { signOut, profile } = useAuth()

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-16' : 'w-60'}`}
        style={{ background: '#0F1729', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="h-14 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {!collapsed && (
            <a href="/" className="flex items-center">
              <img src="/logo-enlace468.jpeg" alt="Enlace 468" className="h-8 w-auto object-contain" />
            </a>
          )}
          <button onClick={onToggleCollapse} className="p-1.5 rounded text-gray-500 hover:bg-white/5 hover:text-white transition-colors hidden lg:flex">
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose} title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all ${
                  collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
                } ${isActive ? 'bg-primary-light/10 text-primary-light' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'}`
              }>
              <Icon size={18} />
              {!collapsed && label}
            </NavLink>
          ))}
          {profile?.role === 'super_admin' && (
            <>
              <div className="my-2 border-t border-white/5" />
              <NavLink to={adminItem.to} onClick={onClose} title={collapsed ? adminItem.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all ${
                    collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
                  } ${isActive ? 'bg-gold/10 text-gold' : 'text-gold/60 hover:text-gold hover:bg-gold/5'}`
                }>
                <adminItem.icon size={18} />
                {!collapsed && adminItem.label}
              </NavLink>
            </>
          )}
        </nav>

        <div className="px-2 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {profile && !collapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-primary-light text-xs font-bold flex-shrink-0">
                {profile.full_name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{profile.full_name}</div>
                <div className="text-[10px] text-gray-500 truncate">{profile.email}</div>
              </div>
            </div>
          )}
          <button onClick={signOut} title={collapsed ? 'Cerrar sesion' : undefined}
            className={`flex items-center gap-3 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all w-full ${collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}`}>
            <LogOut size={16} />
            {!collapsed && 'Salir'}
          </button>
        </div>
      </aside>
    </>
  )
}
