'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { PushNotificationSettings } from './PushNotificationSettings'

interface UserSettings {
  id: string
  email: string
  name: string
  notification_preference: 'instant' | 'digest'
  avatar_url: string | null
  github_username: string | null
}

export function AccountSettings() {
  const { user, signOut } = useAuth()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    notification_preference: 'instant' as 'instant' | 'digest'
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error) throw error

      setSettings(data)
      setFormData({
        name: data.name || '',
        notification_preference: data.notification_preference || 'instant'
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          notification_preference: formData.notification_preference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUser.id)
        .select()
        .single()

      if (error) throw error

      setSettings(data)
      setSuccessMessage('Settings updated successfully!')

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>
        <p className="text-gray-600">Manage your account preferences and notification settings</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <div className="text-sm text-green-800">{successMessage}</div>
        </div>
      )}

      {/* Profile Information */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={settings?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your display name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>
          </div>

          {settings?.github_username && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Username
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings.github_username}
                  disabled
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <a
                  href={`https://github.com/${settings.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-800 hover:text-gray-900 text-sm"
                >
                  View Profile
                </a>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Notification Settings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Email Notifications
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="notification_preference"
                  value="instant"
                  checked={formData.notification_preference === 'instant'}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">Instant Notifications</div>
                  <div className="text-sm text-gray-500">Receive notifications immediately when events occur</div>
                </div>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="notification_preference"
                  value="digest"
                  checked={formData.notification_preference === 'digest'}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">Daily Digest</div>
                  <div className="text-sm text-gray-500">Receive a summary of notifications once per day</div>
                </div>
              </label>
            </div>
          </div>

          {/* Push Notifications Section */}
          <PushNotificationSettings />
        </div>
      </div>

      {/* Account Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Account Actions</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Sign Out</h4>
                <p className="text-sm text-gray-500">Sign out of your account on this device</p>
              </div>
              <button
                onClick={signOut}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}