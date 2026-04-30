-- Setup script for project watches feature
-- Run this in Supabase SQL Editor

-- Create project_watches table
CREATE TABLE IF NOT EXISTS project_watches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- Enable RLS
ALTER TABLE project_watches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own project watches" ON project_watches;
DROP POLICY IF EXISTS "Users can view watches for accessible projects" ON project_watches;

-- Create RLS policies
CREATE POLICY "Users can manage their own project watches" ON project_watches
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view watches for accessible projects" ON project_watches
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_watches_user_id ON project_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_project_watches_project_id ON project_watches(project_id);
CREATE INDEX IF NOT EXISTS idx_project_watches_user_project ON project_watches(user_id, project_id);

-- Add updated_at trigger (assuming the function exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_project_watches_updated_at BEFORE UPDATE ON project_watches
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Verify the table was created
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'project_watches'
ORDER BY ordinal_position;