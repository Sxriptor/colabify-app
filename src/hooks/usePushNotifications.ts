'use client'

import { useState, useEffect, useCallback } from 'react'
import { pushNotificationManager, NotificationPayload } from '@/lib/notifications'
import { useAuth } from '@/lib/auth/context'

export interface UsePushNotificationsReturn {
  isSupported: boolean
  permission: NotificationPermission
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
  requestPermission: () => Promise<boolean>
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  sendTestNotification: () => Promise<void>
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check support and initial state
  useEffect(() => {
    const checkSupport = async () => {
      const supported = pushNotificationManager.isSupported()
      setIsSupported(supported)

      if (supported) {
        setPermission(pushNotificationManager.getPermissionStatus())
        await checkSubscriptionStatus()
      } else {
        setIsLoading(false)
      }
    }

    checkSupport()
  }, [])

  // Check if user is currently subscribed
  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const subscription = await pushNotificationManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (err) {
      console.error('Error checking subscription status:', err)
      setError(err instanceof Error ? err.message : 'Failed to check subscription status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Push notifications are not supported')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const newPermission = await pushNotificationManager.requestPermission()
      setPermission(newPermission)
      
      if (newPermission === 'granted') {
        return true
      } else {
        setError('Notification permission denied')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request permission'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Push notifications are not supported')
      return false
    }

    if (permission !== 'granted') {
      const permissionGranted = await requestPermission()
      if (!permissionGranted) {
        return false
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await pushNotificationManager.initialize()
      setIsSubscribed(success)

      // If in Electron and user is logged in, start the notification service
      if (success && user && typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          const { createElectronClient } = await import('@/lib/supabase/electron-client')
          const supabase = await createElectronClient()
          const { data: { session } } = await supabase.auth.getSession()

          if (session?.access_token) {
            await (window as any).electronAPI.invoke('notifications:init', user.id, session.access_token)
            console.log('✅ Electron notification service started')
          }
        } catch (electronError) {
          console.warn('Failed to start Electron notification service:', electronError)
        }
      }

      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, permission, requestPermission, user])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const success = await pushNotificationManager.unsubscribe()

      if (success) {
        // Also remove from server (if not in Electron)
        if (typeof window !== 'undefined' && !(window as any).electronAPI?.isElectron) {
          await fetch('/api/notifications/subscribe', {
            method: 'DELETE'
          })
        }

        // Stop Electron notification service if in Electron
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          try {
            await (window as any).electronAPI.invoke('notifications:stop')
            console.log('✅ Electron notification service stopped')
          } catch (electronError) {
            console.warn('Failed to stop Electron notification service:', electronError)
          }
        }

        setIsSubscribed(false)
      }

      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unsubscribe'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Send a test notification
  const sendTestNotification = useCallback(async (): Promise<void> => {
    if (!isSubscribed) {
      setError('Not subscribed to notifications')
      return
    }

    try {
      const payload: NotificationPayload = {
        title: 'Colabify Test Notification',
        body: 'This is a test notification to verify everything is working!',
        url: '/dashboard',
        data: { test: true }
      }

      await pushNotificationManager.showLocalNotification(payload)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send test notification'
      setError(errorMessage)
    }
  }, [isSubscribed])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification
  }
}