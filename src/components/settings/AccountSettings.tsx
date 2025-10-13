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

  // GitHub PAT state
  const [githubPAT, setGithubPAT] = useState('')
  const [showPAT, setShowPAT] = useState(false)
  const [hasPAT, setHasPAT] = useState(false)
  const [patSaving, setPatSaving] = useState(false)
  const [patSuccess, setPatSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
    checkExistingPAT()
  }, [])

  const checkExistingPAT = async () => {
    // Check if we're in Electron
    const isElectron = typeof window !== 'undefined' && (window as any).electronAPI

    if (isElectron) {
      try {
        const electronAPI = (window as any).electronAPI
        if (electronAPI && electronAPI.hasUserPAT) {
          const hasPat = await electronAPI.hasUserPAT()
          setHasPAT(hasPat)
          if (hasPat) {
            console.log('✅ User-provided PAT is configured')
          } else {
            console.log('ℹ️ No user-provided PAT found')
          }
        }
      } catch (error) {
        console.error('Error checking PAT:', error)
      }
    }
  }

  const handleSavePAT = async () => {
    if (!githubPAT.trim()) {
      setError('Please enter a GitHub Personal Access Token')
      return
    }

    setPatSaving(true)
    setError(null)
    setPatSuccess(null)

    try {
      // Check if we're in Electron
      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI

      if (!isElectron) {
        throw new Error('GitHub PAT can only be saved in the Electron app')
      }

      // Validate the token by making a test request
      const testResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${githubPAT}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })

      if (!testResponse.ok) {
        throw new Error('Invalid GitHub token. Please check your token and try again.')
      }

      const userData = await testResponse.json()

      // Save to Electron secure storage
      const electronAPI = (window as any).electronAPI
      const result = await electronAPI.invoke('auth:save-github-token', githubPAT)

      if (result.success) {
        setHasPAT(true)
        setGithubPAT('')
        setPatSuccess(`Token validated and saved! Authenticated as ${userData.login}`)
        setTimeout(() => setPatSuccess(null), 5000)
      } else {
        throw new Error('Failed to save token')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save token')
    } finally {
      setPatSaving(false)
    }
  }

  const handleRemovePAT = async () => {
    if (!confirm('Are you sure you want to remove your GitHub Personal Access Token?')) {
      return
    }

    try {
      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI
      if (!isElectron) return

      const electronAPI = (window as any).electronAPI
      await electronAPI.invoke('auth:remove-github-token')

      setHasPAT(false)
      setGithubPAT('')
      setPatSuccess('GitHub token removed successfully')
      setTimeout(() => setPatSuccess(null), 3000)
    } catch (err) {
      setError('Failed to remove token')
    }
  }

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

      {/* API Personal Access Token */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">API Personal Access Token</h3>
          <p className="text-sm text-gray-500 mt-1">Required to access private repositories and GitHub API features</p>
        </div>
        <div className="p-6 space-y-4">
          {patSuccess && (
            <div className="rounded-md bg-green-50 border border-green-200 p-4">
              <div className="text-sm text-green-800">{patSuccess}</div>
            </div>
          )}

          {hasPAT ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">API Token Configured</div>
                    <div className="text-xs text-gray-500">Your private repositories and API features are accessible</div>
                  </div>
                </div>
                <button
                  onClick={handleRemovePAT}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remove Token
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <p>✅ Token is active and will be used for GitHub API requests</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">How to create an API Personal Access Token:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline">GitHub Settings → Personal Access Tokens (Classic)</a></li>
                  <li>Click "Generate new token (classic)"</li>
                  <li>Give it a name (e.g., "DevPulse API")</li>
                  <li>Select the <strong>repo</strong> scope (full control of private repositories)</li>
                  <li>Click "Generate token" and copy it</li>
                </ol>
              </div>

              <div>
                <label htmlFor="github-pat" className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Access Token (Classic)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPAT ? "text" : "password"}
                      id="github-pat"
                      value={githubPAT}
                      onChange={(e) => setGithubPAT(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPAT(!showPAT)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPAT ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <button
                    onClick={handleSavePAT}
                    disabled={patSaving || !githubPAT.trim()}
                    className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    {patSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Validating...
                      </>
                    ) : (
                      'Save Token'
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  ⚠️ Your token is stored securely and never sent to our servers. It's only used locally for GitHub API requests.
                </p>
              </div>
            </div>
          )}
        </div>
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