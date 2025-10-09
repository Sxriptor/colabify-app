import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user settings
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, email, name, notification_preference, avatar_url, github_username')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching user settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    return NextResponse.json({ settings: userData })

  } catch (error) {
    console.error('Settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate the settings
    const allowedFields = ['name', 'notification_preference']
    const updates: any = {}

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        if (key === 'notification_preference' && !['instant', 'digest'].includes(value as string)) {
          return NextResponse.json({ error: 'Invalid notification preference' }, { status: 400 })
        }
        updates[key] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Update user settings
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select('id, email, name, notification_preference, avatar_url, github_username')
      .single()

    if (error) {
      console.error('Error updating user settings:', error)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Settings updated successfully',
      settings: updatedUser 
    })

  } catch (error) {
    console.error('Settings update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}