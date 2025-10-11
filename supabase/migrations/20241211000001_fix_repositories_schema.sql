-- Fix repositories table schema
-- This migration ensures the repositories table has the correct columns

-- Drop existing table if it exists without the correct schema
DROP TABLE IF EXISTS repository_local_mappings CASCADE;
DROP TABLE IF EXISTS repositories CASCADE;

-- Create repositories table with correct schema
CREATE TABLE repositories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL, -- owner/repo format
  url TEXT NOT NULL,
  owner TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, full_name)
);

-- Create repository_local_mappings table for storing local folder paths
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

-- Add RLS policies for repositories
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view repositories for projects they're members of
CREATE POLICY "Users can view repositories for their projects" ON repositories
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Policy: Only project owners can insert/update/delete repositories
CREATE POLICY "Project owners can manage repositories" ON repositories
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Add RLS policies for repository_local_mappings
ALTER TABLE repository_local_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own local mappings and mappings for projects they're members of
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

-- Policy: Users can manage their own local mappings for projects they're members of
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

-- Add indexes for better performance
CREATE INDEX idx_repositories_project_id ON repositories(project_id);
CREATE INDEX idx_repositories_full_name ON repositories(full_name);
CREATE INDEX idx_repository_local_mappings_repository_id ON repository_local_mappings(repository_id);
CREATE INDEX idx_repository_local_mappings_user_id ON repository_local_mappings(user_id);
CREATE INDEX idx_repository_local_mappings_project_id ON repository_local_mappings(project_id);

-- Add updated_at trigger for repositories
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_repositories_updated_at BEFORE UPDATE ON repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repository_local_mappings_updated_at BEFORE UPDATE ON repository_local_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();