import {
    createContext,
    useContext,
    useEffect,
    useState,
  } from 'react'
  import type { ReactNode } from 'react'
  import { supabase } from '../lib/supabaseClient'
  import type { User, Session } from '@supabase/supabase-js'
  import { toast } from 'sonner'
  
  // ---------- Types ----------
  export interface Profile {
    id: string
    full_name: string | null
    role: 'user' | 'vendor' | 'admin'
    created_at: string
  }
  
  export interface AuthContextType {
    user: User | null
    session: Session | null
    profile: Profile | null
    isLoading: boolean
    isAuthenticated: boolean
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, role?: 'user' | 'vendor') => Promise<void>
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
    updateProfile: (data: Partial<Profile>) => Promise<void>
  }
  
  const AuthContext = createContext<AuthContextType | undefined>(undefined)
  
  export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isLoading, setIsLoading] = useState(true)
  
    // ---------- Fetch Profile ----------
    const fetchProfile = async (userId: string): Promise<Profile | null> => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
  
        if (error) {
          console.error('Supabase error fetching profile:', error)
          return null
        }
  
        if (data) {
          setProfile(data)
          return data
        }
        return null
      } catch (err) {
        console.error('Unexpected error in fetchProfile:', err)
        return null
      }
    }
  
    // ---------- Refresh Profile ----------
    const refreshProfile = async () => {
      if (user) {
        await fetchProfile(user.id)
      }
    }
  
    // ---------- Update Profile ----------
    const updateProfile = async (data: Partial<Profile>) => {
      if (!user) throw new Error('No user logged in')
      try {
        const { error } = await supabase
          .from('profiles')
          .update(data)
          .eq('id', user.id)
        if (error) throw error
        await refreshProfile()
        toast.success('Profile updated successfully')
      } catch (err: any) {
        console.error('Update error:', err)
        toast.error(err.message || 'Failed to update profile')
        throw err
      }
    }
  
    // ---------- Sign In ----------
    const signIn = async (email: string, password: string) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          console.error('Signin error:', error)
          throw new Error(error.message || 'Invalid email or password')
        }
      } catch (err: any) {
        console.error('Signin error:', err)
        throw new Error(err.message || 'Login failed')
      }
    }
  
    // ---------- Sign Up (with upsert and on_conflict) ----------
    const signUp = async (
      email: string,
      password: string,
      role: 'user' | 'vendor' = 'user'
    ) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: role,
              full_name: email.split('@')[0],
            },
          },
        })
    
        if (error) {
          console.error('Signup API error:', error)
          // Handle specific Supabase errors
          if (error.message.includes('rate limit')) {
            throw new Error('Too many signup attempts. Please wait a few minutes and try again.')
          }
          if (error.message.includes('already registered')) {
            throw new Error('This email is already registered. Please sign in.')
          }
          throw new Error(error.message || 'Signup failed')
        }
    
        if (!data.user) {
          throw new Error('No user returned from signup')
        }
    
        // Insert profile (using the same logic as before)
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            role: role,
            full_name: data.user.email?.split('@')[0] || null,
          })
    
        if (insertError) {
          console.error('Profile insert error:', insertError)
          if (insertError.code !== '23505') {
            throw new Error('Failed to create profile. Please try again.')
          }
        }
    
        await fetchProfile(data.user.id)
    
      } catch (err: any) {
        console.error('Signup error:', err)
        throw new Error(err.message || 'Signup failed. Please check your details and try again.')
      }
    }
  
    // ---------- Sign Out ----------
    const signOut = async () => {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        setUser(null)
        setSession(null)
        setProfile(null)
      } catch (err: any) {
        console.error('Signout error:', err)
        throw new Error(err.message || 'Failed to sign out')
      }
    }
  
    // ---------- Auth State Listener ----------
    useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        }
        setIsLoading(false)
      })
  
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setIsLoading(false)
      })
  
      return () => {
        subscription.unsubscribe()
      }
    }, [])
  
    const value: AuthContextType = {
      user,
      session,
      profile,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateProfile,
    }
  
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  }
  
  export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
      throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
  }