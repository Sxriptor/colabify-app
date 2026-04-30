# Mac DMG Notification Fix

## Problem
Notifications work in development mode (`npm start`) on Mac but don't work when the app is installed from the DMG file. This is a common issue with signed Electron apps on macOS.

## Root Cause
macOS requires specific entitlements for notifications when an app is:
1. Code signed (which happens during DMG creation)
2. Distributed outside the Mac App Store
3. Running with hardened runtime enabled

## Solution Applied

### 1. Added Notification Entitlement
Updated `build/entitlements.mac.plist` to include:
```xml
<key>com.apple.security.user-notifications</key>
<true/>
```

### 2. Created Info.plist for Notification Configuration
Created `build/Info.plist` with:
- `NSUserNotificationAlertStyle` set to `alert` for proper notification display
- Proper bundle identifiers and app metadata

### 3. Updated electron-builder Configuration
Modified `electron-builder.json` to include:
```json
"extendInfo": "build/Info.plist"
```

### 4. Enhanced Notification Permission Handling
Updated the main process to:
- Properly request and verify notification permissions on macOS
- Add better error handling and logging
- Test notification permissions during app startup

### 5. Improved Notification Creation
Enhanced the notification handler to:
- Add proper event listeners for debugging
- Better icon path resolution
- More robust error handling

## Testing

### Test in Development
```bash
npm run dev
```
Notifications should work as before.

### Test the DMG Build
1. Build the DMG:
```bash
npm run electron:build:mac
```

2. Install the DMG and test notifications
3. Or use the test script:
```bash
electron test-mac-notifications.js
```

### Debugging
Check the console logs for:
- `✅ Notification permissions verified` - permissions are working
- `✅ Notification shown successfully` - notification displayed
- Any error messages about permissions or notification failures

## Key Files Modified
- `build/entitlements.mac.plist` - Added notification entitlement
- `build/Info.plist` - Created with notification configuration
- `electron-builder.json` - Added Info.plist reference
- `electron/main.js` - Enhanced notification handling
- `test-mac-notifications.js` - Test script for debugging

## Notes
- The entitlement `com.apple.security.user-notifications` is required for signed apps
- The `NSUserNotificationAlertStyle` in Info.plist controls how notifications appear
- Hardened runtime (enabled in electron-builder config) requires explicit entitlements
- This fix maintains compatibility with development mode while fixing DMG builds

## Verification
After building and installing the DMG:
1. Open the app
2. Trigger a notification (e.g., through git activity or manual test)
3. The notification should appear in the macOS notification center
4. Check Console.app for any Colabify-related errors if notifications still don't work