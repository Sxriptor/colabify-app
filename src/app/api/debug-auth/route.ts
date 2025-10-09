import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      return NextResponse.json({ error: 'Auth error', details: authError })
    }
    
    if (!user) {
      return NextResponse.json({ error: 'No user found' })
    }
    
    // Try to query the users table
    const { data: customUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    
    return NextResponse.json({
      authUser: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata
      },
      customUser,
      dbError
    })
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: error })
  }
}