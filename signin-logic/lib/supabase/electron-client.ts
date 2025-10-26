import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instance to prevent multiple GoTrueClient warnings
let electronClientInstance: SupabaseClient | null = null
let currentToken: string | null = null

/**
 * Create a Supabase client for Electron that uses the stored auth token
 * This allows direct communication with Supabase without going through the website API
 * Uses singleton pattern to avoid multiple GoTrueClient instances
 */
export async function createElectronClient() {
  if (typeof window === 'undefined' || !(window as any).electronAPI) {
    throw new Error('This function can only be used in Electron')
  }

  const electronAPI = (window as any).electronAPI

  // Get the stored token from Electron
  const token = await electronAPI.getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  // Return existing client if token hasn't changed
  if (electronClientInstance && currentToken === token) {
    return electronClientInstance
  }

  // Create new client only if token changed or no client exists
  console.log('🔄 Creating new Electron Supabase client')
  currentToken = token
  
  electronClientInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: undefined, // Disable storage to prevent conflicts
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  )

  return electronClientInstance
}

/**
 * Reset the singleton instance (useful for logout or token refresh)
 */
export function resetElectronClient() {
  electronClientInstance = null
  currentToken = null
  console.log('🔄 Electron Supabase client reset')
}