import { getAuthenticatedClient } from '@/lib/supabase/api-auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = getAuthenticatedClient(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Auth error in projects API:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Projects API - User ID:', user.id)

    // Test if RLS is working by checking auth.uid()
    const { data: authTest } = await supabase.rpc('auth_uid_test')
    console.log('Auth UID test result:', authTest)

    // Get projects where user is owner
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        *,
        owner:users!projects_owner_id_fkey(id, name, email, avatar_url),
        repositories(id, name, full_name, url),
        members:project_members(
          id,
          role,
          status,
          user:users(id, name, email, avatar_url)
        )
      `)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Projects fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Projects API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getAuthenticatedClient(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, visibility } = body

    // Validate input
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    if (visibility && !['public', 'private'].includes(visibility)) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 })
    }

    // Create project
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        visibility: visibility || 'private',
        owner_id: user.id,
      })
      .select(`
        *,
        owner:users!projects_owner_id_fkey(id, name, email, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Project creation error:', error)
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }

    // Add owner as project member
    const { error: memberError } = await supabase
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      console.error('Failed to add owner to project_members:', memberError)
      // Don't fail project creation, but log the error
      // This is likely an RLS issue - see FIX_PROJECT_MEMBERS_ISSUE.md
    }

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('Project creation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

