'use client'

import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'

export function PushNotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification
  } = usePushNotifications()

  const { updatePreferences } = useNotificationPreferences()

  const handleToggleSubscription = async () => {
    if (isSubscribed) {
      await unsubscribe()
      // Also disable app notifications in preferences
      await updatePreferences({ app: false })
    } else {
      await subscribe()
      // Also enable app notifications in preferences
      await updatePreferences({ app: true })
    }
  }

  const getPermissionStatusText = () => {
    switch (permission) {
      case 'granted':
        return 'Granted'
      case 'denied':
        return 'Denied'
      default:
        return 'Not requested'
    }
  }

  const getPermissionStatusColor = () => {
    switch (permission) {
      case 'granted':
        return 'text-green-600'
      case 'denied':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (!isSupported) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Push Notifications
        </label>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm text-gray-600">
              Push notifications are not supported in your browser
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Push Notifications
      </label>

      <div className="space-y-4">
        {/* Permission Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
          <div>
            <div className="text-sm font-medium text-gray-900">System Permission Status</div>
            <div className={`text-sm ${getPermissionStatusColor()}`}>
              {getPermissionStatusText()}
            </div>
          </div>
        </div>

        {/* Test Notification */}
        {permission === 'granted' && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <div>
              <div className="text-sm font-medium text-gray-900">Test Notification</div>
              <div className="text-sm text-gray-500">
                Send a test notification to verify everything is working
              </div>
            </div>
            <button
              onClick={sendTestNotification}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
            >
              Send Test
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Information */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-gray-800">
              <div className="font-medium mb-1">How to Enable Notifications</div>
              <div>
                Use the notification bell icon in the top navigation bar to enable or disable app notifications.
                The system will request permission the first time you enable them.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}