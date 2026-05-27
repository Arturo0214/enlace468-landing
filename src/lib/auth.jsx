import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const profileRef = useRef(null)
  const fetchingRef = useRef(false)

  const fetchProfile = useCallback(async (userId) => {
    // Prevent duplicate fetches
    if (fetchingRef.current) return
    fetchingRef.current = true

    const { data } = await supabase
      .from('profiles')
      .select('*, organizations(*)')
      .eq('id', userId)
      .single()

    setProfile(data)
    profileRef.current = data
    setLoading(false)
    fetchingRef.current = false
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only update session ref, don't trigger re-renders for token refresh
      if (event === 'TOKEN_REFRESHED') {
        // Silently update session without causing re-render cascade
        setSession(session)
        return
      }

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
        profileRef.current = null
        setLoading(false)
        return
      }

      setSession(session)

      if (session && !profileRef.current) {
        fetchProfile(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  function getProviderToken() {
    return session?.provider_token || null
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:8888/dashboard',
        scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
      },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    profileRef.current = null
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signInWithGoogle, signOut, getProviderToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
