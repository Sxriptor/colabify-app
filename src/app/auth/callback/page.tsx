'use client'

import { useEffect } from 'react'

export default function AuthCallbackPage() {
  useEffect(() => {
    // This page handles redirecting Electron users from the web callback
    // to the custom protocol handler with the auth tokens

    const handleCallback = () => {
      // Get the full URL including hash fragment
      const fullUrl = window.location.href

      // Check if we have a hash (implicit flow for Electron)
      if (window.location.hash) {
        // Build the custom protocol URL with the hash
        const electronUrl = `devpulse://auth/callback${window.location.hash}`

        console.log('Redirecting to Electron app:', electronUrl)

        // Redirect to the custom protocol
        window.location.href = electronUrl

        // Show a message to the user
        const messageDiv = document.getElementById('callback-message')
        if (messageDiv) {
          messageDiv.innerHTML = `
            <div class="text-center">
              <h2 class="text-xl font-semibold text-gray-900 mb-2">Authentication Successful!</h2>
              <p class="text-gray-600 mb-4">Returning to the app...</p>
              <p class="text-sm text-gray-500">If the app doesn't open automatically, please open it manually.</p>
            </div>
          `
        }
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div id="callback-message" className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing authentication...</p>
      </div>
    </div>
  )
}
