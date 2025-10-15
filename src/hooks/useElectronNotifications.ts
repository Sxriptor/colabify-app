'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'

export function useElectronNotifications() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user || typeof window === 'undefined' || !(window as any).electronAPI) {
      return
    }

    const initializeNotifications = async () => {
      try {
        console.log('🔔 Initializing Electron notifications for user:', user.id)
        
        // Get the current session to pass the access token
        const { createElectronClient } = await import('@/lib/supabase/electron-client')
        const supabase = await createElectronClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        console.log('🔍 Session check:', {
          hasSession: !!session,
          hasAccessToken: !!session?.access_token,
          userId: user.id
        })
        
        const result = await (window as any).electronAPI.invoke('notifications:init', user.id, session?.access_token)
        
        if (result.success) {
          console.log('✅ Electron notifications initialized:', result.message)
        } else {
          console.error('❌ Failed to initialize Electron notifications:', result.error)
        }
      } catch (error) {
        console.error('Error initializing Electron notifications:', error)
      }
    }

    initializeNotifications()

    // Cleanup on unmount
    return () => {
      if ((window as any).electronAPI) {
        (window as any).electronAPI.invoke('notifications:stop').catch(console.error)
      }
    }
  }, [user])

  // Function to update notification preferences
  const updateNotificationPreferences = async (preferences: any) => {
    if (!user || typeof window === 'undefined' || !(window as any).electronAPI) {
      return
    }

    try {
      const result = await (window as any).electronAPI.invoke('notifications:updatePreferences', user.id, preferences)
      
      if (result.success) {
        console.log('✅ Notification preferences updated')
      } else {
        console.error('❌ Failed to update notification preferences:', result.error)
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error)
    }
  }

  return {
    updateNotificationPreferences
  }
}