import { createClient } from '@/lib/supabase/server'
import { fetchProfilesMap } from '@/lib/profiles'
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

    const { id } = await params

    // Get project with full details
    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        *,
        members:project_members(
          id,
          user_id,
          role,
          status,
          invited_email,
          invited_at,
          joined_at
        ),
        repositories(id, name, full_name, url, connected_at)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      console.error('Project fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
    }

    // Check if user has access to this project
    const hasAccess = project.owner_id === user.id || 
      project.members.some((m: any) => m.user_id === user.id && m.status === 'active') ||
      project.visibility === 'public'

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const profiles = await fetchProfilesMap(
      supabase,
      [project.owner_id, ...(project.members || []).map((member: any) => member.user_id)]
    )

    const normalizedProject = {
      ...project,
      owner: profiles.get(project.owner_id) || null,
      members: (project.members || []).map((member: any) => ({
        ...member,
        user: profiles.get(member.user_id) || null,
      }))
    }

    return NextResponse.json({ project: normalizedProject })
  } catch (error) {
    console.error('Project API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, visibility } = body

    // Check if user is project owner
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
    }

    if (project.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only project owners can update projects' }, { status: 403 })
    }

    // Validate input
    if (name && name.trim().length === 0) {
      return NextResponse.json({ error: 'Project name cannot be empty' }, { status: 400 })
    }

    if (visibility && !['public', 'private'].includes(visibility)) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 })
    }

    // Update project
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (visibility !== undefined) updateData.visibility = visibility

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select(`*`)
      .single()

    if (updateError) {
      console.error('Project update error:', updateError)
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    const profiles = await fetchProfilesMap(supabase, [updatedProject.owner_id])
    const normalizedProject = {
      ...updatedProject,
      owner: profiles.get(updatedProject.owner_id) || null,
    }

    return NextResponse.json({ project: normalizedProject })
  } catch (error) {
    console.error('Project update API error:', error)
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

    const { id } = await params

    // Check if user is project owner
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('owner_id, name')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
    }

    if (project.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only project owners can delete projects' }, { status: 403 })
    }

    // Delete project (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Project deletion error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Project deleted successfully' })
  } catch (error) {
    console.error('Project deletion API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
