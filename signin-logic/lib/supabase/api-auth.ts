import { createClient } from '@supabase/supabase-js'

/**
 * Get authenticated Supabase client for API routes
 * Uses Bearer token from Authorization header (Electron only)
 */
export function getAuthenticatedClient(request: Request) {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } }
    }
  )
}