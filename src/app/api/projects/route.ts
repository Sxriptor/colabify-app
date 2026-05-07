import { getAuthenticatedClient } from '@/lib/supabase/api-auth'
import { fetchProfilesMap } from '@/lib/profiles'
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
        repositories(id, name, full_name, url),
        members:project_members(
          id,
          user_id,
          role,
          status
        )
      `)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Projects fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    const profiles = await fetchProfilesMap(
      supabase,
      (projects || []).flatMap((project: any) => [
        project.owner_id,
        ...(project.members || []).map((member: any) => member.user_id),
      ])
    )

    const normalizedProjects = (projects || []).map((project: any) => ({
      ...project,
      owner: profiles.get(project.owner_id) || null,
      members: (project.members || []).map((member: any) => ({
        ...member,
        user: profiles.get(member.user_id) || null,
      }))
    }))

    return NextResponse.json({ projects: normalizedProjects })
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

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        github_id: user.user_metadata?.provider_id ? parseInt(user.user_metadata.provider_id) : null,
        github_username: user.user_metadata?.user_name || user.user_metadata?.preferred_username || null,
        notification_preference: 'instant',
        role: user.user_metadata?.role || 'client',
      })

    if (profileError) {
      console.error('Profile ensure error:', profileError)
      return NextResponse.json({ error: 'Failed to prepare user profile' }, { status: 500 })
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
      .select(`*`)
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

    const profiles = await fetchProfilesMap(supabase, [project.owner_id])
    const normalizedProject = {
      ...project,
      owner: profiles.get(project.owner_id) || null,
    }

    return NextResponse.json({ project: normalizedProject }, { status: 201 })
  } catch (error) {
    console.error('Project creation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

