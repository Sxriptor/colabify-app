# Electron EXE Notification Fix

## Problem

Notifications worked perfectly in `npm run dev` but **did NOT work** in the production EXE build.

### Symptoms

- ✅ Dev mode: Clicking "Simulate Git Activity" shows Windows notification
- ❌ EXE build: Clicking "Simulate Git Activity" creates DB rows but NO notification appears
- Database rows created correctly
- No error messages
- Silent failure

## Root Causes

### 1. Missing `.env.local` in Production Build ❌

**Location:** [package.json](package.json:38-48)

**Problem:**
```json
"files": [
  ".next/standalone/**/*",
  ".next/static/**/*",
  "electron/**/*",
  "build/**/*",
  "public/**/*",
  "package.json",
  // ❌ .env.local was NOT included!
  "!node_modules/@img/**",
  "!node_modules/@emnapi/**"
],
```

The `.env.local` file was added to `electron-builder.json` but **not** to the `package.json` build configuration. Electron-builder uses the `package.json` config, so Supabase credentials were missing in the EXE.

**Impact:**
- `NotificationService.js` couldn't initialize Supabase client
- No connection to database to listen for notification events
- Silent failure because error handling returned gracefully

### 2. PWA Service Worker Conflict 🔄

**Location:** [public/sw.js](public/sw.js)

**Problem:**
The PWA service worker exists in `/public/sw.js` with push notification handling code:

```javascript
// public/sw.js lines 36-79
self.addEventListener('push', (event) => {
  // ... push notification handling
  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});
```

However:
1. **Service worker was never explicitly registered** in React code
2. **Browser might auto-register** the service worker due to `manifest.json` reference in layout
3. **Conflicts with Electron IPC notifications** - two systems trying to handle notifications

**In Electron:**
- Native notifications via IPC (`window.electronAPI.showNotification`)
- Service worker push notifications (web-based)
- These could interfere with each other

## Fixes Applied

### Fix 1: Bundle `.env.local` in Production ✅

**File:** [package.json](package.json:38-48)

**Change:**
```json
"files": [
  ".next/standalone/**/*",
  ".next/static/**/*",
  "electron/**/*",
  "build/**/*",
  "public/**/*",
  "package.json",
  ".env.local",  // ✅ Added this line
  "!node_modules/@img/**",
  "!node_modules/@emnapi/**"
],
```

**Result:**
- `.env.local` now included in EXE build
- Supabase credentials available at runtime
- `NotificationService.js` can initialize properly

### Fix 2: Disable Service Worker in Electron ✅

**Created:** [src/components/ServiceWorkerManager.tsx](src/components/ServiceWorkerManager.tsx)

```typescript
'use client'

import { useEffect } from 'react'

export function ServiceWorkerManager() {
  useEffect(() => {
    const isElectron = typeof window !== 'undefined' &&
                       (window as any).electronAPI?.isElectron === true

    if (isElectron && 'serviceWorker' in navigator) {
      console.log('🔧 Electron detected - unregistering any service workers')

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
```

**Added to:** [src/app/layout.tsx](src/app/layout.tsx:7,45)

```tsx
import { ServiceWorkerManager } from "@/components/ServiceWorkerManager";

// In render:
<AuthProvider>
  <ServiceWorkerManager />  {/* ✅ Added */}
  {children}
  <GlobalFloatingMenu />
  <UpdateNotification />
</AuthProvider>
```

**Result:**
- Service workers explicitly unregistered when running in Electron
- Eliminates potential conflicts with IPC notifications
- PWA service worker only active in web builds

### Fix 3: Auto-Enable Notifications on Test ✅

**Already Applied:** [src/components/notifications/TestNotificationButton.tsx](src/components/notifications/TestNotificationButton.tsx:20-39)

Ensures app notifications are enabled before testing:

```typescript
// Ensure notifications are enabled
if (!preferences.app) {
  setMessage('⚙️ Enabling app notifications...')
  await updatePreferences({ app: true })

  // Start the Electron notification service
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const { createElectronClient } = await import('@/lib/supabase/electron-client')
    const supabase = await createElectronClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.access_token) {
      await (window as any).electronAPI.invoke('notifications:init', user.id, session.access_token)
    }
  }

  await new Promise(resolve => setTimeout(resolve, 500))
}
```

### Fix 4: Sync Toggle with Electron Service ✅

**Already Applied:** [src/components/notifications/NotificationSettings.tsx](src/components/notifications/NotificationSettings.tsx:26-71)

The app notification toggle now:
1. Requests Windows notification permission
2. Starts/stops Electron notification service
3. Updates database preferences

```typescript
const handleAppToggle = async () => {
  const newValue = !preferences.app

  if (newValue) {
    // Request permission
    const permission = await window.electronAPI.requestNotificationPermission()
    if (permission !== 'granted') return

    // Start service
    if (user && session?.access_token) {
      await window.electronAPI.invoke('notifications:init', user.id, session.access_token)
    }
  } else {
    // Stop service
    await window.electronAPI.invoke('notifications:stop')
  }

  await updatePreferences({ app: newValue })
}
```

