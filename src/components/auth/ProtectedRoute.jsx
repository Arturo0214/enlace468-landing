import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export default function ProtectedRoute({ children }) {
  const { session, profile, loading } = useAuth()

  // Only show loading spinner on first load, not on tab switches
  if (loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-body)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session && !loading) {
    return <Navigate to="/" replace />
  }

  return children
}
