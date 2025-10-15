'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'

export function TestNotificationButton() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const createTestNotification = async () => {
    if (!user) return

    setLoading(true)
    setMessage('')

    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Use the create_notification function we created in the migration
      const { data, error } = await supabase.rpc('create_notification', {
        p_user_id: user.id,
        p_title: 'Test Notification',
        p_message: `This is a test notification created at ${new Date().toLocaleTimeString()}`,
        p_type: 'info'
      })

      if (error) throw error

      setMessage('✅ Test notification created! Check your system notifications and inbox.')
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error creating test notification:', error)
      setMessage('❌ Failed to create test notification: ' + error.message)
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={createTestNotification}
        disabled={loading || !user}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Creating...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Test Notification
          </>
        )}
      </button>
      
      {message && (
        <p className={`text-sm ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}