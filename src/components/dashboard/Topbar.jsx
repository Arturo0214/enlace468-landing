import { Menu, Bell } from 'lucide-react'
import { useAuth } from '../../lib/auth'

export default function Topbar({ onMenuToggle }) {
  const { profile } = useAuth()

  return (
    <header className="h-16 glass flex items-center justify-between px-4 lg:px-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white lg:hidden transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-display font-semibold text-white hidden sm:block">
          {profile?.organizations?.name || 'Enlace 468'}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white relative transition-colors">
          <Bell size={20} />
        </button>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-primary-light text-sm font-bold">
            {profile?.full_name?.[0]?.toUpperCase()}
          </div>
        )}
      </div>
    </header>
  )
}
