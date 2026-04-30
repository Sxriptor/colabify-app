-- ============================================
-- FIX INVITATION INBOX RLS POLICIES
-- ============================================
--
-- PROBLEM: Invited users cannot see invitations in their inbox
--
-- ROOT CAUSE: Missing RLS policies on 4 tables:
--   1. project_invitations - invited users can't view invitations sent to them
--   2. users - users can't view owner/member info for projects they have access to
--   3. projects - invited users can't view project details for pending invitations
--   4. project_members - invited users can't add themselves when accepting invitations
--
-- SOLUTION: Add comprehensive RLS policies while avoiding circular dependencies
--   - Create helper function with SECURITY DEFINER to bypass RLS
--   - Update project_invitations policies to allow invited users
--   - Update users policies to allow viewing project-related users
--   - Add projects policy to allow viewing invited projects
--   - Update project_members INSERT policy to allow invited users to accept
--
-- FIXES:
--   - Empty inbox for invited users
--   - "Cannot read properties of null" errors for project.owner
--   - "Cannot read properties of null" errors for invitation.project
--   - 500 errors from circular RLS dependencies
--   - 403 Forbidden errors when accepting invitations
--
-- ============================================

-- ============================================
-- FIX PROJECT_INVITATIONS TABLE POLICIES
-- ============================================

-- Drop existing SELECT policy to replace it with a better one
DROP POLICY IF EXISTS "Project owners can view invitations for their projects" ON project_invitations;

-- Create new SELECT policy that allows both project owners AND invited users to view invitations
CREATE POLICY "Users can view invitations for their projects or sent to their email" ON project_invitations
    FOR SELECT USING (
        -- Project owners can see invitations for their projects
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
        OR
        -- Users can see invitations sent to their email
        email IN (
            SELECT email FROM users WHERE id = auth.uid()
        )
    );

-- Drop existing UPDATE policy to replace it with a better one
DROP POLICY IF EXISTS "Project owners can update invitations" ON project_invitations;

-- Create new UPDATE policy that allows both project owners AND invited users to update invitations
CREATE POLICY "Users can update invitations for their projects or sent to them" ON project_invitations
    FOR UPDATE USING (
        -- Project owners can update invitations for their projects
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
        OR
        -- Invited users can update invitations sent to their email (to accept/decline)
        email IN (
            SELECT email FROM users WHERE id = auth.uid()
        )
    );

-- ============================================
-- CREATE HELPER FUNCTION FIRST
-- ============================================

-- Create helper function to check if user has pending invitation WITHOUT triggering RLS
-- This avoids circular dependency between projects and project_invitations
-- MUST be defined before being used in policies
CREATE OR REPLACE FUNCTION has_pending_invitation(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_invitations pi
    JOIN users u ON pi.email = u.email
    WHERE pi.project_id = project_uuid 
    AND u.id = user_uuid
    AND pi.status = 'pending'
  );
$$;

-- ============================================
-- FIX USERS TABLE POLICIES
-- ============================================

-- Drop existing "view own profile" policy to replace with comprehensive one
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Add policy to allow viewing user info for project owners/members when you have access to the project
CREATE POLICY "Users can view other users in accessible projects" ON users
    FOR SELECT USING (
        -- Always allow viewing own profile
        id = auth.uid()
        OR
        -- Allow viewing users who own projects you're invited to
        id IN (
            SELECT p.owner_id FROM projects p
            WHERE has_pending_invitation(p.id, auth.uid())
        )
        OR
        -- Allow viewing users who own projects you're a member of
        id IN (
            SELECT p.owner_id FROM projects p
            JOIN project_members pm ON pm.project_id = p.id
            WHERE pm.user_id = auth.uid()
        )
        OR
        -- Allow viewing users who are members of projects you're in or own
        id IN (
            SELECT pm.user_id FROM project_members pm
            WHERE pm.project_id IN (
                SELECT id FROM projects WHERE owner_id = auth.uid()
                UNION
                SELECT project_id FROM project_members WHERE user_id = auth.uid()
            )
        )
    );

-- ============================================
-- FIX PROJECTS TABLE POLICIES
-- ============================================

-- Add policy to allow users to view basic info about projects they have been invited to
CREATE POLICY "Users can view projects they are invited to" ON projects
    FOR SELECT USING (
        -- Users can view projects they have pending invitations for
        -- Uses helper function to avoid circular RLS dependency
        has_pending_invitation(id, auth.uid())
    );

-- ============================================
-- FIX PROJECT_MEMBERS TABLE POLICIES
-- ============================================

-- Drop existing INSERT policy to replace with one that allows invited users to accept
DROP POLICY IF EXISTS "project_members_insert" ON project_members;

-- Create new INSERT policy that allows:
-- 1. Project owners to add members
-- 2. Invited users to add themselves when accepting invitations
CREATE POLICY "project_members_insert" ON project_members
    FOR INSERT WITH CHECK (
        -- Project owners can add anyone
        is_project_owner(project_id, auth.uid())
        OR
        -- Users can add themselves if they have a pending invitation
        (
            user_id = auth.uid()
            AND has_pending_invitation(project_id, auth.uid())
        )
    );

-- ============================================
-- DOCUMENTATION
-- ============================================

-- Add comments to document the fix
COMMENT ON POLICY "Users can view invitations for their projects or sent to their email" ON project_invitations IS 
'Allows project owners to view invitations for their projects, and invited users to view invitations sent to their email address';

COMMENT ON POLICY "Users can update invitations for their projects or sent to them" ON project_invitations IS 
'Allows project owners to update/cancel invitations, and invited users to accept/decline invitations sent to their email';

COMMENT ON POLICY "Users can view projects they are invited to" ON projects IS 
'Allows users to view basic information about projects they have been invited to, so they can see project details in their inbox';

COMMENT ON FUNCTION has_pending_invitation IS 
'Helper function to check if a user has a pending invitation to a project. Uses SECURITY DEFINER to bypass RLS and avoid circular dependencies.';

COMMENT ON POLICY "project_members_insert" ON project_members IS 
'Allows project owners to add members, and invited users to add themselves when accepting invitations';

