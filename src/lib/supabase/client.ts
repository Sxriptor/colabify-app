import { createBrowserClient } from '@supabase/ssr'

// Singleton instance for browser client
let browserClientInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // In Electron, use the electron-client instead to avoid multiple instances
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    console.warn('⚠️ Use createElectronClient() in Electron environment')
  }
  
  // Return existing client if available
  if (browserClientInstance) {
    return browserClientInstance
  }

  // Create new client only if none exists
  browserClientInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return browserClientInstance
}