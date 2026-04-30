# Notification Persistence & System Permission Fix

## Problem Summary

1. **Browser notification toggle didn't persist** - The toggle in settings would reset on page refresh
2. **Git activity test created DB rows but no notifications** - Notifications were created but not shown
3. **System didn't have permission** - Windows wasn't prompting for notification permission
4. **Redundant UI** - Two places to enable notifications (settings + bell dropdown) causing confusion

## Root Causes

1. **No localStorage persistence for Electron** - The `PushNotificationManager` returned `null` for subscription state in Electron, causing the UI to always show "disabled" on refresh
2. **Missing system permission request** - The app wasn't requesting Windows notification permission when enabling notifications
3. **Service not started automatically** - The Electron notification service wasn't started when enabling app notifications
4. **UI confusion** - Both the settings page and the notification bell dropdown had enable/disable toggles

## Changes Made

### 1. Added localStorage Persistence ([notifications.ts](src/lib/notifications.ts))

**Before:**
```typescript
async getSubscription(): Promise<PushSubscription | null> {
  if (this.isElectron()) {
    return null  // ❌ Always null - UI shows disabled
  }
}
```

**After:**
```typescript
private electronSubscriptionState: boolean = false

constructor() {
  // Load subscription state from localStorage for Electron
  if (typeof window !== 'undefined' && this.isElectron()) {
    const saved = localStorage.getItem('electron_notifications_enabled')
    this.electronSubscriptionState = saved === 'true'
  }
}

async getSubscription(): Promise<PushSubscription | null> {
  if (this.isElectron()) {
    // Return truthy value if enabled, null if disabled
    return this.electronSubscriptionState ? ({} as PushSubscription) : null
  }
}

async subscribe(): Promise<PushSubscription | null> {
  if (this.isElectron()) {
    this.electronSubscriptionState = true
    localStorage.setItem('electron_notifications_enabled', 'true')
    return null
  }
}

async unsubscribe(): Promise<boolean> {
  if (this.isElectron()) {
    this.electronSubscriptionState = false
    localStorage.setItem('electron_notifications_enabled', 'false')
    return true
  }
}
```

### 2. Added System Permission Request ([NotificationSettings.tsx](src/components/notifications/NotificationSettings.tsx))

**New function:**
```typescript
const handleAppToggle = async () => {
  const newValue = !preferences.app

  if (newValue) {
    // ✅ Request Windows notification permission
    const permission = await window.electronAPI.requestNotificationPermission()

    if (permission !== 'granted') {
      console.warn('Notification permission denied')
      return
    }

    // ✅ Start the Electron notification service
    if (user && session?.access_token) {
      await window.electronAPI.invoke('notifications:init', user.id, session.access_token)
    }
  } else {
    // Stop service when disabling
    await window.electronAPI.invoke('notifications:stop')
  }

  // Update preferences in DB
  await updatePreferences({ app: newValue })
}
```

**Applied to the App Notifications toggle:**
```tsx
<button
  onClick={handleAppToggle}  // ✅ Now requests permission & starts service
  disabled={loading}
  // ... rest of toggle UI
/>
```

### 3. Simplified Settings Page ([PushNotificationSettings.tsx](src/components/settings/PushNotificationSettings.tsx))

**Before:**
- Permission status display
- Enable/Disable toggle ❌
- Test notification button

**After:**
- Permission status display (read-only)
- Test notification button
- Information box directing users to use the bell icon

**Removed the redundant enable/disable toggle** - now users only use the notification bell dropdown.

### 4. Updated Test Button ([TestNotificationButton.tsx](src/components/notifications/TestNotificationButton.tsx))

**Added auto-enable logic:**
```typescript
// Ensure notifications are enabled before testing
if (!preferences.app) {
  setMessage('⚙️ Enabling app notifications...')
  await updatePreferences({ app: true })

  // Start the notification service
  if (window.electronAPI && user && session?.access_token) {
    await window.electronAPI.invoke('notifications:init', user.id, session.access_token)
  }

  await new Promise(resolve => setTimeout(resolve, 500))
}
```

