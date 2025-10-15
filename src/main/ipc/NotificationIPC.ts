import { ipcMain } from 'electron'
import { NotificationService } from '../services/NotificationService'

let notificationService: NotificationService | null = null

export function setupNotificationIPC() {
  console.log('🔔 Setting up Notification IPC handlers')

  // Initialize notification service
  ipcMain.handle('notifications:init', async (event, userId: string, accessToken?: string) => {
    try {
      console.log('🔔 Initializing notification service for user:', userId)
      
      if (!notificationService) {
        notificationService = new NotificationService()
      }

      // Check if user has app notifications enabled
      const hasAppNotifications = await notificationService.hasAppNotificationsEnabled(userId)
      
      if (hasAppNotifications) {
        notificationService.startPolling(userId, accessToken)
        return { success: true, message: 'Notification service started' }
      } else {
        console.log('📵 App notifications disabled for user')
        return { success: true, message: 'App notifications disabled' }
      }
    } catch (error) {
      console.error('Error initializing notification service:', error)
      return { success: false, error: error.message }
    }
  })

  // Stop notification service
  ipcMain.handle('notifications:stop', async () => {
    try {
      console.log('🔔 Stopping notification service')
      
      if (notificationService) {
        notificationService.stopPolling()
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error stopping notification service:', error)
      return { success: false, error: error.message }
    }
  })

  // Get user notification preferences
  ipcMain.handle('notifications:getPreferences', async (event, userId: string) => {
    try {
      if (!notificationService) {
        notificationService = new NotificationService()
      }

      const preferences = await notificationService.getUserNotificationPreferences(userId)
      return { success: true, preferences }
    } catch (error) {
      console.error('Error getting notification preferences:', error)
      return { success: false, error: error.message }
    }
  })

  // Update notification service when preferences change
  ipcMain.handle('notifications:updatePreferences', async (event, userId: string, preferences: any) => {
    try {
      console.log('🔔 Updating notification preferences for user:', userId)
      
      if (!notificationService) {
        notificationService = new NotificationService()
      }

      // If app notifications were enabled, start polling
      if (preferences.app === true) {
        // We need to get the access token somehow - this might need to be passed from the renderer
        notificationService.startPolling(userId)
      } else {
        // If app notifications were disabled, stop polling
        notificationService.stopPolling()
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      return { success: false, error: error.message }
    }
  })

  // Cleanup on app quit
  ipcMain.handle('notifications:cleanup', async () => {
    try {
      if (notificationService) {
        notificationService.destroy()
        notificationService = null
      }
      return { success: true }
    } catch (error) {
      console.error('Error cleaning up notification service:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('✅ Notification IPC handlers setup complete')
}

// Cleanup function to be called when the app is closing
export function cleanupNotificationIPC() {
  if (notificationService) {
    notificationService.destroy()
    notificationService = null
  }
}