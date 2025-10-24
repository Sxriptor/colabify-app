# Notification System Fixes

## Issues Fixed

### 1. Desktop Notifications Not Working in Production Build
**Problem:** The published `.exe` file couldn't access Supabase credentials because the `.env.local` file wasn't being bundled with the application.

**Solution:**
- Updated `electron-builder.json` to include `.env.local` in the build files
- Enhanced `NotificationService.js` to search for `.env.local` in multiple locations:
  - `__dirname/../../.env.local` (relative to service)
  - `process.resourcesPath/.env.local` (packaged app resources)
  - `process.cwd()/.env.local` (current working directory)

### 2. Inbox Notifications Not Showing
**Problem:** The inbox query was trying to access `project_id` and `repository_id` columns that don't exist in the notifications table. These fields are stored in the `data` JSONB column.

**Solution:**
- Updated `InboxContent.tsx` to fetch notifications directly by `user_id`
- Removed incorrect JOIN queries to projects and repositories tables
- Transform notification data to extract `project_id` and `repository_id` from the `data` JSONB field

## Setup Instructions

### For Development
1. Create a `.env.local` file in the project root with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### For Production Build
1. Ensure your `.env.local` file exists in the project root before building
2. Run the build command:
```bash
npm run electron:build:win
```
3. The `.env.local` file will be automatically bundled with your application

## How It Works

### Desktop Notifications Flow
1. When a team member commits code, the database trigger `notify_team_on_live_activity()` fires
2. This creates entries in the `notifications` and `notifications_log` tables
3. The Electron app's `NotificationService` listens for real-time changes via Supabase
4. When a new notification is detected, it displays a system notification

### Inbox Notifications Flow
1. The inbox page fetches notifications from the `notifications` table
2. Notifications are filtered by the current user's ID
3. Project and repository information is extracted from the `data` JSONB field
4. Notifications are displayed with proper formatting

## Troubleshooting

### Desktop Notifications Still Not Working
Check the Electron console logs for:
```
🔧 NotificationService environment check:
  SUPABASE_URL: ✅ Found
  SUPABASE_KEY: ✅ Found
```

If credentials are missing:
1. Verify `.env.local` exists in your project root
2. Verify it contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Rebuild the application

### Inbox Still Empty
Check browser console for errors. Common issues:
- User not authenticated (check `useAuth()` hook)
- Database RLS policies blocking access
- No notifications created for the user yet

To test notification creation, trigger a commit in a watched repository.

## Database Schema Reference

### notifications table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  data JSONB,  -- Contains project_id, repository_id, actor_id, etc.
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### notifications_log table
```sql
CREATE TABLE notifications_log (
  id UUID PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(id),
  user_id UUID NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_method TEXT NOT NULL,  -- 'app' or 'email'
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Next Steps

1. Rebuild your application: `npm run electron:build:win`
2. Test with a fresh commit to a watched repository
3. Check that:
   - Desktop notification appears
   - Notification shows in inbox
   - Email notification is sent (if configured)

