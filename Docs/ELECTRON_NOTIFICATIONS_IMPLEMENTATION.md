# Electron App Notifications Implementation

## Overview
Implemented a complete Electron notification system that shows system notifications when users receive notifications in the database. The system respects user notification preferences and only shows notifications if app notifications are enabled.

## Features Implemented

### 1. Database Schema
- **notifications table**: Stores user notifications with title, message, type, and read status
- **notifications_log table**: Tracks delivery status for different notification methods (app, email, push)
- **Automatic cleanup**: Keeps only 10 most recent notifications per user
- **Helper functions**: `create_notification()` and `mark_notification_delivered()`

### 2. Electron Backend Services
- **NotificationService**: Polls Supabase for pending notifications and shows system notifications
- **NotificationIPC**: IPC handlers for communication between renderer and main process
- **Integration**: Added to main Git monitoring backend initialization

### 3. React Components
- **NotificationSettings**: Bell icon dropdown with 3 toggles (notifications, app, email)
- **NotificationInbox**: Displays notifications in the inbox with read/unread status
- **TestNotificationButton**: Creates test notifications for development/testing
- **useElectronNotifications**: Hook to initialize notification service
- **useNotificationPreferences**: Enhanced to sync with Electron service

### 4. System Integration
- **Polling**: Checks for new notifications every 30 seconds
- **System Notifications**: Shows native OS notifications that appear even when app is minimized
- **Preference Sync**: Automatically starts/stops polling when app notification preference changes
- **Inbox Integration**: Added notification inbox to existing inbox page

## Files Created/Modified

### New Files
1. `supabase/migrations/20241214000001_add_notifications_system.sql` - Database schema
2. `src/main/services/NotificationService.ts` - Main notification service
3. `src/main/ipc/NotificationIPC.ts` - IPC handlers
4. `src/hooks/useElectronNotifications.ts` - React hook for Electron integration
5. `src/components/notifications/NotificationInbox.tsx` - Inbox component
6. `src/components/notifications/TestNotificationButton.tsx` - Test button

### Modified Files
1. `src/main/index.ts` - Added notification IPC setup
2. `src/hooks/useNotificationPreferences.ts` - Added Electron sync
3. `src/components/dashboard/DashboardContent.tsx` - Added test button and Electron hook
4. `src/components/inbox/InboxContent.tsx` - Integrated notification inbox

## How It Works

### 1. Notification Creation
```sql
SELECT create_notification(
  user_id, 
  'Notification Title', 
  'Notification message', 
  'info'
);
```

### 2. Electron Polling
- Service polls every 30 seconds for pending app notifications
- Only polls if user has app notifications enabled
- Shows system notification and marks as delivered

### 3. System Notification Flow
1. Notification created in database
2. Electron service detects pending notification
3. Shows native OS notification
4. Marks as delivered in database
5. User can click notification to focus app

### 4. User Preferences
- Bell icon in navigation shows dropdown with 3 toggles
- Changes sync to database and Electron service
- Service starts/stops polling based on app notification preference

## Testing

### 1. Run Database Migration
```bash
cd supabase
npx supabase db push
```

### 2. Test Notification Creation
1. Click "Test Notification" button in dashboard
2. Should see system notification appear
3. Check inbox for notification
4. Toggle app notifications off/on to test preference sync

### 3. Manual Testing
```sql
-- Create a test notification
SELECT create_notification(
  'your-user-id-here',
  'Test System Notification',
  'This should appear as a system notification!',
  'success'
);
```

## Configuration
- Polling interval: 30 seconds (configurable in NotificationService)
- Max notifications per user: 10 (configurable in cleanup function)
- Notification icon: Uses app icon from `build/icon.icns`

## Future Enhancements
- Real-time notifications using Supabase realtime subscriptions
- Different notification sounds for different types
- Notification action buttons
- Email notification delivery
- Push notifications for mobile