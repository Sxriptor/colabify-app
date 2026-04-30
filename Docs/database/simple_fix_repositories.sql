-- Simple fix for repositories schema issue
-- Run this in Supabase SQL Editor

-- First, let's see what we have
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('repositories', 'repository_local_mappings');

-- Check current repositories table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'repositories';

-- Add owner column if it doesn't exist
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS owner TEXT;

-- If the table doesn't exist at all, create it
CREATE TABLE IF NOT EXISTS repositories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    url TEXT NOT NULL,
    owner TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'repositories_project_id_full_name_key'
    ) THEN
        ALTER TABLE repositories ADD CONSTRAINT repositories_project_id_full_name_key UNIQUE(project_id, full_name);
    END IF;
END $$;

-- Create repository_local_mappings table if it doesn't exist
CREATE TABLE IF NOT EXISTS repository_local_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    local_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint for local mappings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'repository_local_mappings_repository_id_user_id_local_path_key'
    ) THEN
        ALTER TABLE repository_local_mappings ADD CONSTRAINT repository_local_mappings_repository_id_user_id_local_path_key UNIQUE(repository_id, user_id, local_path);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_local_mappings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view repositories for their projects" ON repositories;
DROP POLICY IF EXISTS "Project owners can manage repositories" ON repositories;
DROP POLICY IF EXISTS "Users can view local mappings for their projects" ON repository_local_mappings;
DROP POLICY IF EXISTS "Users can manage their own local mappings" ON repository_local_mappings;

-- Create policies
CREATE POLICY "Users can view repositories for their projects" ON repositories
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid() AND status = 'active'
            UNION
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Project owners can manage repositories" ON repositories
    FOR ALL USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can view local mappings for their projects" ON repository_local_mappings
    FOR SELECT USING (
        user_id = auth.uid() OR
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid() AND status = 'active'
            UNION
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own local mappings" ON repository_local_mappings
    FOR ALL USING (
        user_id = auth.uid() AND
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid() AND status = 'active'
            UNION
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_repositories_project_id ON repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_repository_id ON repository_local_mappings(repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_user_id ON repository_local_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_project_id ON repository_local_mappings(project_id);

-- Final verification
SELECT 'repositories' as table_name, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'repositories'
UNION ALL
SELECT 'repository_local_mappings' as table_name, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'repository_local_mappings'
ORDER BY table_name, column_name;