# Fix for Multiple GoTrueClient Instances Warning

## Problem
When simulating git activity in the published `.exe`, you see this warning:
```
Multiple GoTrueClient instances detected in the same browser context. 
It is not an error, but this should be avoided as it may produce undefined 
behavior when used concurrently under the same storage key.
```

This warning appears because multiple Supabase clients were being created simultaneously, which can:
- Interfere with authentication state
- Cause notifications to fail
- Lead to unpredictable behavior with concurrent requests

## Root Cause
The `createElectronClient()` function was creating a new Supabase client instance every time it was called. Since multiple components (inbox, notifications, etc.) call this function, multiple GoTrueClient instances were being created.

## Solution
Implemented a **singleton pattern** for Supabase clients to ensure only one instance exists at a time.

### Changes Made

#### 1. `src/lib/supabase/electron-client.ts`
- Added singleton instance variables
- Client is only created once and reused
- Token is checked - if it changes, a new client is created
- Added `resetElectronClient()` function for logout
- Configured client with:
  - `persistSession: false` - Don't persist auth state
  - `autoRefreshToken: false` - Token managed by Electron
  - `detectSessionInUrl: false` - Not needed in Electron
  - `storage: undefined` - Disable storage to prevent conflicts

#### 2. `src/lib/supabase/client.ts`
- Added singleton pattern for browser client
- Added warning if trying to use browser client in Electron environment

#### 3. `src/lib/auth/context.tsx`
- Updated `signOut()` to reset the Electron client singleton
- Updated `onAuthSignedOut` event handler to reset client
- Ensures clean state on logout

## How It Works

### Before (Multiple Instances ❌)
```
Component A calls createElectronClient() → New Supabase Client #1
Component B calls createElectronClient() → New Supabase Client #2
Component C calls createElectronClient() → New Supabase Client #3
⚠️ Multiple GoTrueClient warning!
```

### After (Singleton ✅)
```
Component A calls createElectronClient() → Creates Supabase Client #1
Component B calls createElectronClient() → Returns existing Client #1
Component C calls createElectronClient() → Returns existing Client #1
✅ Single client instance, no warnings!
```

## Testing the Fix

1. **Rebuild the application:**
   ```bash
   npm run electron:build:win
   ```

2. **Test git activity:**
   - Make a commit in a watched repository
   - Check the console - warning should be gone
   - Desktop notification should appear
   - Notification should show in inbox

3. **Test logout/login:**
   - Sign out
   - Sign back in
   - Make another commit
   - Verify notifications still work

## Expected Console Output

### Before Fix
```
⚠️ Multiple GoTrueClient instances detected in the same browser context...
```

### After Fix
```
🔄 Creating new Electron Supabase client
✅ Supabase client initialized successfully
🔔 Starting real-time notification listening for user: xxx
✅ Real-time notifications ACTIVE and listening for user: xxx
```

Only one "Creating new Electron Supabase client" message should appear, unless:
- User logs out and logs back in (client reset)
- Token changes (client recreated)

## Additional Benefits

This fix also:
- ✅ Reduces memory usage (fewer client instances)
- ✅ Prevents potential race conditions
- ✅ Improves authentication consistency
- ✅ Faster subsequent requests (reuses existing connection)

## Troubleshooting

### Still seeing multiple client warnings?
1. Check if you have other places creating Supabase clients
2. Search for `createClient` in your codebase
3. Ensure all Electron components use `createElectronClient()`

### Notifications stopped working after logout?
- This is expected and normal
- The client is reset on logout for security
- New client is created automatically on next login

### Token changes not detected?
- The singleton compares tokens and creates a new client if token changes
- Check console for "🔄 Creating new Electron Supabase client" message
- If not appearing, token might not be changing as expected

