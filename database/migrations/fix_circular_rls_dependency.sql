-- Fix circular RLS dependency between projects and project_members
-- Issue: projects policy checks project_members, project_members policy checks projects
-- This causes infinite loop and 500 errors

-- ========================================
-- PART 1: Fix project_members policies
-- ========================================

-- Drop all existing policies on project_members
DROP POLICY IF EXISTS "Users can view their own project memberships" ON project_members;
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Project owners can add members" ON project_members;
DROP POLICY IF EXISTS "Project owners can update members" ON project_members;
DROP POLICY IF EXISTS "Project owners can remove members" ON project_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_select_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_update_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_delete_policy" ON project_members;

-- Create new policies for project_members (SIMPLE - no subqueries to projects)
-- These policies do NOT reference the projects table to avoid circular dependency

CREATE POLICY "project_members_select" ON project_members
    FOR SELECT USING (
        -- User can see their own membership records
        user_id = auth.uid()
    );

CREATE POLICY "project_members_insert" ON project_members
    FOR INSERT WITH CHECK (
        -- Any authenticated user can insert (we'll validate at app level)
        -- Or check if inserting themselves
        user_id = auth.uid()
    );

CREATE POLICY "project_members_update" ON project_members
    FOR UPDATE USING (
        user_id = auth.uid()
    );

CREATE POLICY "project_members_delete" ON project_members
    FOR DELETE USING (
        user_id = auth.uid()
    );

-- ========================================
-- PART 2: Fix projects policies
-- ========================================

-- Now the projects table can safely check project_members
-- because project_members no longer checks projects

-- Drop and recreate the projects policy
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;

CREATE POLICY "Users can view projects they are members of" ON projects
    FOR SELECT USING (
        -- User owns the project
        owner_id = auth.uid()
        OR
        -- User is a member of the project
        id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

-- Make sure projects has INSERT policy for creating projects
DROP POLICY IF EXISTS "Users can create projects" ON projects;

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (
        owner_id = auth.uid()
    );

-- Allow owners to update their projects
DROP POLICY IF EXISTS "Users can update own projects" ON projects;

CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (
        owner_id = auth.uid()
    );

-- Allow owners to delete their projects
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (
        owner_id = auth.uid()
    );
