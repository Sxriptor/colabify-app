'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugAuth() {
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [oauthUrl, setOauthUrl] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    const getDebugInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      setDebugInfo({
        currentUrl: window.location.href,
        origin: window.location.origin,
        hostname: window.location.hostname,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        nodeEnv: process.env.NODE_ENV,
        session: session ? 'Active' : 'None',
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        isProduction: window.location.hostname === 'colabify.xyz',
        isLocalhost: window.location.hostname === 'localhost'
      })
    }

    getDebugInfo()
  }, [])

  const testOAuth = async () => {
    const redirectUrl = `${window.location.origin}/auth/callback`
    console.log('🔍 Testing OAuth with redirect:', redirectUrl)
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: redirectUrl,
      },
    })
    
    console.log('🔍 OAuth result:', { data, error })
    
    if (data?.url) {
      setOauthUrl(data.url)
      console.log('🔍 Generated OAuth URL:', data.url)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Auth Debug Info</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-6">
        <h2 className="font-semibold mb-2">Environment Info:</h2>
        <pre className="text-sm overflow-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <button
        onClick={testOAuth}
        className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
      >
        Test GitHub OAuth (Check Console)
      </button>
      
      {oauthUrl && (
        <div className="mt-4 p-4 bg-yellow-100 rounded">
          <h3 className="font-semibold mb-2">Generated OAuth URL:</h3>
          <div className="text-sm break-all font-mono bg-white p-2 rounded">
            {oauthUrl}
          </div>
        </div>
      )}
      
      <div className="mt-6 text-sm text-gray-600">
        <p>1. Click the button above to generate OAuth URL</p>
        <p>2. Compare the URL between localhost and production</p>
        <p>3. Check the browser console for detailed logs</p>
      </div>
    </div>
  )
}