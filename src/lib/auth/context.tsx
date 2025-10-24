'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
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
  const [isElectron, setIsElectron] = useState(false)
  const supabase = createClient()

  // Check if we're in Electron immediately (synchronous)
  const checkIsElectron = () => {
    return typeof window !== 'undefined' && (window as any).electronAPI?.isElectron === true
  }

  const ensureCustomUserExists = useCallback(async (authUser: User) => {
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
  }, [])

  // Convert Electron user to Supabase User format
  const convertElectronUserToSupabaseUser = useCallback((electronUser: any): User => {
    return {
      id: electronUser.id,
      email: electronUser.email,
      aud: 'authenticated',
      role: 'authenticated',
      user_metadata: {
        full_name: electronUser.name,
        name: electronUser.name,
        avatar_url: electronUser.avatar_url,
        provider_id: electronUser.github_id?.toString(),
        user_name: electronUser.github_username,
        preferred_username: electronUser.github_username,
      },
      app_metadata: {
        provider: 'github',
        providers: ['github'],
      },
      created_at: electronUser.created_at || new Date().toISOString(),
    } as User
  }, [])

  // Get initial session
  useEffect(() => {
    const getInitialSession = async () => {
      try {
        console.log('🔄 Getting initial session...')
        const isElectronEnv = checkIsElectron()
        setIsElectron(isElectronEnv)
        console.log('🔍 Is Electron environment:', isElectronEnv)

        if (isElectronEnv) {
          // For Electron, use the Electron API to check auth
          console.log('🖥️ Electron detected, checking auth via Electron API...')
          const electronAPI = (window as any).electronAPI
          const isAuthenticated = await electronAPI.isAuthenticated()
          
          if (isAuthenticated) {
            const electronUser = await electronAPI.getUser()
            console.log('👤 Electron user:', electronUser)
            
            if (electronUser) {
              const supabaseUser = convertElectronUserToSupabaseUser(electronUser)
              setUser(supabaseUser)
              await ensureCustomUserExists(supabaseUser)
            }
          } else {
            console.log('❌ Not authenticated in Electron')
            setUser(null)
            setCustomUser(null)
          }
        } else {
          // For web, use Supabase
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
        }
        
        console.log('🏁 Setting loading to false from initial session')
        setLoading(false)
      } catch (error) {
        console.error('💥 Error in getInitialSession:', error)
        setLoading(false)
      }
    }

    getInitialSession()
  }, [supabase.auth, ensureCustomUserExists, convertElectronUserToSupabaseUser])

  // Set up auth event listeners
  useEffect(() => {
    if (isElectron && typeof window !== 'undefined') {
      // For Electron, listen to Electron auth events
      const electronAPI = (window as any).electronAPI
      
      console.log('🎧 Setting up Electron auth event listeners')
      
      // Test IPC communication
      if ((electronAPI as any).onTestEvent) {
        (electronAPI as any).onTestEvent((data: any) => {
          console.log('✅ CONTEXT: test-event received!', data);
        });
      }
      
      electronAPI.onAuthSuccess(async (data: any) => {
        console.log('🔔 Auth success event received in context:', data)
        try {
          // Immediately set loading to false to unblock UI
          setLoading(false)
          
          // Get the token from Electron and set it in Supabase
          const isAuthenticated = await electronAPI.isAuthenticated()
          if (isAuthenticated) {
            const electronUser = await electronAPI.getUser()
            console.log('👤 Got Electron user after auth success:', electronUser)
            if (electronUser) {
              const supabaseUser = convertElectronUserToSupabaseUser(electronUser)
              setUser(supabaseUser)
              await ensureCustomUserExists(supabaseUser)
              console.log('✅ User state updated after auth success')
            }
          }
        } catch (err) {
          console.error('❌ Error handling auth success in context:', err)
          setLoading(false)
        }
      })

      electronAPI.onAuthSignedOut(async () => {
        console.log('🔔 Auth signed out event received in context')
        
        // Reset Electron client singleton
        try {
          const { resetElectronClient } = await import('@/lib/supabase/electron-client')
          resetElectronClient()
        } catch (error) {
          console.warn('Could not reset electron client:', error)
        }
        
        setUser(null)
        setCustomUser(null)
        // Reload to clear all state
        window.location.href = '/'
      })

      return () => {
        console.log('🧹 Cleaning up Electron auth listeners')
        electronAPI.removeAuthListeners()
      }
    } else if (!isElectron) {
      // For web, listen for Supabase auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, session: Session | null) => {
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
    }
  }, [isElectron, supabase.auth, ensureCustomUserExists, convertElectronUserToSupabaseUser])

  const signOut = async () => {
    if (isElectron) {
      const electronAPI = (window as any).electronAPI
      
      // Reset Electron client singleton to avoid stale auth
      try {
        const { resetElectronClient } = await import('@/lib/supabase/electron-client')
        resetElectronClient()
      } catch (error) {
        console.warn('Could not reset electron client:', error)
      }
      
      await electronAPI.logout()
      // Reload the page to clear all state
      window.location.href = '/'
    } else {
      await supabase.auth.signOut()
      setUser(null)
      setCustomUser(null)
    }
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