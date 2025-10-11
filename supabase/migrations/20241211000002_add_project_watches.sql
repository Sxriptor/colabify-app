-- Create project_watches table for storing which projects users are watching
CREATE TABLE IF NOT EXISTS project_watches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- Add RLS policies for project_watches
ALTER TABLE project_watches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own watches
CREATE POLICY "Users can manage their own project watches" ON project_watches
  FOR ALL USING (user_id = auth.uid());

-- Policy: Users can view watches for projects they have access to
CREATE POLICY "Users can view watches for accessible projects" ON project_watches
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_watches_user_id ON project_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_project_watches_project_id ON project_watches(project_id);
CREATE INDEX IF NOT EXISTS idx_project_watches_user_project ON project_watches(user_id, project_id);

-- Add updated_at trigger for project_watches
CREATE TRIGGER update_project_watches_updated_at BEFORE UPDATE ON project_watches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();