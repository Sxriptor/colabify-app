-- Fix project_members RLS policies - Clean slate approach
-- This fixes the 500 error when querying projects

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
