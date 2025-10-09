import { createClient } from '@/lib/supabase/server'
import { getProjectInvitations, cancelInvitation } from '@/lib/invitations'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Check if user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if user is owner or member
    const isOwner = project.owner_id === user.id
    let isMember = false

    if (!isOwner) {
      const { data: membership } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      isMember = !!membership
    }

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get project members
    const { data: members, error: membersError } = await supabase
      .from('project_members')
      .select(`
        id,
        role,
        status,
        joined_at,
        invited_at,
        user:users(id, name, email, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('joined_at', { ascending: false })

    if (membersError) {
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    // Get pending invitations (only for owners)
    let invitations: any[] = []
    if (isOwner) {
      invitations = await getProjectInvitations(projectId)
    }

    return NextResponse.json({
      members: members || [],
      invitations,
      canManage: isOwner
    })

  } catch (error) {
    console.error('Members API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const invitationId = searchParams.get('invitationId')

    // Check if user is project owner
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only project owners can manage members' }, { status: 403 })
    }

    if (memberId) {
      // Remove project member
      const { error: removeError } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId)
        .eq('project_id', projectId)

      if (removeError) {
        return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Member removed successfully' })
    }

    if (invitationId) {
      // Cancel invitation
      const result = await cancelInvitation(invitationId)
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      return NextResponse.json({ message: 'Invitation cancelled successfully' })
    }

    return NextResponse.json({ error: 'Member ID or Invitation ID required' }, { status: 400 })

  } catch (error) {
    console.error('Remove member API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}