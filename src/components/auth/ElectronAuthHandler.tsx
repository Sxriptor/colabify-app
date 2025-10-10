'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function ElectronAuthHandler() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleElectronAuth = async () => {
      // Check if this is an OAuth callback with a code
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      
      if (!code && !error) {
        return // Not an OAuth callback
      }

      console.log('🔍 Detected OAuth callback on root page')
      console.log('Code:', !!code)
      console.log('Error:', error)

      // Check if this might be for Electron (we'll assume it is since it's on root page)
      if (code) {
        try {
          console.log('🔄 Processing OAuth code for potential Electron flow')
          
          const supabase = createClient()
          
          // Exchange code for session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            console.error('❌ Error exchanging code:', exchangeError)
            return
          }

          if (data.session) {
            console.log('✅ Session obtained, redirecting to Electron')
            
            // Redirect to Electron app with token
            const electronUrl = `colabify://auth/callback?token=${data.session.access_token}`
            console.log('🚀 Redirecting to:', electronUrl)
            
            // Show user feedback
            document.body.innerHTML = `
              <div style="
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                font-family: system-ui, -apple-system, sans-serif;
                background: #f9fafb;
                color: #374151;
              ">
                <div style="text-align: center; max-width: 400px; padding: 2rem;">
                  <div style="
                    width: 48px; 
                    height: 48px; 
                    border: 3px solid #e5e7eb; 
                    border-top: 3px solid #3b82f6; 
                    border-radius: 50%; 
                    animation: spin 1s linear infinite; 
                    margin: 0 auto 1rem;
                  "></div>
                  <h2 style="margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 600;">
                    Authentication Successful!
                  </h2>
                  <p style="margin: 0 0 1rem; color: #6b7280;">
                    Returning to DevPulse app...
                  </p>
                  <p style="margin: 0; font-size: 0.875rem; color: #9ca3af;">
                    If the app doesn't open automatically, please open it manually.
                  </p>
                </div>
                <style>
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                </style>
              </div>
            `
            
            // Attempt redirect
            window.location.href = electronUrl
            
          }
        } catch (err) {
          console.error('❌ Error in Electron auth handler:', err)
        }
      }
    }

    handleElectronAuth()
  }, [searchParams])

  return null // This component doesn't render anything
}