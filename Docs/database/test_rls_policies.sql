-- Test script to verify RLS policies are working correctly

-- 1. Check what policies currently exist on project_members
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'project_members';

-- 2. Check if RLS is enabled
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'project_members';

-- 3. Test query (this is what the app is trying to do)
-- This should work without 500 error after fixing policies
-- SELECT * FROM projects WHERE owner_id = auth.uid();