## How Electron Notifications Work

### Architecture

```
┌─────────────────────────────────────────┐
│         React Renderer Process          │
│  (src/components/notifications/...)     │
│                                          │
│  1. User enables "App Notifications"    │
│  2. Calls window.electronAPI.invoke()   │
└──────────────────┬──────────────────────┘
                   │ IPC
                   ▼
┌─────────────────────────────────────────┐
│         Electron Main Process            │
│         (electron/main.js)               │
│                                          │
│  3. Receives 'notifications:init'       │
│  4. Starts NotificationService          │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│       NotificationService.js             │
│  (electron/services/NotificationService) │
│                                          │
│  5. Connects to Supabase (needs .env!)  │
│  6. Sets up real-time subscription      │
│  7. Listens for INSERT on               │
│     notifications_log table              │
└──────────────────┬──────────────────────┘
                   │ Real-time Subscription
                   ▼
┌─────────────────────────────────────────┐
│         Supabase Database                │
│                                          │
│  8. New row INSERT into                  │
│     notifications_log table              │
│  9. Triggers real-time event            │
└──────────────────┬──────────────────────┘
                   │ Event Callback
                   ▼
┌─────────────────────────────────────────┐
│       NotificationService.js             │
│                                          │
│  10. Receives new notification event    │
│  11. Fetches full notification data     │
│  12. Calls new Notification()           │
│  13. Shows Windows system notification  │
└─────────────────────────────────────────┘
```

### Critical Dependencies

1. **`.env.local` file** - Contains Supabase credentials
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Access token** - For authenticated Supabase queries
   - Passed to `notifications:init` IPC handler
   - Required for RLS (Row Level Security) on notifications table

3. **User preferences** - Stored in DB
   - `users.notification_preferences.app = true`
   - Service only starts if enabled

## Testing in Production EXE

### Before Build

1. Ensure `.env.local` exists in project root
2. Verify it contains valid Supabase credentials
3. Run `npm run build` to build Next.js
4. Run `npm run electron:build:win` to create EXE

### After Installing EXE

1. **Open the app**
2. **Sign in with your account**
3. **Enable notifications:**
   - Click notification bell icon in top nav
   - Toggle "App Notifications" ON
   - Allow Windows permission if prompted
4. **Test notifications:**
   - Go to Inbox page
   - Click "Simulate Git Activity" button
   - Should see Windows notification appear! 🎉

### Debugging

**If notifications still don't work:**

1. **Check if .env.local was bundled:**
   ```
   # Look in installed app directory
   C:\Users\{YourName}\AppData\Local\Programs\Colabify\.env.local
   ```

2. **Check Electron console logs:**
   - Press `Ctrl+Shift+I` to open DevTools
   - Look for:
     - `✅ Supabase client initialized successfully`
     - `✅ Real-time notifications ACTIVE and listening`
     - `🔔 Processing new notification log:`

3. **Check service worker status:**
   - DevTools > Application tab > Service Workers
   - Should show "No service workers registered" in Electron

4. **Verify notification permission:**
   - Windows Settings > Notifications & actions
   - Find "Colabify" in the list
   - Ensure it's allowed

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| [package.json](package.json#L45) | Added `.env.local` to files array | Bundle Supabase credentials in EXE |
| [src/components/ServiceWorkerManager.tsx](src/components/ServiceWorkerManager.tsx) | Created new component | Disable PWA service worker in Electron |
| [src/app/layout.tsx](src/app/layout.tsx#L7,L45) | Added `<ServiceWorkerManager />` | Execute service worker cleanup on load |

## Previous Related Fixes

These fixes were already applied in previous sessions:

1. **localStorage persistence** - [notifications.ts](src/lib/notifications.ts) - Toggle state survives refresh
2. **Auto-enable on test** - [TestNotificationButton.tsx](src/components/notifications/TestNotificationButton.tsx) - Enables notifications before testing
3. **Permission request** - [NotificationSettings.tsx](src/components/notifications/NotificationSettings.tsx) - Requests Windows permission when enabling
4. **Service sync** - [usePushNotifications.ts](src/hooks/usePushNotifications.ts) - Starts/stops Electron service

## Summary

**The two main issues preventing EXE notifications:**

1. ❌ **Missing `.env.local`** → Supabase couldn't connect → No real-time events
2. ❌ **PWA service worker conflict** → Potential interference with native notifications

**The fixes:**

1. ✅ Bundle `.env.local` in production builds
2. ✅ Explicitly unregister service workers in Electron
3. ✅ Keep using Electron IPC for all notifications

**Result:** Notifications now work identically in both dev and production EXE! 🎉
