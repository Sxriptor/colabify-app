import { sendInvitationEmail, sendNotificationEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (type === 'invitation') {
      const result = await sendInvitationEmail({
        recipientEmail: email,
        recipientName: 'Test User',
        projectName: 'Test Project',
        inviterName: 'DevPulse Team',
        inviteUrl: 'https://colabify.xyz/signup?invitation=test-123'
      })

      return NextResponse.json({ 
        success: result,
        message: result ? 'Invitation email sent successfully' : 'Failed to send invitation email'
      })
    }

    if (type === 'notification') {
      const result = await sendNotificationEmail({
        recipientEmail: email,
        recipientName: 'Test User',
        projectName: 'Test Project',
        notifications: [
          {
            message: 'Test user pushed 2 commits to main branch',
            repository: 'test-repo',
            timestamp: new Date().toISOString(),
            eventType: 'push'
          }
        ],
        isDigest: false
      })

      return NextResponse.json({ 
        success: result,
        message: result ? 'Notification email sent successfully' : 'Failed to send notification email'
      })
    }

    return NextResponse.json({ error: 'Invalid email type. Use "invitation" or "notification"' }, { status: 400 })

  } catch (error) {
    console.error('Test email API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}