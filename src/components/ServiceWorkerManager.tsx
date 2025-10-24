'use client'

import { useEffect } from 'react'

/**
 * ServiceWorkerManager
 *
 * Prevents PWA service worker registration in Electron builds.
 * In Electron, we use native notifications via IPC instead of web push notifications.
 */
export function ServiceWorkerManager() {
  useEffect(() => {
    // Check if running in Electron
    const isElectron = typeof window !== 'undefined' &&
                       (window as any).electronAPI?.isElectron === true

    if (isElectron && 'serviceWorker' in navigator) {
      console.log('🔧 Electron detected - unregistering any service workers')

      // Unregister all service workers
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().then((success) => {
            if (success) {
              console.log('✅ Service worker unregistered:', registration.scope)
            }
          })
        })
      })
    }
  }, [])

  return null
}
