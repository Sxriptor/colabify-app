import { createClient } from '@/lib/supabase/server'
import { createClient as createDirectClient } from '@supabase/supabase-js'
import { sendInvitationEmails } from '@/lib/invitations'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: projectId } = await params
    const body = await request.json()
    const { emails } = body

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Email addresses are required' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = emails.filter((email: string) => !emailRegex.test(email))
    
    if (invalidEmails.length > 0) {
      return NextResponse.json({ error: 'Invalid email addresses provided' }, { status: 400 })
    }

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
      return NextResponse.json({ error: 'Only project owners can send invitations' }, { status: 403 })
    }

    // Process invitations using the new invitation service
    const results = await sendInvitationEmails(emails, projectId, user.id)

    return NextResponse.json({ 
      message: 'Invitations processed',
      results 
    })

  } catch (error) {
    console.error('Invitation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}