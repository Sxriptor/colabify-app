'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignupForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    // Set up auth callback listener for Electron
    if (window.electronAPI?.isElectron) {
      window.electronAPI.onAuthCallback(async (callbackUrl) => {
        console.log('Auth callback received:', callbackUrl)

        try {
          // Parse the URL to extract the hash fragment
          const url = new URL(callbackUrl)
          const hashParams = new URLSearchParams(url.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken) {
            // Set the session in Supabase
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            })

            if (error) {
              console.error('Error setting session:', error)
              setError(error.message)
            } else {
              // Redirect to dashboard
              router.push('/dashboard')
            }
          }
        } catch (err) {
          console.error('Error processing auth callback:', err)
          setError('Failed to process authentication')
        } finally {
          setLoading(false)
        }
      })

      return () => {
        window.electronAPI?.removeAuthCallback()
      }
    }
  }, [supabase, router])

  const handleGitHubSignup = async () => {
    setLoading(true)
    setError(null)

    // Check if running in Electron
    const isElectron = window.electronAPI?.isElectron

    // Add query parameter to identify Electron flow
    const redirectUrl = isElectron
      ? 'https://colabify.xyz/auth/callback?source=electron'
      : 'https://colabify.xyz/auth/callback'

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: isElectron, // Prevent automatic redirect in Electron
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // For Electron, open the OAuth URL in the default browser
    if (isElectron && data?.url && window.electronAPI) {
      console.log('Opening OAuth URL in browser:', data.url)
      await window.electronAPI.openExternalUrl(data.url)
    }
    // For web, the browser will handle the redirect automatically (skipBrowserRedirect is false)
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
          Create your Colabify account using GitHub to get started with clean repository notifications and project management.
        </p>

        <button
          type="button"
          onClick={handleGitHubSignup}
          disabled={loading}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
          </svg>
          {loading ? 'Connecting to GitHub...' : 'Sign up with GitHub'}
        </button>

        <div className="text-xs text-gray-500 space-y-2">
          <p>
            By signing up, you agree to let Colabify access your GitHub repositories for notification purposes.
          </p>
          <p>
            We only read repository activity and never modify your code.
          </p>
        </div>

        <div className="text-center">
          <span className="text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-gray-800 hover:text-gray-900">
              Sign in
            </a>
          </span>
        </div>
      </div>
    </div>
  )
}