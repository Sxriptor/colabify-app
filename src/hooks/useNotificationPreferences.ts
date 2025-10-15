'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'

export interface NotificationPreferences {
  notifications: boolean
  email: boolean
  app: boolean
}

const defaultPreferences: NotificationPreferences = {
  notifications: true,
  email: true,
  app: true
}

export function useNotificationPreferences() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPreferences = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', user.id)
        .single()

      if (fetchError) throw fetchError

      if (data?.notification_preferences) {
        setPreferences({ ...defaultPreferences, ...data.notification_preferences })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load preferences'
      setError(errorMessage)
      console.error('Error loading notification preferences:', err)
    } finally {
      setLoading(false)
    }
  }

  const updatePreferences = async (newPreferences: Partial<NotificationPreferences>) => {
    if (!user) return

    const updatedPreferences = { ...preferences, ...newPreferences }
    
    setLoading(true)
    setError(null)

    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { error: updateError } = await supabase
        .from('users')
        .update({ notification_preferences: updatedPreferences })
        .eq('id', user.id)

      if (updateError) throw updateError

      setPreferences(updatedPreferences)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update preferences'
      setError(errorMessage)
      console.error('Error updating notification preferences:', err)
      // Don't revert on error - let the component handle it
    } finally {
      setLoading(false)
    }
  }

  const togglePreference = (key: keyof NotificationPreferences) => {
    updatePreferences({ [key]: !preferences[key] })
  }

  // Load preferences when user changes
  useEffect(() => {
    if (user) {
      loadPreferences()
    } else {
      setPreferences(defaultPreferences)
    }
  }, [user])

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    togglePreference,
    refetch: loadPreferences
  }
}