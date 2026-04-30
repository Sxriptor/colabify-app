# Fix: project_members Not Populating

## Problem
The `project_members` table is not being populated:
1. **Project owners are not being added** when creating a project
2. **Invited users are not being added** when accepting invitations

## Root Cause
The `project_members` table has **Row Level Security (RLS) enabled but NO INSERT policy**.

From `database/schema.sql`:
```sql
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own project memberships" ON project_members
    FOR SELECT USING (user_id = auth.uid());

-- Note: Project member management policies are handled at the application level
-- to avoid circular RLS dependencies between projects and project_members tables
```

**The issue:** When RLS is enabled WITHOUT an INSERT policy, **ALL inserts are blocked by default**.

The comment says "handled at application level" but this doesn't work - RLS policies are required when RLS is enabled.

## Where Inserts Are Attempted

### 1. Electron App - Project Creation
File: `src/components/projects/CreateProjectForm.tsx` (lines 51-59)
```typescript
// Add owner as project member
await supabase
  .from('project_members')
  .insert({
    project_id: project.id,
    user_id: authUser.id,
    role: 'owner',
    status: 'active',
    joined_at: new Date().toISOString(),
  })
```
**Result:** Insert fails silently due to RLS blocking

### 2. Website API - Project Creation
File: `src/app/api/projects/route.ts` (lines 91-99)
```typescript
// Add owner as project member
await supabase
  .from('project_members')
  .insert({
    project_id: project.id,
    user_id: user.id,
    role: 'owner',
    status: 'active',
    joined_at: new Date().toISOString(),
  })
```
**Result:** Insert fails silently due to RLS blocking

### 3. Website - Invitation Acceptance
File: `src/lib/invitations.ts` (lines 115-123)
```typescript
// Create project membership
const { error: memberError } = await supabase
  .from('project_members')
  .insert({
    project_id: projectId,
    user_id: userId,
    role: 'member',
    status: 'active',
    joined_at: new Date().toISOString(),
  })
```
**Result:** Insert fails, error returned but not handled properly

## Solution

Run the migration: `database/migrations/fix_project_members_rls.sql`

This adds the missing RLS policies:

```sql
-- Allow project owners to add members to their projects
CREATE POLICY "Project owners can add members" ON project_members
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

-- Allow project owners to update members in their projects
CREATE POLICY "Project owners can update members" ON project_members
    FOR UPDATE USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

-- Allow project owners to remove members from their projects
CREATE POLICY "Project owners can remove members" ON project_members
    FOR DELETE USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

-- Allow users to see members of projects they belong to
CREATE POLICY "Users can view members of their projects" ON project_members
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );
```

## How to Apply Fix

### In Supabase Dashboard

1. Go to **SQL Editor** in your Supabase project
2. Copy the contents of `database/migrations/fix_project_members_rls.sql`
3. Paste and run the SQL
4. Verify policies were created:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'project_members';
   ```

### Test After Applying

1. **Create a new project** - Owner should be added to `project_members`
2. **Invite a user** - Invited user should be added to `project_members`
3. **Check the table**:
   ```sql
   SELECT * FROM project_members;
   ```

## Why This Affects Both Electron and Website

- **Electron app** uses Supabase client with Bearer token authentication
- Bearer token represents the authenticated user (`auth.uid()`)
- RLS policies check `auth.uid()` for both cookie and token auth
- Missing policies block inserts from **both sources**

## Related Files

- `database/schema.sql` - Original schema with incomplete RLS
- `database/migrations/fix_project_members_rls.sql` - Fix migration
- `src/components/projects/CreateProjectForm.tsx` - Electron project creation
- `src/app/api/projects/route.ts` - Website project creation API
- `src/lib/invitations.ts` - Invitation acceptance logic
