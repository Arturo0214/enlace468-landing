import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useEffect, useState } from 'react'

export default function LoginPage() {
  const { session, loading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [emailMode, setEmailMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session, navigate])

  async function handleEmailAuth(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { supabase } = await import('../../lib/supabase')
      let result
      if (isSignUp) {
        result = await supabase.auth.signUp({ email, password, options: { data: { full_name: email.split('@')[0] } } })
      } else {
        result = await supabase.auth.signInWithPassword({ email, password })
      }
      if (result.error) throw result.error
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-body)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: 'var(--bg-body)' }}>
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-b from-primary/20 via-accent/10 to-transparent blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            Enlace <span className="gradient-text">468</span>
          </h1>
          <p className="text-gray-400">CRM de Reclutamiento con IA</p>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white text-center mb-2">
            {isSignUp ? 'Crear cuenta' : 'Inicia sesion'}
          </h2>
          <p className="text-gray-400 text-center text-sm mb-8">
            {emailMode ? 'Ingresa tus credenciales' : 'Conecta tu cuenta para acceder al dashboard'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!emailMode ? (
            <>
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl glass hover:border-white/20 transition-all text-white font-medium mb-3"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuar con Google
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <div className="relative flex justify-center"><span className="px-3 text-xs text-gray-500" style={{ background: 'rgba(26, 26, 62, 0.7)' }}>o</span></div>
              </div>

              <button
                onClick={() => setEmailMode(true)}
                className="w-full px-4 py-3 rounded-xl glass hover:border-white/20 transition-all text-gray-300 font-medium text-sm"
              >
                Continuar con email
              </button>
            </>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
                  placeholder="tu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Contrasena</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"
                  placeholder="Min. 6 caracteres"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? 'Cargando...' : isSignUp ? 'Crear cuenta' : 'Iniciar sesion'}
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError('') }}
                className="w-full text-sm text-gray-400 hover:text-primary transition-colors"
              >
                {isSignUp ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}
              </button>
              <button
                type="button"
                onClick={() => { setEmailMode(false); setError('') }}
                className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Volver
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-gray-500 hover:text-primary transition-colors">
              Volver al inicio
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