### 5. Enhanced Subscription Management ([usePushNotifications.ts](src/hooks/usePushNotifications.ts))

**Subscribe now starts Electron service:**
```typescript
const success = await pushNotificationManager.initialize()
setIsSubscribed(success)

// ✅ Start Electron notification service
if (success && user && window.electronAPI) {
  const session = await supabase.auth.getSession()
  if (session?.access_token) {
    await window.electronAPI.invoke('notifications:init', user.id, session.access_token)
  }
}
```

**Unsubscribe now stops Electron service:**
```typescript
const success = await pushNotificationManager.unsubscribe()

if (success) {
  // ✅ Stop Electron notification service
  if (window.electronAPI) {
    await window.electronAPI.invoke('notifications:stop')
  }
  setIsSubscribed(false)
}
```

## User Flow After Fix

### Enabling Notifications (First Time)

1. User clicks **notification bell** icon in top navigation
2. User toggles **"App Notifications"** to ON
3. System shows **Windows notification permission dialog**
4. User clicks **"Allow"**
5. Electron notification service **starts automatically**
6. Toggle stays **enabled** even after refresh ✅

### Testing Notifications

**Option 1: Git Activity Test**
1. User clicks **"Simulate Git Activity"** button
2. If notifications disabled, automatically enables them
3. Creates notification in database
4. Electron service picks it up via real-time subscription
5. Shows **Windows system notification** ✅

**Option 2: Settings Test**
1. User goes to **Settings > Push Notifications**
2. Clicks **"Send Test"** button
3. Shows immediate test notification using `window.electronAPI.showNotification()`
4. Works instantly ✅

### Disabling Notifications

1. User clicks **notification bell** icon
2. User toggles **"App Notifications"** to OFF
3. Electron service **stops automatically**
4. No more notifications shown
5. Toggle stays **disabled** even after refresh ✅

## Technical Details

### localStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `electron_notifications_enabled` | `'true'` / `'false'` | Persists notification enable/disable state |

### Database Storage

| Table | Column | Value |
|-------|--------|-------|
| `users` | `notification_preferences` | `{ "notifications": true, "email": true, "app": true }` |

### IPC Channels

| Channel | Purpose |
|---------|---------|
| `notifications:init` | Start notification service with user ID and access token |
| `notifications:stop` | Stop notification service |
| `request-notification-permission` | Request Windows notification permission |

## Files Modified

1. [src/lib/notifications.ts](src/lib/notifications.ts) - Added localStorage persistence for Electron
2. [src/components/notifications/NotificationSettings.tsx](src/components/notifications/NotificationSettings.tsx) - Added permission request & service management
3. [src/components/settings/PushNotificationSettings.tsx](src/components/settings/PushNotificationSettings.tsx) - Simplified to read-only status
4. [src/components/notifications/TestNotificationButton.tsx](src/components/notifications/TestNotificationButton.tsx) - Auto-enable notifications before testing
5. [src/hooks/usePushNotifications.ts](src/hooks/usePushNotifications.ts) - Start/stop Electron service on subscribe/unsubscribe

## Testing Checklist

- [ ] Enable app notifications via bell dropdown
- [ ] Windows permission dialog appears
- [ ] After allowing, toggle stays enabled
- [ ] Refresh page - toggle still enabled ✅
- [ ] Click "Simulate Git Activity"
- [ ] Windows notification appears ✅
- [ ] Go to Settings > Push Notifications
- [ ] Click "Send Test" - notification appears ✅
- [ ] Disable app notifications via bell dropdown
- [ ] Click "Simulate Git Activity" - no notification (or auto-enables)
- [ ] Re-enable and verify notifications work again

## Notes

- **Single source of truth**: Notification bell dropdown is the only place to enable/disable
- **System permission**: Requested automatically when enabling for the first time
- **Persistence**: Uses localStorage for UI state + DB for preferences + Electron service state
- **Auto-start**: Service starts automatically when enabling notifications
- **Auto-stop**: Service stops automatically when disabling notifications
