import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { action } = await request.json()
    const { id: invitationId } = await params

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "accept" or "decline"' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    const userEmail = userData?.email || user.email

    // Get the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('email', userEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found or expired' }, { status: 404 })
    }

    if (action === 'accept') {
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', invitation.project_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        return NextResponse.json({ error: 'You are already a member of this project' }, { status: 400 })
      }

      // Add user to project
      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: invitation.project_id,
          user_id: user.id,
          role: 'member',
          status: 'active',
          joined_at: new Date().toISOString(),
        })

      if (memberError) {
        console.error('Error adding member:', memberError)
        return NextResponse.json({ error: 'Failed to join project' }, { status: 500 })
      }
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('project_invitations')
      .update({
        status: action === 'accept' ? 'accepted' : 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId)

    if (updateError) {
      console.error('Error updating invitation:', updateError)
      return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: action === 'accept' ? 'Invitation accepted successfully' : 'Invitation declined successfully'
    })

  } catch (error) {
    console.error('Invitation response API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}