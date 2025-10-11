-- Cleanup script if you already partially applied the migration
-- Run this first if you get errors, then run the main migration

-- IMPORTANT: Drop policies FIRST (they depend on the function)
DROP POLICY IF EXISTS "Users can view invitations for their projects or sent to their email" ON project_invitations;
DROP POLICY IF EXISTS "Users can update invitations for their projects or sent to them" ON project_invitations;
DROP POLICY IF EXISTS "Users can view other users in accessible projects" ON users;
DROP POLICY IF EXISTS "Users can view projects they are invited to" ON projects;

-- Now drop the helper function (nothing depends on it anymore)
DROP FUNCTION IF EXISTS has_pending_invitation(UUID, UUID);

-- Now you can run the main fix_invitation_rls_policies.sql migration

