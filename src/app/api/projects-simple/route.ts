import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching projects for user:', user.email)

    // Simple query - just get projects owned by user
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Projects fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch projects', details: error }, { status: 500 })
    }

    console.log('Found projects:', projects?.length || 0)
    return NextResponse.json({ projects: projects || [] })
  } catch (error) {
    console.error('Projects API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}