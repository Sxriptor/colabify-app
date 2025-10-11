# Fix 500 Error When Fetching Projects

## Error
```
GET https://cteochxkksltaibnwexx.supabase.co/rest/v1/projects?select=*...
500 (Internal Server Error)
```

## Root Cause
The `project_members` table has RLS enabled but either:
1. Missing required policies (INSERT/UPDATE/DELETE)
2. Circular dependency in SELECT policy causing infinite loop

## Step-by-Step Fix

### Step 1: Check Current State

1. Go to your Supabase project: https://cteochxkksltaibnwexx.supabase.co
2. Open **SQL Editor**
3. Run this to see current policies:

```sql
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'project_members';
```

**Expected output:** You'll probably see a policy with circular dependency or missing INSERT policies.

### Step 2: Apply the Fix

In the same **SQL Editor**, copy and paste this entire script:

```sql
-- Fix project_members RLS policies - Clean slate approach

-- Step 1: Drop ALL existing policies on project_members to start fresh
DROP POLICY IF EXISTS "Users can view their own project memberships" ON project_members;
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Project owners can add members" ON project_members;
DROP POLICY IF EXISTS "Project owners can update members" ON project_members;
DROP POLICY IF EXISTS "Project owners can remove members" ON project_members;

-- Step 2: Create new policies (no circular dependencies)

-- INSERT: Allow project owners to add members
CREATE POLICY "project_members_insert_policy" ON project_members
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

-- SELECT: Allow users to see members of projects they own
-- Simple policy - no circular dependency
CREATE POLICY "project_members_select_policy" ON project_members
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

-- UPDATE: Allow project owners to update members
CREATE POLICY "project_members_update_policy" ON project_members
    FOR UPDATE USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

-- DELETE: Allow project owners to remove members
CREATE POLICY "project_members_delete_policy" ON project_members
    FOR DELETE USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );
```

Click **Run** or press `Ctrl+Enter`.

### Step 3: Verify Policies Were Created

Run this query to confirm:

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'project_members';
```

**Expected output:**
```
policyname                        | cmd
----------------------------------+--------
project_members_insert_policy     | INSERT
project_members_select_policy     | SELECT
project_members_update_policy     | UPDATE
project_members_delete_policy     | DELETE
```

### Step 4: Test the App

1. Reload your Electron app
2. The dashboard should load without 500 errors
3. Try creating a new project - owner should be added to `project_members`
4. Try inviting a user - they should be added to `project_members`

### Step 5: Verify Data

Check that project_members is being populated:

```sql
SELECT
    pm.*,
    u.email,
    p.name as project_name
FROM project_members pm
JOIN users u ON pm.user_id = u.id
JOIN projects p ON pm.project_id = p.id
ORDER BY pm.joined_at DESC;
```

## What Changed

**Before:**
- ❌ Missing INSERT/UPDATE/DELETE policies (RLS blocks all writes)
- ❌ SELECT policy had circular dependency (causes 500 error)

**After:**
- ✅ All CRUD policies present
- ✅ SELECT policy only checks `projects` table (no circular dependency)
- ✅ Project owners can manage members
- ✅ Users can view members of projects they own

## Common Issues

### "Policy already exists" error
- The DROP POLICY statements should prevent this
- If you still get it, manually drop policies in Supabase Dashboard → Database → Policies

### Still getting 500 error after applying fix
1. Clear your browser cache
2. Restart the Electron app
3. Check browser console for the actual error
4. Verify policies were created (Step 3 above)

### "Permission denied" when creating projects
- Make sure you're authenticated
- Check the `projects` table also has proper RLS policies for INSERT

## Files Reference

- `database/migrations/fix_project_members_rls_v2.sql` - The migration to apply
- `database/migrations/test_rls_policies.sql` - Query to check current policies
- `FIX_PROJECT_MEMBERS_ISSUE.md` - Detailed explanation of the issue
