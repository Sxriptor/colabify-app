-- Fix missing RLS policies for project_members table
-- Issue: project_members has RLS enabled but no INSERT/UPDATE/DELETE policies
-- This blocks the owner from being added during project creation and invited users from being added

-- IMPORTANT: First drop the old SELECT policy that might cause circular dependency
DROP POLICY IF EXISTS "Users can view their own project memberships" ON project_members;

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

-- Allow users to see members of projects they own or are part of
-- This replaces the old policy and avoids circular dependency
CREATE POLICY "Users can view project members" ON project_members
    FOR SELECT USING (
        -- User owns the project
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
        OR
        -- User is viewing their own membership record
        user_id = auth.uid()
    );
