import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, projectId, fileChanges } = body

    // Validate required fields
    if (!sessionId || !projectId || !Array.isArray(fileChanges)) {
      return NextResponse.json({ 
        error: 'Missing required fields: sessionId, projectId, fileChanges' 
      }, { status: 400 })
    }

    // Verify user has access to this project
    const { data: projectAccess, error: accessError } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('id', projectId)
      .single()

    if (accessError || !projectAccess) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if user is owner or member
    const isOwner = projectAccess.owner_id === user.id
    const { data: membership } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!isOwner && !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Prepare file changes data for insertion
    const fileChangeRecords = fileChanges.map((change: any) => ({
      session_id: sessionId,
      user_id: user.id,
      project_id: projectId,
      file_path: change.filePath,
      file_type: change.fileType || '',
      change_type: change.changeType,
      lines_added: change.linesAdded || 0,
      lines_removed: change.linesRemoved || 0,
      characters_added: change.charactersAdded || 0,
      characters_removed: change.charactersRemoved || 0,
      first_change_at: change.firstChangeAt || new Date().toISOString(),
      last_change_at: change.lastChangeAt || new Date().toISOString()
    }))

    // Insert file changes (upsert to handle duplicates)
    const { data, error } = await supabase
      .from('live_file_changes')
      .upsert(fileChangeRecords, {
        onConflict: 'session_id,file_path',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      console.error('Error inserting file changes:', error)
      return NextResponse.json({ 
        error: 'Failed to sync file changes',
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: `Synced ${fileChanges.length} file changes`,
      data 
    })

  } catch (error) {
    console.error('File changes sync API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// GET endpoint to retrieve file changes for a session or project
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const projectId = searchParams.get('projectId')

    let query = supabase
      .from('live_file_changes')
      .select('*')

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    } else if (projectId) {
      query = query.eq('project_id', projectId)
    } else {
      return NextResponse.json({ 
        error: 'Either sessionId or projectId must be provided' 
      }, { status: 400 })
    }

    // Only return file changes for this user or their accessible projects
    query = query.eq('user_id', user.id)

    const { data: fileChanges, error } = await query
      .order('last_change_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching file changes:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch file changes' 
      }, { status: 500 })
    }

    return NextResponse.json({ fileChanges })

  } catch (error) {
    console.error('File changes fetch API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

