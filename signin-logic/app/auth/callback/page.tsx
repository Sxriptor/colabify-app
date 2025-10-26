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

      // Check if this is an IDE flow with a stored redirect URI
      const ideRedirectUri = sessionStorage.getItem('ide_redirect_uri')
      console.log('IDE Redirect URI from storage:', ideRedirectUri)

      // Check if this is an Electron OAuth flow
      const isElectronFlow = source === 'electron'
      const isIDEFlow = source === 'ide' && ideRedirectUri

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

            if (isIDEFlow) {
              // For IDE: redirect to the stored redirect URI with token
              console.log('🔄 IDE flow detected - redirecting to callback server')
              console.log('📍 IDE redirect URI:', ideRedirectUri)

              // Build redirect URL with token
              const redirectUrl = new URL(ideRedirectUri)
              redirectUrl.searchParams.set('token', data.session.access_token)

              console.log('🔗 Full redirect URL:', redirectUrl.toString())
              console.log('🔗 Redirect protocol:', redirectUrl.protocol)
              console.log('🔗 Redirect host:', redirectUrl.host)

              setMessage('Authentication successful! Returning to the IDE...')

              // Clear the stored redirect URI AFTER we use it
              sessionStorage.removeItem('ide_redirect_uri')

              // Redirect to the callback server
              console.log('🚀 Attempting redirect via window.location.href...')

              try {
                window.location.href = redirectUrl.toString()
                console.log('✅ Redirect initiated')
              } catch (err) {
                console.error('❌ Redirect failed:', err)
                setMessage('Failed to redirect. Please copy this URL: ' + redirectUrl.toString())
                setIsLoading(false)
              }

              // Show manual instruction after a delay
              setTimeout(() => {
                console.log('⏰ Timeout reached - showing manual instruction')
                setMessage('If the IDE doesn\'t update automatically, please check the application.')
                setIsLoading(false)
              }, 2000)
            } else if (isElectronFlow) {
              // For Electron: redirect to custom protocol with one-time token
              console.log('🔄 Electron flow detected - redirecting to app')

              // Use access token as one-time token for Electron exchange
              const electronUrl = `colabify://auth/callback?token=${data.session.access_token}`
              console.log('🔗 Redirecting to Electron URL:', electronUrl)

              setMessage('Authentication successful! Returning to the app...')

              // Redirect to Electron app
              console.log('🚀 Attempting window.location.href redirect...')
              window.location.href = electronUrl

              // Show manual instruction after a delay
              setTimeout(() => {
                console.log('⏰ Timeout reached - showing manual instruction')
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
        setMessage('No authentication data received.')
        setIsLoading(false)
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
              You can close this window and return to the Colabify app.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}