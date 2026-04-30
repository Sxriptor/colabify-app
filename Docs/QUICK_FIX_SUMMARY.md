# Quick Fix Summary - Notifications & Inbox Issues

## Problems Identified

1. **Desktop notifications don't work in the published `.exe`**
   - Environment variables not available in production build
   - `.env.local` file not being bundled

2. **Inbox notifications don't show up**
   - Incorrect database query trying to access non-existent columns
   - Query was looking for `project_id` and `repository_id` as columns, but they're in the `data` JSONB field

3. **Multiple GoTrueClient instances warning**
   - Warning: "Multiple GoTrueClient instances detected in the same browser context"
   - Multiple Supabase clients being created simultaneously
   - Can interfere with notifications and authentication

4. **Emails work, but app and inbox don't**
   - Email system uses separate webhook (works independently)
   - App notification system requires Supabase credentials in Electron

## Fixes Applied

### ✅ Fix #1: Bundle Environment Variables with Production Build
**File:** `electron-builder.json`
- Added `.env.local` to the files array so it gets packaged with the app

**File:** `electron/services/NotificationService.js`
- Enhanced to search for `.env.local` in multiple locations:
  - Development: `__dirname/../../.env.local`
  - Production: `process.resourcesPath/.env.local`
  - Fallback: `process.cwd()/.env.local`

### ✅ Fix #2: Corrected Inbox Notification Query
**File:** `src/components/inbox/InboxContent.tsx`
- Changed query to fetch notifications directly by `user_id` (correct column)
- Removed incorrect JOINs to projects and repositories tables
- Extract `project_id` and `repository_id` from the `data` JSONB field
- Transform data to match expected interface

### ✅ Fix #3: Singleton Pattern for Supabase Clients
**File:** `src/lib/supabase/electron-client.ts`
- Implemented singleton pattern to ensure only one client instance exists
- Client is reused across all components
- Token comparison ensures new client only when token changes
- Added `resetElectronClient()` for logout cleanup

**File:** `src/lib/supabase/client.ts`
- Added singleton pattern for browser client
- Warning if browser client used in Electron

**File:** `src/lib/auth/context.tsx`
- Reset Electron client singleton on logout
- Prevents stale authentication state

## What You Need to Do

### 1. Ensure .env.local Exists
Make sure you have a `.env.local` file in your project root with:
```env
NEXT_PUBLIC_SUPABASE_URL=your-actual-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key
```

### 2. Rebuild the Application
```bash
npm run electron:build:win
```

### 3. Test the Fixes
1. Install the new build
2. Make a commit in a watched repository
3. Verify:
   - ✅ Desktop notification appears
   - ✅ Notification shows in inbox
   - ✅ Email is sent (already working)

## Why This Happened

### Desktop Notifications
The Electron app runs as a standalone application that needs its own copy of environment variables. In development, it reads from `.env.local` in the project directory. In production, the file needs to be bundled with the app.

### Inbox Notifications
The database schema was misunderstood. The `notifications` table structure is:
- ✅ `user_id` - direct column (use this for filtering)
- ❌ `project_id` - NOT a column (stored in `data` JSONB)
- ❌ `repository_id` - NOT a column (stored in `data` JSONB)

## Verification Checklist

After rebuilding and installing:

- [ ] Check Electron console shows: `✅ Supabase client initialized successfully`
- [ ] NO "Multiple GoTrueClient instances" warning appears
- [ ] Make a test commit in a watched repo
- [ ] Desktop notification appears within a few seconds
- [ ] Notification appears in inbox (`/inbox` page)
- [ ] Notification shows correct title and message
- [ ] Email notification arrives (if enabled)
- [ ] Only one "Creating new Electron Supabase client" message appears

## Troubleshooting

### Still no desktop notifications?
1. Open DevTools in Electron app (View → Toggle Developer Tools)
2. Look for logs starting with `🔔`
3. Check for: `🔧 NotificationService environment check`
4. If SUPABASE credentials show ❌, your `.env.local` wasn't bundled

### Still no inbox notifications?
1. Open browser DevTools (F12)
2. Go to `/inbox` page
3. Check Console for errors
4. Look for: `Error fetching notifications:`
5. Check Network tab for failed requests to Supabase

### Still seeing "Multiple GoTrueClient" warning?
This should be fixed now, but if you still see it:
1. Check if any components are using `createClient()` instead of `createElectronClient()`
2. Clear browser cache and rebuild
3. Make sure you're using the latest build

### Need to verify database?
Run this SQL query in Supabase:
```sql
-- Check if notifications are being created
SELECT id, user_id, title, message, created_at, data
FROM notifications
ORDER BY created_at DESC
LIMIT 10;

-- Check notification logs
SELECT nl.*, n.title
FROM notifications_log nl
JOIN notifications n ON n.id = nl.notification_id
WHERE nl.delivery_method = 'app'
ORDER BY nl.created_at DESC
LIMIT 10;
```

## Additional Notes

- The `.env.local` file is gitignored, so it won't be committed to your repository
- Each developer needs their own `.env.local` file for development
- For production builds, make sure to use production Supabase credentials
- The notification system uses Supabase Realtime for instant notifications

