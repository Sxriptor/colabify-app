import { createClient } from '@/lib/supabase/server'
import { fetchProfilesMap } from '@/lib/profiles'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email from profiles
    const { data: userData } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const userEmail = userData?.email || user.email

    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Get pending invitations for this user's email
    const { data: invitations, error } = await supabase
      .from('project_invitations')
      .select(`
        id,
        project_id,
        email,
        invited_by,
        status,
        expires_at,
        created_at,
        project:projects(id, name, description, visibility)
      `)
      .eq('email', userEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user invitations:', error)
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
    }

    const profiles = await fetchProfilesMap(
      supabase,
      (invitations || []).map((invitation: any) => invitation.invited_by)
    )

    const normalizedInvitations = (invitations || []).map((invitation: any) => ({
      ...invitation,
      inviter: profiles.get(invitation.invited_by) || null
    }))

    return NextResponse.json({ invitations: normalizedInvitations })

  } catch (error) {
    console.error('Invitations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
