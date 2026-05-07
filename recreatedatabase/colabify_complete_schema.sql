-- =============================================
-- COLABIFY (ELECTRONAPP) COMPLETE SCHEMA
-- =============================================
-- Run this on top of an existing Supabase database that already contains
-- the dash-clients schema (profiles, clients, invite_codes, note_groups,
-- notes, note_attachments, and their triggers / RLS / storage bucket).
-- None of those objects are redefined here.
-- =============================================

-- =============================================
-- EXTENSIONS
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- SHARED TRIGGER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TABLES
-- =============================================

-- Add Colabify columns to existing profiles table (if not already present)
-- Note: profiles table already exists from the main repo schema
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_id INTEGER UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preference TEXT
  DEFAULT 'instant' CHECK (notification_preference IN ('instant', 'digest'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB
  DEFAULT '{"notifications": true, "email": true, "app": true}'::jsonb;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  visibility  VARCHAR(20) NOT NULL DEFAULT 'private'
                  CHECK (visibility IN ('public', 'private')),
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project members
CREATE TABLE IF NOT EXISTS project_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_email VARCHAR(255),
  role          VARCHAR(20) NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner', 'member')),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'declined')),
  invited_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at     TIMESTAMP WITH TIME ZONE,
  UNIQUE (project_id, user_id),
  UNIQUE (project_id, invited_email)
);

-- Project invitations
CREATE TABLE IF NOT EXISTS project_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email        VARCHAR(255) NOT NULL,
  invited_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (project_id, email)
);

-- Repositories (final schema — no GitHub webhook columns; those were dropped in migrations)
CREATE TABLE IF NOT EXISTS repositories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  full_name  TEXT NOT NULL,
  url        TEXT NOT NULL,
  owner      TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (project_id, full_name)
);

-- Repository local mappings (stores local folder paths + full git cache)
CREATE TABLE IF NOT EXISTS repository_local_mappings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id               UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  user_id                     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id                  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  local_path                  TEXT NOT NULL,

  -- Git cache metadata
  git_data_cache              JSONB,
  git_data_last_updated       TIMESTAMPTZ,
  git_data_commit_count       INTEGER DEFAULT 0,
  git_data_branch_count       INTEGER DEFAULT 0,
  git_data_last_commit_sha    TEXT,
  git_data_last_commit_date   TIMESTAMPTZ,
  git_data_contributor_count  INTEGER DEFAULT 0,
  git_data_first_commit_date  TIMESTAMPTZ,
  git_data_total_additions    INTEGER DEFAULT 0,
  git_data_total_deletions    INTEGER DEFAULT 0,
  is_git_repository           BOOLEAN DEFAULT false,
  git_current_branch          TEXT,
  git_current_head            TEXT,
  git_scan_error              TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (repository_id, user_id, local_path)
);

-- Project watches
CREATE TABLE IF NOT EXISTS project_watches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, project_id)
);

-- Live activity sessions (one per project per user)
CREATE TABLE IF NOT EXISTS live_activity_sessions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id               UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repository_id            UUID REFERENCES repositories(id) ON DELETE CASCADE,
  local_path               TEXT NOT NULL,
  session_start            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active                BOOLEAN DEFAULT true,
  current_branch           TEXT,
  current_head             TEXT,
  working_directory_status TEXT,
  ahead_count              INTEGER DEFAULT 0,
  behind_count             INTEGER DEFAULT 0,
  focus_file               TEXT,
  editor_info              JSONB,
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT live_activity_sessions_project_user_unique UNIQUE (project_id, user_id)
);

-- Live activities (one row per local folder per session)
CREATE TABLE IF NOT EXISTS live_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES live_activity_sessions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_data JSONB NOT NULL,
  branch_name   TEXT,
  commit_hash   TEXT,
  file_path     TEXT,
  occurred_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT live_activities_session_file_path_unique UNIQUE (session_id, file_path)
);

-- Live file changes
CREATE TABLE IF NOT EXISTS live_file_changes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES live_activity_sessions(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path          TEXT NOT NULL,
  file_type          TEXT,
  change_type        TEXT NOT NULL,
  lines_added        INTEGER DEFAULT 0,
  lines_removed      INTEGER DEFAULT 0,
  characters_added   INTEGER DEFAULT 0,
  characters_removed INTEGER DEFAULT 0,
  first_change_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_change_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, file_path)
);

