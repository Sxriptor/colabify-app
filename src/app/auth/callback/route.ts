import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser } from '@/lib/auth/user-management'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🚀 AUTH CALLBACK HIT! 🚀')
  console.log('Request URL:', request.url)
  console.log('Request headers:', Object.fromEntries(request.headers.entries()))
  console.log('Environment variables:')
  console.log('- NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL)
  console.log('- NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
  console.log('- NODE_ENV:', process.env.NODE_ENV)
  
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('Auth callback params:', { code: !!code, next, origin })

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.redirect(`${origin}/auth/auth-code-error`)
    }

    console.log('Auth successful, user:', authData.user?.email)

    if (authData.user) {
      try {
        console.log('Creating/getting user record...')
        const user = await getOrCreateUser(authData.user)
        console.log('User record created/found:', user?.email)
      } catch (error) {
        console.error('Error creating user record:', error)
        // Don't fail the auth flow, just log the error
      }
    }

    console.log('Redirecting to:', `${origin}${next}`)
    return NextResponse.redirect(`${origin}${next}`)
  }

  console.log('No code provided, redirecting to error page')
  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}