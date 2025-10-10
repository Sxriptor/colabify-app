'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    electronAPI?: {
      openExternalUrl: (url: string) => Promise<{ success: boolean }>;
      onAuthCallback: (callback: (url: string) => void) => void;
      removeAuthCallback: () => void;
      login: () => Promise<{ success: boolean }>;
      logout: () => Promise<{ success: boolean }>;
      getUser: () => Promise<any>;
      onAuthSuccess: (callback: (data: any) => void) => void;
      onAuthError: (callback: (error: string) => void) => void;
      apiCall: (endpoint: string, options?: any) => Promise<any>;
      isElectron: boolean;
    };
  }
}

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check if this is an Electron platform request
  const isElectronPlatform = searchParams.get('platform') === 'electron'

  useEffect(() => {
    // Set up auth event listeners for Electron
    if (window.electronAPI?.isElectron) {
      window.electronAPI.onAuthSuccess((data) => {
        console.log('Auth success received:', data)
        setLoading(false)
        // Redirect to dashboard
        router.push('/dashboard')
      })

      window.electronAPI.onAuthError((error) => {
        console.error('Auth error received:', error)
        setError(error)
        setLoading(false)
      })
    }
  }, [router])

  const handleGitHubLogin = async () => {
    setLoading(true)
    setError(null)

    // Check if we're actually in Electron environment
    const isActuallyElectron = window.electronAPI?.isElectron === true

    console.log('🔍 Auth Debug Info:')
    console.log('Is Actually Electron:', isActuallyElectron)
    console.log('Is Electron Platform Param:', isElectronPlatform)
    console.log('Has Electron API:', !!window.electronAPI)

    if (isActuallyElectron && window.electronAPI) {
      // Use the Electron auth flow - we're in the actual Electron app
      try {
        console.log('🔄 Using Electron auth flow - calling window.electronAPI.login()')
        const result = await window.electronAPI.login()
        console.log('✅ Electron login result:', result)
        // Loading state will be handled by auth success/error callbacks
      } catch (error) {
        console.error('❌ Electron login error:', error)
        setError('Failed to initiate login')
        setLoading(false)
      }
    } else {
      // Web flow - always use production URL for consistency
      console.log('Using web auth flow')

      // Always use production URL to avoid localhost/production conflicts
      const redirectUrl = isElectronPlatform
        ? 'https://colabify.xyz/auth/callback?source=electron'
        : 'https://colabify.xyz/auth/callback'

      console.log('Redirect URL:', redirectUrl)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUrl,
        },
      })

      console.log('OAuth data:', data)
      console.log('OAuth error:', error)

      if (error) {
        console.error('OAuth error:', error)
        setError(error.message)
        setLoading(false)
      }
      // For web, the browser will handle the redirect automatically
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="text-center space-y-4">
        <p className="text-sm text-gray-600">
          Sign in to Colabify using your GitHub account to get started with clean repository notifications.
        </p>

        <button
          type="button"
          onClick={handleGitHubLogin}
          disabled={loading}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
          </svg>
          {loading ? 'Connecting to GitHub...' : 'Continue with GitHub'}
        </button>

        <p className="text-xs text-gray-500">
          We use GitHub OAuth to authenticate users and access repository information for notifications.
        </p>
      </div>
    </div>
  )
}
