-- Live Activity Monitoring System
-- Tracks real-time developer activity across watched projects

-- Create project_watches table (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS project_watches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- Create live_activity_sessions table to track when users are actively working
CREATE TABLE IF NOT EXISTS live_activity_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  local_path TEXT NOT NULL,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Current Git state
  current_branch TEXT,
  current_head TEXT,
  working_directory_status TEXT,
  ahead_count INTEGER DEFAULT 0,
  behind_count INTEGER DEFAULT 0,
  
  -- User context
  focus_file TEXT, -- Currently focused file
  editor_info JSONB, -- Editor type, version, etc.
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create live_activities table to store individual activity events
CREATE TABLE IF NOT EXISTS live_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES live_activity_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type TEXT NOT NULL, -- COMMIT, BRANCH_SWITCH, FILE_CHANGE, etc.
  activity_data JSONB NOT NULL, -- Flexible data structure for different activity types
  
  -- Git context at time of activity
  branch_name TEXT,
  commit_hash TEXT,
  file_path TEXT, -- For file-related activities
  
  -- Timing
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create live_file_changes table for tracking file-level changes
CREATE TABLE IF NOT EXISTS live_file_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES live_activity_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- File details
  file_path TEXT NOT NULL,
  file_type TEXT, -- extension or detected type
  change_type TEXT NOT NULL, -- MODIFIED, ADDED, DELETED, RENAMED
  
  -- Change metrics
  lines_added INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0,
  characters_added INTEGER DEFAULT 0,
  characters_removed INTEGER DEFAULT 0,
  
  -- Timing
  first_change_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_change_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(session_id, file_path)
);

-- Create live_team_awareness table for real-time team collaboration
CREATE TABLE IF NOT EXISTS live_team_awareness (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Current status
  status TEXT NOT NULL DEFAULT 'active', -- active, away, coding, reviewing, etc.
  current_branch TEXT,
  current_file TEXT,
  last_commit_message TEXT,
  
  -- Location context
  repository_path TEXT,
  working_on TEXT, -- Brief description of current work
  
  -- Presence
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(project_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE project_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_file_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_team_awareness ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_watches
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

-- RLS Policies for live_activity_sessions
CREATE POLICY "Users can manage their own activity sessions" ON live_activity_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Team members can view project activity sessions" ON live_activity_sessions
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for live_activities
CREATE POLICY "Users can manage their own activities" ON live_activities
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Team members can view project activities" ON live_activities
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for live_file_changes
CREATE POLICY "Users can manage their own file changes" ON live_file_changes
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Team members can view project file changes" ON live_file_changes
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for live_team_awareness
CREATE POLICY "Users can manage their own team awareness" ON live_team_awareness
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Team members can view project team awareness" ON live_team_awareness
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_watches_user_id ON project_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_project_watches_project_id ON project_watches(project_id);

CREATE INDEX IF NOT EXISTS idx_live_activity_sessions_user_id ON live_activity_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_live_activity_sessions_project_id ON live_activity_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_live_activity_sessions_active ON live_activity_sessions(is_active, last_activity);

CREATE INDEX IF NOT EXISTS idx_live_activities_session_id ON live_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_live_activities_user_id ON live_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_live_activities_project_id ON live_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_live_activities_occurred_at ON live_activities(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_activities_type ON live_activities(activity_type);

CREATE INDEX IF NOT EXISTS idx_live_file_changes_session_id ON live_file_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_live_file_changes_user_id ON live_file_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_live_file_changes_project_id ON live_file_changes(project_id);
CREATE INDEX IF NOT EXISTS idx_live_file_changes_file_path ON live_file_changes(file_path);

CREATE INDEX IF NOT EXISTS idx_live_team_awareness_project_id ON live_team_awareness(project_id);
CREATE INDEX IF NOT EXISTS idx_live_team_awareness_user_id ON live_team_awareness(user_id);
CREATE INDEX IF NOT EXISTS idx_live_team_awareness_online ON live_team_awareness(is_online, last_seen);

-- Add updated_at triggers (with IF NOT EXISTS checks)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_watches_updated_at') THEN
        CREATE TRIGGER update_project_watches_updated_at BEFORE UPDATE ON project_watches
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_live_activity_sessions_updated_at') THEN
        CREATE TRIGGER update_live_activity_sessions_updated_at BEFORE UPDATE ON live_activity_sessions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_live_file_changes_updated_at') THEN
        CREATE TRIGGER update_live_file_changes_updated_at BEFORE UPDATE ON live_file_changes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_live_team_awareness_updated_at') THEN
        CREATE TRIGGER update_live_team_awareness_updated_at BEFORE UPDATE ON live_team_awareness
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create function to clean up old activity data
CREATE OR REPLACE FUNCTION cleanup_old_activity_data()
RETURNS void AS $$
BEGIN
  -- Clean up activities older than 30 days
  DELETE FROM live_activities 
  WHERE occurred_at < NOW() - INTERVAL '30 days';
  
  -- Clean up inactive sessions older than 7 days
  DELETE FROM live_activity_sessions 
  WHERE is_active = false AND last_activity < NOW() - INTERVAL '7 days';
  
  -- Clean up old file changes older than 7 days
  DELETE FROM live_file_changes 
  WHERE updated_at < NOW() - INTERVAL '7 days';
  
  -- Mark users as offline if they haven't been seen in 10 minutes
  UPDATE live_team_awareness 
  SET is_online = false 
  WHERE last_seen < NOW() - INTERVAL '10 minutes' AND is_online = true;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-activity-data', '0 2 * * *', 'SELECT cleanup_old_activity_data();');

-- Verify tables were created
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('project_watches', 'live_activity_sessions', 'live_activities', 'live_file_changes', 'live_team_awareness')
ORDER BY table_name, ordinal_position;