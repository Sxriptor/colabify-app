'use client'

import { useState, useEffect } from 'react'

interface PermissionStatus {
  status: 'granted' | 'denied' | 'checking'
  reason?: 'not_supported' | 'system_denied'
  needsSystemSettings?: boolean
}

export function NotificationPermissionStatus() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({ status: 'checking' })

  useEffect(() => {
    checkPermissionStatus()
  }, [])

  const checkPermissionStatus = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const result = await (window as any).electronAPI.checkNotificationPermission()
        setPermissionStatus(result)
      } catch (error) {
        console.error('Failed to check notification permission:', error)
        setPermissionStatus({ status: 'denied', reason: 'not_supported' })
      }
    } else {
      // Web environment
      if ('Notification' in window) {
        setPermissionStatus({ status: Notification.permission as 'granted' | 'denied' })
      } else {
        setPermissionStatus({ status: 'denied', reason: 'not_supported' })
      }
    }
  }

  const openSystemPreferences = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.openExternalUrl('x-apple.systempreferences:com.apple.preference.notifications')
    }
  }

  if (permissionStatus.status === 'checking') {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span>Checking notification permissions...</span>
      </div>
    )
  }

  if (permissionStatus.status === 'granted') {
    return (
      <div className="flex items-center space-x-2 text-sm text-green-600">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span>Notifications enabled</span>
      </div>
    )
  }

  // Permission denied
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2 text-sm text-red-600">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span>Notifications disabled</span>
      </div>
      
      {permissionStatus.needsSystemSettings && (
        <div className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded-md p-2">
          <p className="font-medium mb-1">To enable notifications:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open System Preferences</li>
            <li>Go to Notifications & Focus</li>
            <li>Find "Colabify" in the list</li>
            <li>Enable "Allow Notifications"</li>
          </ol>
          <button
            onClick={openSystemPreferences}
            className="mt-2 text-blue-600 hover:text-blue-800 underline text-xs"
          >
            Open System Preferences
          </button>
        </div>
      )}
      
      {permissionStatus.reason === 'not_supported' && (
        <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2">
          Notifications are not supported on this system.
        </div>
      )}
    </div>
  )
}