-- Live team awareness (one row per project per user)
CREATE TABLE IF NOT EXISTS live_team_awareness (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'active',
  current_branch      TEXT,
  current_file        TEXT,
  last_commit_message TEXT,
  repository_path     TEXT,
  working_on          TEXT,
  last_seen           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online           BOOLEAN DEFAULT true,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- Notifications (in-app + email notifications system)
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',
  data       JSONB,
  read       BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications delivery log
CREATE TABLE IF NOT EXISTS notifications_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_method TEXT NOT NULL,
  delivered_at    TIMESTAMP WITH TIME ZONE,
  error_message   TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Push subscriptions (web push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_data JSONB NOT NULL,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Notification delivery log (push / email / in-app tracking)
CREATE TABLE IF NOT EXISTS notification_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  url             VARCHAR(500),
  data            JSONB,
  delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('push', 'email', 'in-app')),
  sent_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at         TIMESTAMP WITH TIME ZONE,
  clicked_at      TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_profiles_github_id           ON public.profiles(github_id);
CREATE INDEX IF NOT EXISTS idx_profiles_github_username      ON public.profiles(github_username);
CREATE INDEX IF NOT EXISTS idx_profiles_notification_prefs   ON public.profiles USING GIN (notification_preferences);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id             ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_visibility           ON projects(visibility);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id    ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id       ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_status        ON project_members(status);

CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email      ON project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status     ON project_invitations(status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_expires_at ON project_invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_repositories_project_id       ON repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_repositories_full_name        ON repositories(full_name);

CREATE INDEX IF NOT EXISTS idx_rlm_repository_id             ON repository_local_mappings(repository_id);
CREATE INDEX IF NOT EXISTS idx_rlm_user_id                   ON repository_local_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_rlm_project_id                ON repository_local_mappings(project_id);
CREATE INDEX IF NOT EXISTS idx_rlm_git_data_updated          ON repository_local_mappings(git_data_last_updated);
CREATE INDEX IF NOT EXISTS idx_rlm_last_commit_date          ON repository_local_mappings(git_data_last_commit_date);
CREATE INDEX IF NOT EXISTS idx_rlm_commit_count              ON repository_local_mappings(git_data_commit_count);
CREATE INDEX IF NOT EXISTS idx_rlm_is_git_repo               ON repository_local_mappings(is_git_repository);
CREATE INDEX IF NOT EXISTS idx_rlm_current_branch            ON repository_local_mappings(git_current_branch);
CREATE INDEX IF NOT EXISTS idx_rlm_contributor_count         ON repository_local_mappings(git_data_contributor_count);
CREATE INDEX IF NOT EXISTS idx_rlm_first_commit_date         ON repository_local_mappings(git_data_first_commit_date);

CREATE INDEX IF NOT EXISTS idx_project_watches_user_id       ON project_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_project_watches_project_id    ON project_watches(project_id);
CREATE INDEX IF NOT EXISTS idx_project_watches_user_project  ON project_watches(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_las_user_id                   ON live_activity_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_las_project_id                ON live_activity_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_las_active                    ON live_activity_sessions(is_active, last_activity);

CREATE INDEX IF NOT EXISTS idx_la_session_id                 ON live_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_la_user_id                    ON live_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_la_project_id                 ON live_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_la_occurred_at                ON live_activities(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_la_type                       ON live_activities(activity_type);

CREATE INDEX IF NOT EXISTS idx_lfc_session_id                ON live_file_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_lfc_user_id                   ON live_file_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_lfc_project_id                ON live_file_changes(project_id);
CREATE INDEX IF NOT EXISTS idx_lfc_file_path                 ON live_file_changes(file_path);

CREATE INDEX IF NOT EXISTS idx_lta_project_id                ON live_team_awareness(project_id);
CREATE INDEX IF NOT EXISTS idx_lta_user_id                   ON live_team_awareness(user_id);
CREATE INDEX IF NOT EXISTS idx_lta_online                    ON live_team_awareness(is_online, last_seen);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id         ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at      ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read            ON notifications(read);

CREATE INDEX IF NOT EXISTS idx_notifications_log_notif_id    ON notifications_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_user_id     ON notifications_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_status      ON notifications_log(delivery_status);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id    ON push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id     ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at     ON notification_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_method      ON notification_logs(delivery_method);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repositories_updated_at
  BEFORE UPDATE ON repositories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repository_local_mappings_updated_at
  BEFORE UPDATE ON repository_local_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_watches_updated_at
  BEFORE UPDATE ON project_watches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_activity_sessions_updated_at
  BEFORE UPDATE ON live_activity_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_file_changes_updated_at
  BEFORE UPDATE ON live_file_changes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_team_awareness_updated_at
  BEFORE UPDATE ON live_team_awareness
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE projects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_local_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_watches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_activity_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_activities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_file_changes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_team_awareness      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs        ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE POLICY "Users can view projects they own" ON projects
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view projects they are members of" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
        AND project_members.status = 'active'
    )
  );

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project owners can update their projects" ON projects
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Project owners can delete their projects" ON projects
  FOR DELETE USING (owner_id = auth.uid());

-- Project members
CREATE POLICY "Users can view their own project memberships" ON project_members
  FOR SELECT USING (user_id = auth.uid());

-- Project invitations
CREATE POLICY "Project owners can view invitations for their projects" ON project_invitations
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Project owners can create invitations" ON project_invitations
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Project owners can update invitations" ON project_invitations
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Repositories
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
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Repository local mappings
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

-- Project watches
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

-- Live activity sessions
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

-- Live activities
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

-- Live file changes
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

-- Live team awareness
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

-- Notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Notifications log
CREATE POLICY "Users can view their own notification logs" ON notifications_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage notification logs" ON notifications_log
  FOR ALL USING (true);

-- Push subscriptions
CREATE POLICY "Users can manage their own push subscriptions" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- Notification logs
CREATE POLICY "Users can view their own delivery logs" ON notification_logs
  FOR SELECT USING (user_id = auth.uid());

-- =============================================
-- FUNCTIONS
-- =============================================

-- Keep only the 10 most recent notifications per user
CREATE OR REPLACE FUNCTION cleanup_user_notifications()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM notifications
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM notifications
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a notification and an initial delivery log entry
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title   TEXT,
  p_message TEXT,
  p_type    TEXT DEFAULT 'info',
  p_data    JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (p_user_id, p_title, p_message, p_type, p_data)
  RETURNING id INTO notification_id;

  INSERT INTO notifications_log (notification_id, user_id, delivery_method, delivery_status)
  VALUES (notification_id, p_user_id, 'app', 'pending');

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Mark a notification as delivered for a given method
CREATE OR REPLACE FUNCTION mark_notification_delivered(
  p_notification_id UUID,
  p_delivery_method TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE notifications_log
  SET delivery_status = 'delivered',
      delivered_at    = NOW()
  WHERE notification_id = p_notification_id
    AND delivery_method = p_delivery_method;
END;
$$ LANGUAGE plpgsql;

-- Aggregate git stats for a project
CREATE OR REPLACE FUNCTION get_repository_stats(project_id_param UUID)
RETURNS TABLE (
  total_repositories      BIGINT,
  git_repositories        BIGINT,
  total_commits           BIGINT,
  total_contributors      BIGINT,
  most_active_repo        TEXT,
  most_active_repo_commits INTEGER,
  oldest_commit_date      TIMESTAMPTZ,
  newest_commit_date      TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)                                                              AS total_repositories,
    COUNT(*) FILTER (WHERE is_git_repository = true)                     AS git_repositories,
    COALESCE(SUM(git_data_commit_count), 0)                              AS total_commits,
    COALESCE(SUM(git_data_contributor_count), 0)                        AS total_contributors,
    (SELECT local_path FROM repository_local_mappings
     WHERE project_id = project_id_param AND is_git_repository = true
     ORDER BY git_data_commit_count DESC LIMIT 1)                       AS most_active_repo,
    (SELECT MAX(git_data_commit_count) FROM repository_local_mappings
     WHERE project_id = project_id_param AND is_git_repository = true)  AS most_active_repo_commits,
    MIN(git_data_first_commit_date)                                     AS oldest_commit_date,
    MAX(git_data_last_commit_date)                                      AS newest_commit_date
  FROM repository_local_mappings
  WHERE project_id = project_id_param;
END;
$$ LANGUAGE plpgsql;

-- Return local mappings whose git cache is stale
CREATE OR REPLACE FUNCTION get_stale_git_repositories(hours_threshold INTEGER DEFAULT 24)
RETURNS TABLE (
  id                    UUID,
  local_path            TEXT,
  project_id            UUID,
  git_data_last_updated TIMESTAMPTZ,
  hours_since_update    NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rlm.id,
    rlm.local_path,
    rlm.project_id,
    rlm.git_data_last_updated,
    EXTRACT(EPOCH FROM (NOW() - rlm.git_data_last_updated)) / 3600 AS hours_since_update
  FROM repository_local_mappings rlm
  WHERE rlm.is_git_repository = true
    AND (
      rlm.git_data_last_updated IS NULL
      OR rlm.git_data_last_updated < NOW() - INTERVAL '1 hour' * hours_threshold
    )
  ORDER BY rlm.git_data_last_updated ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

-- Delete stale live activity data
CREATE OR REPLACE FUNCTION cleanup_old_activity_data()
RETURNS void AS $$
BEGIN
  DELETE FROM live_activities
  WHERE occurred_at < NOW() - INTERVAL '30 days';

  DELETE FROM live_activity_sessions
  WHERE is_active = false AND last_activity < NOW() - INTERVAL '7 days';

  DELETE FROM live_file_changes
  WHERE updated_at < NOW() - INTERVAL '7 days';

  UPDATE live_team_awareness
  SET is_online = false
  WHERE last_seen < NOW() - INTERVAL '10 minutes' AND is_online = true;
END;
$$ LANGUAGE plpgsql;

-- Extract the most recent commit from git_data_cache and push it into live_activities
CREATE OR REPLACE FUNCTION insert_live_activity_from_git_cache()
RETURNS TRIGGER AS $$
DECLARE
  first_commit       JSONB;
  repo_record        RECORD;
  existing_session_id UUID;
BEGIN
  IF NEW.git_data_cache IS NULL OR
     NEW.git_data_cache->'commits' IS NULL OR
     jsonb_array_length(NEW.git_data_cache->'commits') = 0 THEN
    RETURN NEW;
  END IF;

  first_commit := NEW.git_data_cache->'commits'->0;

  IF first_commit IS NULL OR first_commit->>'sha' IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.project_id, r.id, r.url INTO repo_record
  FROM repositories r WHERE r.id = NEW.repository_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_session_id
  FROM live_activity_sessions
  WHERE project_id = repo_record.project_id AND user_id = NEW.user_id
  LIMIT 1;

  IF existing_session_id IS NULL THEN
    existing_session_id := gen_random_uuid();

    INSERT INTO live_activity_sessions (
      id, user_id, project_id, repository_id, local_path,
      session_start, last_activity, is_active,
      current_branch, current_head, ahead_count, behind_count
    ) VALUES (
      existing_session_id, NEW.user_id, repo_record.project_id,
      NEW.repository_id, NEW.local_path,
      NOW(), NOW(), true,
      NEW.git_current_branch, first_commit->>'sha', 0, 0
    )
    ON CONFLICT (project_id, user_id) DO UPDATE SET
      last_activity  = NOW(),
      repository_id  = EXCLUDED.repository_id,
      local_path     = EXCLUDED.local_path,
      current_branch = EXCLUDED.current_branch,
      current_head   = EXCLUDED.current_head
    RETURNING id INTO existing_session_id;
  ELSE
    UPDATE live_activity_sessions
    SET last_activity  = NOW(),
        repository_id  = NEW.repository_id,
        local_path     = NEW.local_path,
        current_branch = NEW.git_current_branch,
        current_head   = first_commit->>'sha'
    WHERE id = existing_session_id;
  END IF;

  INSERT INTO live_activities (
    session_id, user_id, project_id, repository_id,
    activity_type, activity_data,
    branch_name, commit_hash, file_path, occurred_at
  ) VALUES (
    existing_session_id, NEW.user_id, repo_record.project_id, NEW.repository_id,
    'COMMIT',
    jsonb_build_object(
      'message',     first_commit->>'message',
      'author',      first_commit->'author',
      'stats',       first_commit->'stats',
      'local_path',  NEW.local_path,
      'remote_url',  repo_record.url,
      'source_type', 'local'
    ),
    COALESCE(NEW.git_current_branch, first_commit->>'branch'),
    first_commit->>'sha',
    NEW.local_path,
    COALESCE((first_commit->>'date')::timestamptz, NOW())
  )
  ON CONFLICT (session_id, file_path) DO UPDATE SET
    activity_type = EXCLUDED.activity_type,
    activity_data = EXCLUDED.activity_data,
    branch_name   = EXCLUDED.branch_name,
    commit_hash   = EXCLUDED.commit_hash,
    occurred_at   = EXCLUDED.occurred_at;

  INSERT INTO live_team_awareness (
    project_id, user_id, status,
    current_branch, last_commit_message, repository_path, working_on,
    last_seen, is_online
  ) VALUES (
    repo_record.project_id, NEW.user_id, 'active',
    NEW.git_current_branch, first_commit->>'message',
    NEW.local_path, 'Committed: ' || LEFT(first_commit->>'message', 50),
    NOW(), true
  )
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    current_branch      = EXCLUDED.current_branch,
    last_commit_message = EXCLUDED.last_commit_message,
    repository_path     = EXCLUDED.repository_path,
    working_on          = EXCLUDED.working_on,
    last_seen           = NOW(),
    is_online           = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notify team members when a live_activity is inserted or meaningfully updated
CREATE OR REPLACE FUNCTION notify_team_on_live_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_member     RECORD;
  notification_id UUID;
  commit_message  TEXT;
  actor_name      TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.commit_hash   = NEW.commit_hash   AND
       OLD.branch_name   = NEW.branch_name   AND
       OLD.activity_data = NEW.activity_data THEN
      RETURN NEW;
    END IF;
  END IF;

  commit_message := NEW.activity_data->>'message';
  actor_name     := NEW.activity_data->'author'->>'name';

  IF actor_name IS NULL THEN
    SELECT full_name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  END IF;

  FOR team_member IN
    SELECT DISTINCT u.id, u.notification_preferences
    FROM public.profiles u
    INNER JOIN project_members pm ON pm.user_id = u.id
    WHERE pm.project_id = NEW.project_id
      AND u.id != NEW.user_id
  LOOP
    IF team_member.notification_preferences IS NULL OR
       (team_member.notification_preferences->>'notifications')::boolean = true THEN

      INSERT INTO notifications (user_id, title, message, type, data, read, created_at)
      VALUES (
        team_member.id,
        'New Team Activity',
        actor_name || ' committed: ' || LEFT(commit_message, 100),
        'team_activity',
        jsonb_build_object(
          'activity_id',   NEW.id,
          'project_id',    NEW.project_id,
          'repository_id', NEW.repository_id,
          'actor_id',      NEW.user_id,
          'actor_name',    actor_name,
          'activity_type', NEW.activity_type,
          'branch',        NEW.branch_name,
          'commit_hash',   NEW.commit_hash,
          'commit_message', commit_message,
          'occurred_at',   NEW.occurred_at
        ),
        false, NOW()
      )
      RETURNING id INTO notification_id;

      IF team_member.notification_preferences IS NULL OR
         team_member.notification_preferences->>'app' IS NULL OR
         (team_member.notification_preferences->>'app')::boolean = true THEN
        INSERT INTO notifications_log (notification_id, user_id, delivery_method, delivery_status, created_at)
        VALUES (notification_id, team_member.id, 'app', 'pending', NOW());
      END IF;

      IF team_member.notification_preferences IS NULL OR
         team_member.notification_preferences->>'email' IS NULL OR
         (team_member.notification_preferences->>'email')::boolean = true THEN
        INSERT INTO notifications_log (notification_id, user_id, delivery_method, delivery_status, created_at)
        VALUES (notification_id, team_member.id, 'email', 'pending', NOW());
      END IF;

    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_team_on_live_activity error: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger a webhook call to send an email when a notification is inserted
-- (requires pg_net extension; silently skips if not available)
CREATE OR REPLACE FUNCTION send_email_on_notification_insert()
RETURNS TRIGGER AS $$
DECLARE
  user_email_enabled BOOLEAN;
  webhook_url        TEXT := 'https://colabify.xyz/api/notifications/send-email';
  request_id         BIGINT;
BEGIN
  SELECT (notification_preferences->>'email')::boolean INTO user_email_enabled
  FROM public.profiles WHERE id = NEW.user_id;

  IF user_email_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url     := webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id',         NEW.user_id,
      'title',           NEW.title,
      'message',         NEW.message,
      'type',            NEW.type,
      'data',            NEW.data
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on utility functions
GRANT EXECUTE ON FUNCTION get_repository_stats(UUID)              TO authenticated;
GRANT EXECUTE ON FUNCTION get_stale_git_repositories(INTEGER)     TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_delivered(UUID, TEXT) TO authenticated;

-- =============================================
-- NOTIFICATION & LIVE ACTIVITY TRIGGERS
-- =============================================

CREATE TRIGGER cleanup_notifications_trigger
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_user_notifications();

CREATE TRIGGER email_notification_on_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_email_on_notification_insert();

DROP TRIGGER IF EXISTS trigger_live_activity_from_git_cache ON repository_local_mappings;
CREATE TRIGGER trigger_live_activity_from_git_cache
  AFTER INSERT OR UPDATE OF git_data_cache ON repository_local_mappings
  FOR EACH ROW
  WHEN (NEW.git_data_cache IS NOT NULL)
  EXECUTE FUNCTION insert_live_activity_from_git_cache();

DROP TRIGGER IF EXISTS trigger_notify_team_on_live_activity ON live_activities;
CREATE TRIGGER trigger_notify_team_on_live_activity
  AFTER INSERT OR UPDATE ON live_activities
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_on_live_activity();

-- =============================================
-- REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications_log;
