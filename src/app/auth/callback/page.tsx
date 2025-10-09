'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Processing authentication...')
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()

      // Get URL parameters
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')
      const source = searchParams.get('source')

      console.log('Callback page - code:', !!code, 'error:', errorParam, 'source:', source)

      // Check if this is an Electron OAuth flow
      const isElectronFlow = source === 'electron'

      // Handle error
      if (errorParam) {
        setMessage(`Authentication error: ${errorDescription || errorParam}`)
        setIsLoading(false)
        return
      }

      // Handle PKCE code flow
      if (code) {
        try {
          // Exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('Error exchanging code:', error)
            setMessage(`Authentication error: ${error.message}`)
            setIsLoading(false)
            return
          }

          if (data.session) {
            console.log('Session obtained successfully')

            if (isElectronFlow) {
              // For Electron: redirect to custom protocol with tokens
              console.log('Electron flow detected - redirecting to app')

              const electronUrl = `devpulse://auth/callback#access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}&expires_in=${data.session.expires_in}&token_type=${data.session.token_type}`

              setMessage('Authentication successful! Returning to the app...')

              // Redirect to Electron app
              window.location.href = electronUrl

              // Show manual instruction after a delay
              setTimeout(() => {
                setMessage('If the app doesn\'t open automatically, please open it manually.')
                setIsLoading(false)
              }, 2000)
            } else {
              // For web: normal redirect to dashboard
              console.log('Web flow - redirecting to dashboard')
              router.push('/dashboard')
            }
          }
        } catch (err) {
          console.error('Error during callback:', err)
          setMessage('An error occurred during authentication.')
          setIsLoading(false)
        }
      } else {
        // Check for hash (implicit flow - shouldn't happen but handle it)
        if (window.location.hash) {
          const electronUrl = `devpulse://auth/callback${window.location.hash}`
          console.log('Redirecting to Electron app with hash:', electronUrl)
          window.location.href = electronUrl
          setMessage('Returning to the app...')
        } else {
          setMessage('No authentication data received.')
          setIsLoading(false)
        }
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-8">
        {isLoading && (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        )}
        <div className={`${isLoading ? '' : 'mt-4'}`}>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {isLoading ? 'Processing...' : 'Authentication Complete'}
          </h2>
          <p className="text-gray-600">{message}</p>
          {!isLoading && (
            <p className="text-sm text-gray-500 mt-4">
              You can close this window and return to the DevPulse app.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
