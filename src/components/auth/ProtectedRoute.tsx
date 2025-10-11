'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

export function ProtectedRoute({ children, redirectTo = '/login' }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [electronAuthChecked, setElectronAuthChecked] = useState(false)
  const [electronAuthenticated, setElectronAuthenticated] = useState(false)

  // Check Electron auth directly if in Electron environment
  useEffect(() => {
    const checkElectronAuth = async () => {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.isElectron) {
        try {
          const electronAPI = (window as any).electronAPI
          const isAuthenticated = await electronAPI.isAuthenticated()
          console.log('🔍 ProtectedRoute: Direct Electron auth check:', isAuthenticated)
          setElectronAuthenticated(isAuthenticated)
        } catch (err) {
          console.error('❌ ProtectedRoute: Error checking Electron auth:', err)
          setElectronAuthenticated(false)
        }
      }
      setElectronAuthChecked(true)
    }

    checkElectronAuth()
  }, [])

  useEffect(() => {
    // Only redirect if we've checked both auth contexts and neither is authenticated
    if (!loading && electronAuthChecked) {
      const isAuthenticated = user || electronAuthenticated
      if (!isAuthenticated) {
        console.log('🚨 ProtectedRoute: No authentication found, redirecting to', redirectTo)
        router.push(redirectTo)
      }
    }
  }, [user, loading, electronAuthChecked, electronAuthenticated, router, redirectTo])

  // Show loading while checking auth
  if (loading || !electronAuthChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-800"></div>
      </div>
    )
  }

  // Check if user is authenticated via either method
  const isAuthenticated = user || electronAuthenticated
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}