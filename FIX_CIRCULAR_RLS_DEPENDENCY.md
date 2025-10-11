# Fix Circular RLS Dependency - 500 Error

## The Problem You Found

You discovered that disabling RLS on `project_members` fixes the 500 error. This confirms **circular dependency between two RLS policies:**

### The Circular Loop:
```
1. Query projects table
   ↓
2. Projects RLS policy checks: "is user a member?"
   ↓
3. Queries project_members table
   ↓
4. project_members RLS policy checks: "does user own the project?"
   ↓
5. Queries projects table again
   ↓
6. INFINITE LOOP → 500 Error
```

### The Conflicting Policies:

**In `projects` table:**
```sql
CREATE POLICY "Users can view projects they are members of" ON projects
    FOR SELECT USING (
        owner_id = auth.uid()
        OR
        id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );
```

**In `project_members` table:**
```sql
CREATE POLICY "project_members_select_policy" ON project_members
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );
```

☠️ **Each policy queries the other table, creating infinite recursion!**

## The Solution

Use a **helper function with `SECURITY DEFINER`** that bypasses RLS to check ownership without triggering recursion.

### How It Works:

1. **Helper function** checks project ownership WITHOUT RLS
2. **project_members policies** use the helper function (no query to projects table with RLS)
3. **projects policies** can safely query project_members (no more circular dependency)

## Apply the Fix

### Step 1: Go to Supabase SQL Editor

https://cteochxkksltaibnwexx.supabase.co → **SQL Editor**

### Step 2: Run This Migration

Copy and paste from: `database/migrations/fix_circular_rls_final.sql`

Or paste this directly:

```sql
-- Fix circular RLS dependency between projects and project_members
-- Solution: Use a helper function to check ownership without triggering RLS recursion

-- ========================================
-- STEP 1: Create helper function
-- ========================================

-- This function checks if a user owns a project WITHOUT triggering RLS
-- It uses security definer to bypass RLS checks
CREATE OR REPLACE FUNCTION is_project_owner(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_uuid AND owner_id = user_uuid
  );
$$;

-- ========================================
-- STEP 2: Fix project_members policies
-- ========================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own project memberships" ON project_members;
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Project owners can add members" ON project_members;
DROP POLICY IF EXISTS "Project owners can update members" ON project_members;
DROP POLICY IF EXISTS "Project owners can remove members" ON project_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_select_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_update_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_delete_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_select" ON project_members;
DROP POLICY IF EXISTS "project_members_insert" ON project_members;
DROP POLICY IF EXISTS "project_members_update" ON project_members;
DROP POLICY IF EXISTS "project_members_delete" ON project_members;

-- Create new policies using the helper function (avoids circular dependency)

-- SELECT: Users can see members of projects they own or are part of
CREATE POLICY "project_members_select" ON project_members
    FOR SELECT USING (
        -- User is viewing their own membership
        user_id = auth.uid()
        OR
        -- User owns the project (uses helper function to avoid recursion)
        is_project_owner(project_id, auth.uid())
    );

-- INSERT: Project owners can add members
CREATE POLICY "project_members_insert" ON project_members
    FOR INSERT WITH CHECK (
        is_project_owner(project_id, auth.uid())
    );

-- UPDATE: Project owners can update members
CREATE POLICY "project_members_update" ON project_members
    FOR UPDATE USING (
        is_project_owner(project_id, auth.uid())
    );

-- DELETE: Project owners can remove members
CREATE POLICY "project_members_delete" ON project_members
    FOR DELETE USING (
        is_project_owner(project_id, auth.uid())
    );

-- ========================================
-- STEP 3: Keep projects policies simple
-- ========================================

-- Projects can now safely check project_members because project_members
-- uses the helper function instead of querying projects directly

-- The projects table should already have this policy, but let's make sure:
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;

CREATE POLICY "Users can view projects they are members of" ON projects
    FOR SELECT USING (
        owner_id = auth.uid()
        OR
        id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );
```

### Step 3: Verify

1. **Check the function exists:**
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'is_project_owner';
   ```

2. **Check policies were created:**
   ```sql
   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'project_members';
   ```

   Expected output:
   ```
   project_members_select  | SELECT
   project_members_insert  | INSERT
   project_members_update  | UPDATE
   project_members_delete  | DELETE
   ```

3. **Test the app** - reload Electron app, no more 500 error!

## What Changed

**Before:**
- ❌ `projects` policy queries `project_members` with RLS
- ❌ `project_members` policy queries `projects` with RLS
- ❌ Circular dependency → infinite loop → 500 error

**After:**
- ✅ `is_project_owner()` function bypasses RLS using `SECURITY DEFINER`
- ✅ `project_members` policies use helper function (no RLS recursion)
- ✅ `projects` policies safely query `project_members` (one-way dependency)
- ✅ No more circular dependency → no more 500 error

## Why This Is a Database Issue (Not App Code)

RLS policies are enforced at the **Postgres database level**, not in your application code:

- Electron app sends query to Supabase
- Supabase Postgres checks RLS policies before returning data
- Circular dependency happens **inside Postgres** during policy evaluation
- App never receives response (500 error from database)

**Both Electron app and website are affected** because they both query the same database with the same RLS policies.

**The fix must be applied to the database** (Supabase SQL Editor).

## Related Files

- `database/migrations/fix_circular_rls_final.sql` - The fix to apply
- `FIX_PROJECT_MEMBERS_ISSUE.md` - Original issue about missing INSERT policies
- `FIX_500_ERROR_SUPABASE.md` - Earlier attempt (didn't address circular dependency)
