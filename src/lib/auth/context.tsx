'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '../supabase/client'

export type CustomUser = {
  id: string
  email: string
  name?: string | null
  github_id?: number | null
  github_username?: string | null
  avatar_url?: string | null
  notification_preference: 'instant' | 'digest'
  created_at: string
  updated_at: string
}

type AuthContextType = {
  user: User | null
  customUser: CustomUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [customUser, setCustomUser] = useState<CustomUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const ensureCustomUserExists = async (authUser: User) => {
    try {
      console.log('🔧 TEMP: Skipping database lookup, using fallback user')
      
      // Temporarily skip database lookup and just use auth metadata
      const fallbackUser = {
        id: authUser.id,
        email: authUser.email!,
        name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
        github_id: authUser.user_metadata?.provider_id ? parseInt(authUser.user_metadata.provider_id) : null,
        github_username: authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || null,
        avatar_url: authUser.user_metadata?.avatar_url || null,
        notification_preference: 'instant' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      console.log('📝 Setting fallback user:', fallbackUser)
      setCustomUser(fallbackUser)
      console.log('✅ Fallback user set successfully')
      return fallbackUser
    } catch (error) {
      console.error('💥 Error in ensureCustomUserExists:', error)
      throw error
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔄 Getting initial session...')
        const { data: { session } } = await supabase.auth.getSession()
        const authUser = session?.user ?? null
        console.log('📧 Initial session user:', authUser?.email)
        setUser(authUser)
        
        if (authUser) {
          console.log('👤 Auth user found, ensuring custom user exists...')
          await ensureCustomUserExists(authUser)
          console.log('✅ Custom user setup complete')
        } else {
          console.log('❌ No auth user found')
          setCustomUser(null)
        }
        
        console.log('🏁 Setting loading to false from initial session')
        setLoading(false)
      } catch (error) {
        console.error('💥 Error in getInitialSession:', error)
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          console.log('🔄 Auth state change:', event, session?.user?.email)
          const authUser = session?.user ?? null
          setUser(authUser)
          
          if (authUser) {
            console.log('👤 Auth user in state change, ensuring custom user exists...')
            await ensureCustomUserExists(authUser)
            console.log('✅ Custom user setup complete in state change')
          } else {
            console.log('❌ No auth user in state change')
            setCustomUser(null)
          }
          
          console.log('🏁 Auth state change - setting loading to false')
          setLoading(false)
        } catch (error) {
          console.error('💥 Error in auth state change:', error)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signOut = async () => {
    await supabase.auth.signOut()
    setCustomUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, customUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}