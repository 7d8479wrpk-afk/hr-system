import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from '../types'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string; message?: string }>
  signUp: (email: string, password: string) => Promise<{ error?: string; message?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const lastFetchedProfileId = useRef<string | null>(null)
  const fetchingProfileId = useRef<string | null>(null)

  const fetchProfile = useCallback(
    async (userId: string, force = false) => {
      if (!userId) return
      if (!force && (lastFetchedProfileId.current === userId || fetchingProfileId.current === userId)) {
        return
      }
      fetchingProfileId.current = userId
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (error) {
          // PGRST116 = no rows found
          if (error.code === 'PGRST116') {
            const { data: inserted, error: insertError } = await supabase
              .from('profiles')
              .insert({ id: userId, is_admin: false })
              .select('*')
              .single()
            if (insertError) {
              console.error('Profile insert error', insertError.message)
              setProfile(null)
              lastFetchedProfileId.current = null
            } else {
              setProfile(inserted as Profile)
              lastFetchedProfileId.current = userId
            }
          } else {
            console.error('Profile fetch error', error.message)
            setProfile(null)
            lastFetchedProfileId.current = null
          }
        } else {
          setProfile(data)
          lastFetchedProfileId.current = userId
        }
      } catch (e: any) {
        console.error('Profile fetch error', e?.message ?? e)
        setProfile(null)
        lastFetchedProfileId.current = null
      } finally {
        if (fetchingProfileId.current === userId) {
          fetchingProfileId.current = null
        }
      }
    },
    [setProfile],
  )

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        }
      } catch (e: any) {
        console.error('Auth init error', e?.message ?? e)
      } finally {
        setLoading(false)
      }
    }
    init()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        if (newSession?.user) {
          await fetchProfile(newSession.user.id)
        } else {
          setProfile(null)
          lastFetchedProfileId.current = null
        }
      },
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      return { error: error.message }
    }
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: data.user.id }, { onConflict: 'id' })

      if (profileError) {
        return { error: profileError.message }
      }

      await fetchProfile(data.user.id)
    }
    return {}
  }, [fetchProfile])

  const signUp = useCallback(async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) {
      return { error: error.message }
    }
    const newUser = data.user
    if (newUser && data.session) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: newUser.id }, { onConflict: 'id' })
      if (profileError) {
        return { error: profileError.message }
      }
      await fetchProfile(newUser.id)
      return {}
    }
    return { message: 'Check your email to confirm your account, then sign in.' }
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
    setSession(null)
    lastFetchedProfileId.current = null
    fetchingProfileId.current = null
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, true)
    }
  }, [fetchProfile, user])

  const value = useMemo(
    () => ({
      user,
      profile,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [user, profile, session, loading, signIn, signUp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
