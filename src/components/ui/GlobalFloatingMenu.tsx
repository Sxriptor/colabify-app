'use client'

import { useAuth } from '@/lib/auth/context'
import { FloatingActionMenu } from './FloatingActionMenu'
import { usePathname } from 'next/navigation'

export function GlobalFloatingMenu() {
  const { user } = useAuth()
  const pathname = usePathname()
  
  // Don't show on auth pages, inbox page, or settings page
  const isAuthPage = pathname?.startsWith('/auth') || pathname === '/login' || pathname === '/signup' || pathname === '/debug-auth'
  const isInboxPage = pathname === '/inbox'
  const isSettingsPage = pathname === '/settings'
  
  // Only show if user is authenticated and not on excluded pages
  if (!user || isAuthPage || isInboxPage || isSettingsPage) {
    return null
  }

  return <FloatingActionMenu />
}