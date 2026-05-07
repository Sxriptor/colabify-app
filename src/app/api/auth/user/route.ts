import { createClient } from '@/lib/supabase/server'
import { createClient as createDirectClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Check if request has Bearer token (from Electron app)
    const authHeader = request.headers.get('Authorization')
    let supabase

    if (authHeader?.startsWith('Bearer ')) {
      // Use direct client with token for Electron app
      const token = authHeader.replace('Bearer ', '')
      supabase = createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } }
        }
      )
    } else {
      // Use cookie-based client for web browser
      supabase = await createClient()
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, github_id, github_username, notification_preference, notification_preferences')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    // If no profile exists, create one
    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name,
          role: user.user_metadata?.role || 'client',
          github_id: user.user_metadata?.provider_id ? parseInt(user.user_metadata.provider_id) : null,
          github_username: user.user_metadata?.user_name,
          avatar_url: user.user_metadata?.avatar_url,
          notification_preference: 'instant',
        })
        .select('id, email, full_name, role, avatar_url, github_id, github_username, notification_preference, notification_preferences')
        .single()

      if (createError) {
        console.error('Profile creation error:', createError)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }

      return NextResponse.json({ user: { ...newProfile, name: newProfile.full_name } })
    }

    return NextResponse.json({ user: { ...profile, name: profile.full_name } })
  } catch (error) {
    console.error('User API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, notification_preference } = body

    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: name,
        notification_preference,
      })
      .eq('id', user.id)
      .select('id, email, full_name, role, avatar_url, github_id, github_username, notification_preference, notification_preferences')
      .single()

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ user: { ...updatedProfile, name: updatedProfile.full_name } })
  } catch (error) {
    console.error('User update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
