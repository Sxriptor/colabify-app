# Notification Settings Feature

## Overview
Added a notification settings dropdown with a bell icon positioned to the left of the signout button in the dashboard navigation.

## Features
- **Bell Icon**: Clickable bell icon in the navigation bar
- **Dropdown Menu**: Small dropdown with 3 toggle switches
- **Settings**: 
  - Notifications (general notifications)
  - App Notifications (in-app notifications)
  - Email Notifications (email notifications)

## Database Schema
Added `notification_preferences` column to the `users` table:
- **Type**: JSONB
- **Default**: `{"notifications": true, "email": true, "app": true}`
- **Structure**: 
  ```json
  {
    "notifications": boolean,
    "email": boolean,
    "app": boolean
  }
  ```

## Files Created/Modified

### New Files
1. `src/components/notifications/NotificationSettings.tsx` - Main notification settings dropdown component
2. `src/hooks/useNotificationPreferences.ts` - Reusable hook for managing notification preferences
3. `supabase/migrations/20241214000000_add_notification_preferences.sql` - Database migration

### Modified Files
1. `src/components/dashboard/DashboardContent.tsx` - Added NotificationSettings component to navigation

## Usage
The notification settings are automatically loaded when a user logs in and can be toggled individually. Changes are saved immediately to the database.

## Migration Required
Run the database migration to add the notification_preferences column:
```bash
cd supabase
npx supabase db push
```

## Component Structure
```
NotificationSettings
├── Bell icon button
└── Dropdown (when open)
    ├── Notifications toggle
    ├── App Notifications toggle
    └── Email Notifications toggle
```

## Styling
- Uses Tailwind CSS for styling
- Consistent with existing design system
- Smooth transitions and hover effects
- Responsive design