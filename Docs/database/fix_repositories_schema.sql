-- Quick fix for repositories schema issue
-- Run this in Supabase SQL Editor if migrations aren't working

-- Check if repositories table exists and what columns it has
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'repositories' 
ORDER BY column_name;

-- If the table exists but doesn't have the 'owner' column, add it
DO $$
BEGIN
    -- Check if owner column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'repositories' AND column_name = 'owner'
    ) THEN
        -- Add the owner column
        ALTER TABLE repositories ADD COLUMN owner TEXT;
        RAISE NOTICE 'Added owner column to repositories table';
    ELSE
        RAISE NOTICE 'Owner column already exists in repositories table';
    END IF;
END $$;

-- Ensure the table has all required columns
DO $$
BEGIN
    -- Create the table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repositories') THEN
        CREATE TABLE repositories (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            full_name TEXT NOT NULL,
            url TEXT NOT NULL,
            owner TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(project_id, full_name)
        );
        RAISE NOTICE 'Created repositories table';
    END IF;

    -- Create repository_local_mappings table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repository_local_mappings') THEN
        CREATE TABLE repository_local_mappings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            local_path TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(repository_id, user_id, local_path)
        );
        RAISE NOTICE 'Created repository_local_mappings table';
    END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_local_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$
BEGIN
    -- Repositories policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'repositories' AND policyname = 'Users can view repositories for their projects'
    ) THEN
        CREATE POLICY "Users can view repositories for their projects" ON repositories
            FOR SELECT USING (
                project_id IN (
                    SELECT project_id FROM project_members 
                    WHERE user_id = auth.uid() AND status = 'active'
                    UNION
                    SELECT id FROM projects WHERE owner_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'repositories' AND policyname = 'Project owners can manage repositories'
    ) THEN
        CREATE POLICY "Project owners can manage repositories" ON repositories
            FOR ALL USING (
                project_id IN (
                    SELECT id FROM projects WHERE owner_id = auth.uid()
                )
            );
    END IF;

    -- Repository local mappings policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'repository_local_mappings' AND policyname = 'Users can view local mappings for their projects'
    ) THEN
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
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'repository_local_mappings' AND policyname = 'Users can manage their own local mappings'
    ) THEN
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
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_repositories_project_id ON repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_repository_id ON repository_local_mappings(repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_user_id ON repository_local_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_project_id ON repository_local_mappings(project_id);

-- Verify the schema
SELECT 'repositories' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'repositories' 
UNION ALL
SELECT 'repository_local_mappings' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'repository_local_mappings'
ORDER BY table_name, column_name;