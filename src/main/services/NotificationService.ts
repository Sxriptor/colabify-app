import { Notification, app } from 'electron'
import { createClient } from '@supabase/supabase-js'

interface AppNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  data?: any
  read: boolean
  created_at: string
}

interface NotificationLog {
  id: string
  notification_id: string
  user_id: string
  delivery_status: 'pending' | 'delivered' | 'failed' | 'dismissed'
  delivery_method: 'app' | 'email' | 'push'
  delivered_at?: string
  error_message?: string
}

export class NotificationService {
  private supabase: any
  private currentUserId: string | null = null
  private pollingInterval: NodeJS.Timeout | null = null
  private isPolling = false
  private lastCheckedAt: Date = new Date()

  constructor() {
    this.initializeSupabase()
  }

  private initializeSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase credentials not found in environment')
      return
    }

    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  // Start notification polling for a user
  startPolling(userId: string, accessToken?: string) {
    console.log('🔔 Starting notification polling for user:', userId)
    
    this.currentUserId = userId
    this.lastCheckedAt = new Date()

    // Set auth token if provided
    if (accessToken && this.supabase) {
      this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: '', // We don't need refresh for polling
        user: { id: userId }
      })
    }

    // Stop existing polling
    this.stopPolling()

    // Start polling every 30 seconds
    this.isPolling = true
    this.pollingInterval = setInterval(() => {
      this.checkForNewNotifications()
    }, 30000)

    // Check immediately
    this.checkForNewNotifications()
  }

  // Stop notification polling
  stopPolling() {
    console.log('🔔 Stopping notification polling')
    
    this.isPolling = false
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  // Check for new notifications
  private async checkForNewNotifications() {
    if (!this.currentUserId || !this.supabase || !this.isPolling) {
      return
    }

    try {
      console.log('🔍 Checking for new notifications...')

      // Get pending app notifications for the current user
      const { data: pendingLogs, error: logsError } = await this.supabase
        .from('notifications_log')
        .select(`
          *,
          notification:notifications(*)
        `)
        .eq('user_id', this.currentUserId)
        .eq('delivery_method', 'app')
        .eq('delivery_status', 'pending')
        .order('created_at', { ascending: false })

      if (logsError) {
        console.error('Error fetching notification logs:', logsError)
        return
      }

      if (!pendingLogs || pendingLogs.length === 0) {
        console.log('📭 No pending notifications')
        return
      }

      console.log(`📬 Found ${pendingLogs.length} pending notifications`)

      // Process each pending notification
      for (const log of pendingLogs) {
        if (log.notification) {
          await this.showSystemNotification(log.notification, log.id)
        }
      }

    } catch (error) {
      console.error('Error checking for notifications:', error)
    }
  }

  // Show system notification
  private async showSystemNotification(notification: AppNotification, logId: string) {
    try {
      console.log('🔔 Showing system notification:', notification.title)

      // Check if notifications are supported and permitted
      if (!Notification.isSupported()) {
        console.warn('System notifications not supported')
        await this.markAsDelivered(logId, 'System notifications not supported')
        return
      }

      // Create the system notification
      const systemNotification = new Notification({
        title: notification.title,
        body: notification.message,
        icon: this.getIconForType(notification.type),
        silent: false,
        urgency: this.getUrgencyForType(notification.type)
      })

      // Handle notification click
      systemNotification.on('click', () => {
        console.log('🖱️ Notification clicked')
        // Focus the app window
        const { BrowserWindow } = require('electron')
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
          const mainWindow = windows[0]
          if (mainWindow.isMinimized()) {
            mainWindow.restore()
          }
          mainWindow.focus()
        }
      })

      // Handle notification close
      systemNotification.on('close', () => {
        console.log('🔔 Notification closed')
      })

      // Show the notification
      systemNotification.show()

      // Mark as delivered
      await this.markAsDelivered(logId)

    } catch (error) {
      console.error('Error showing system notification:', error)
      await this.markAsDelivered(logId, error.message)
    }
  }

  // Mark notification as delivered
  private async markAsDelivered(logId: string, errorMessage?: string) {
    if (!this.supabase) return

    try {
      const updateData: any = {
        delivery_status: errorMessage ? 'failed' : 'delivered',
        delivered_at: new Date().toISOString()
      }

      if (errorMessage) {
        updateData.error_message = errorMessage
      }

      const { error } = await this.supabase
        .from('notifications_log')
        .update(updateData)
        .eq('id', logId)

      if (error) {
        console.error('Error updating notification log:', error)
      } else {
        console.log('✅ Notification marked as delivered')
      }
    } catch (error) {
      console.error('Error marking notification as delivered:', error)
    }
  }

  // Get icon path for notification type
  private getIconForType(type: string): string {
    // You can customize these paths based on your app's icon structure
    const iconPath = app.getAppPath()
    
    switch (type) {
      case 'success':
        return `${iconPath}/build/icon.icns`
      case 'warning':
        return `${iconPath}/build/icon.icns`
      case 'error':
        return `${iconPath}/build/icon.icns`
      default:
        return `${iconPath}/build/icon.icns`
    }
  }

  // Get urgency level for notification type
  private getUrgencyForType(type: string): 'normal' | 'critical' | 'low' {
    switch (type) {
      case 'error':
        return 'critical'
      case 'warning':
        return 'normal'
      case 'success':
        return 'low'
      default:
        return 'normal'
    }
  }

  // Get current user's notification preferences
  async getUserNotificationPreferences(userId: string) {
    if (!this.supabase) return null

    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user notification preferences:', error)
        return null
      }

      return data?.notification_preferences || {
        notifications: true,
        email: true,
        app: true
      }
    } catch (error) {
      console.error('Error getting notification preferences:', error)
      return null
    }
  }

  // Check if user has app notifications enabled
  async hasAppNotificationsEnabled(userId: string): Promise<boolean> {
    const preferences = await this.getUserNotificationPreferences(userId)
    return preferences?.app === true
  }

  // Cleanup method
  destroy() {
    this.stopPolling()
    this.currentUserId = null
  }
}