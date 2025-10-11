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
