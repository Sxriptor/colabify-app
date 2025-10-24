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

    // Send a test notification to the current user
    const notificationResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || ''
      },
      body: JSON.stringify({
        userId: user.id,
        title: 'Colabify Test Notification',
        body: 'This is a test notification from Colabify! 🚀',
        url: '/dashboard',
        data: {
          test: true,
          timestamp: new Date().toISOString()
        }
      })
    })

    if (!notificationResponse.ok) {
      const errorData = await notificationResponse.json()
      throw new Error(errorData.error || 'Failed to send notification')
    }

    return NextResponse.json({ 
      message: 'Test notification sent successfully!' 
    })

  } catch (error) {
    console.error('Test notification API error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}