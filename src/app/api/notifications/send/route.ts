import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

// Configure web-push with VAPID keys
// You'll need to generate these keys for production
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || ''
}

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    'mailto:your-email@example.com', // Replace with your email
    vapidKeys.publicKey,
    vapidKeys.privateKey
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { userId, title, body, url, data } = await request.json()

    // Get current user (for authorization - only allow certain users to send notifications)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For now, allow any authenticated user to send notifications
    // In production, you might want to restrict this to admin users or system processes

    if (!userId || !title || !body) {
      return NextResponse.json({ 
        error: 'userId, title, and body are required' 
      }, { status: 400 })
    }

    // Get the user's push subscription
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('subscription_data')
      .eq('user_id', userId)
      .single()

    if (subscriptionError || !subscriptionData) {
      return NextResponse.json({ 
        error: 'No push subscription found for user' 
      }, { status: 404 })
    }

    // Prepare notification payload
    const notificationPayload = {
      title,
      body,
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-72x72.svg',
      tag: 'Colabify-notification',
      data: {
        url: url || '/dashboard',
        ...data
      },
      actions: [
        {
          action: 'view',
          title: 'View',
          icon: '/icons/icon-72x72.svg'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    }

    // Send push notification
    if (vapidKeys.publicKey && vapidKeys.privateKey) {
      try {
        await webpush.sendNotification(
          subscriptionData.subscription_data,
          JSON.stringify(notificationPayload)
        )
        
        console.log('Push notification sent successfully')
      } catch (pushError) {
        console.error('Error sending push notification:', pushError)
        return NextResponse.json({ 
          error: 'Failed to send push notification' 
        }, { status: 500 })
      }
    } else {
      console.warn('VAPID keys not configured, skipping push notification')
    }

    // Log the notification in the database
    const { error: logError } = await supabase
      .from('notification_logs')
      .insert({
        user_id: userId,
        title,
        body,
        url: url || '/dashboard',
        data: data || {},
        sent_at: new Date().toISOString(),
        delivery_method: 'push'
      })

    if (logError) {
      console.error('Error logging notification:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ 
      message: 'Notification sent successfully' 
    })

  } catch (error) {
    console.error('Send notification API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}