'use client'

import { useState, useRef, useEffect } from 'react'
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'
import { useAuth } from '@/lib/auth/context'
import { NotificationPermissionStatus } from './NotificationPermissionStatus'

export function NotificationSettings() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const { preferences, loading, togglePreference, updatePreferences } = useNotificationPreferences()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle app notification toggle with system permission request
  const handleAppToggle = async () => {
    const newValue = !preferences.app

    if (newValue) {
      // Enabling - request system permission and start service
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          // Request notification permission
          const permissionResult = await (window as any).electronAPI.requestNotificationPermission()

          if (permissionResult.status !== 'granted') {
            console.warn('Notification permission denied:', permissionResult)
            
            if (permissionResult.needsSystemSettings) {
              // Show user-friendly message for macOS
              alert('Notifications are disabled in System Preferences.\n\nTo enable notifications:\n1. Open System Preferences\n2. Go to Notifications & Focus\n3. Find "Colabify" in the list\n4. Enable "Allow Notifications"\n\nThen try enabling notifications again.')
            } else {
              alert('Notification permission was denied. Please enable notifications in your system settings.')
            }
            return
          }

          // Start the notification service
          if (user) {
            const { createElectronClient } = await import('@/lib/supabase/electron-client')
            const supabase = await createElectronClient()
            const { data: { session } } = await supabase.auth.getSession()

            if (session?.access_token) {
              await (window as any).electronAPI.invoke('notifications:init', user.id, session.access_token)
              console.log('✅ Electron notification service started')
            }
          }
        } catch (error) {
          console.error('Failed to enable notifications:', error)
          alert('Failed to enable notifications. Please try again.')
          return
        }
      }
    } else {
      // Disabling - stop service
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          await (window as any).electronAPI.invoke('notifications:stop')
          console.log('✅ Electron notification service stopped')
        } catch (error) {
          console.warn('Failed to stop notification service:', error)
        }
      }
    }

    // Update preferences
    await updatePreferences({ app: newValue })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
        aria-label="Notification settings"
        title="Notification settings"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Notification Settings</h3>
            
            {/* Permission Status */}
            <div className="mb-4 pb-3 border-b border-gray-200">
              <NotificationPermissionStatus />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Notifications</label>
                <button
                  onClick={() => togglePreference('notifications')}
                  disabled={loading}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                    preferences.notifications ? 'bg-blue-600' : 'bg-gray-300'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                      preferences.notifications ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">App Notifications</label>
                <button
                  onClick={handleAppToggle}
                  disabled={loading}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                    preferences.app ? 'bg-blue-600' : 'bg-gray-300'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                      preferences.app ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Email Notifications</label>
                <button
                  onClick={() => togglePreference('email')}
                  disabled={loading}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                    preferences.email ? 'bg-blue-600' : 'bg-gray-300'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                      preferences.email ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}