import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client for Electron that uses the stored auth token
 * This allows direct communication with Supabase without going through the website API
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

  // Create Supabase client with the token
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  )

  return client
}
