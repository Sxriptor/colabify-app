-- =============================================
-- ALIGN RECREATEDATABASE WITH SUPABASE MIGRATIONS
-- =============================================
-- Purpose:
--   Bring an existing database created from:
--     1. exsitiing.sql
--     2. colabify_complete_schema.sql
--     3. add_colabify_to_profiles.sql
--   up to the same working behavior as the original project migrations in
--   supabase/migrations, while standardizing on public.profiles instead of users.
--
-- Notes:
--   - Safe to run multiple times.
--   - Avoids destructive DROP TABLE / DROP FUNCTION patterns from older migrations.
--   - Backfills missing profile rows for existing auth users.
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILE ALIGNMENT
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS github_id INTEGER,
  ADD COLUMN IF NOT EXISTS github_username TEXT,
  ADD COLUMN IF NOT EXISTS notification_preference TEXT DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"notifications": true, "email": true, "app": true}'::jsonb;

UPDATE public.profiles
SET notification_preferences = '{"notifications": true, "email": true, "app": true}'::jsonb
WHERE notification_preferences IS NULL;

UPDATE public.profiles
SET notification_preference = 'instant'
WHERE notification_preference IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences SET DEFAULT '{"notifications": true, "email": true, "app": true}'::jsonb;

ALTER TABLE public.profiles
  ALTER COLUMN notification_preference SET DEFAULT 'instant';

CREATE INDEX IF NOT EXISTS idx_profiles_github_id
  ON public.profiles(github_id);

CREATE INDEX IF NOT EXISTS idx_profiles_github_username
  ON public.profiles(github_username);

CREATE INDEX IF NOT EXISTS idx_profiles_notification_prefs
  ON public.profiles USING GIN (notification_preferences);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_notification_preference_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_notification_preference_check
      CHECK (notification_preference IN ('instant', 'digest'));
  END IF;
END $$;

-- Backfill missing profiles for auth users created before triggers existed.
INSERT INTO public.profiles (id, email, full_name, role, avatar_url)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(COALESCE(au.email, ''), '@', 1)),
  COALESCE(au.raw_user_meta_data->>'role', 'client'),
  au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
LEFT JOIN public.profiles p
  ON p.id = au.id
WHERE p.id IS NULL;

-- Allow authenticated users to create their own missing profile row.
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Optional legacy backfill from public.users if that table still exists.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        avatar_url,
        github_id,
        github_username,
        notification_preference,
        notification_preferences
      )
      SELECT
        u.id,
        u.email,
        COALESCE(u.name, split_part(COALESCE(u.email, ''), '@', 1)),
        'client',
        u.avatar_url,
        u.github_id,
        u.github_username,
        COALESCE(u.notification_preference, 'instant'),
        '{"notifications": true, "email": true, "app": true}'::jsonb
      FROM public.users u
      ON CONFLICT (id) DO UPDATE
      SET
        email = COALESCE(public.profiles.email, EXCLUDED.email),
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
        github_id = COALESCE(public.profiles.github_id, EXCLUDED.github_id),
        github_username = COALESCE(public.profiles.github_username, EXCLUDED.github_username),
        notification_preference = COALESCE(public.profiles.notification_preference, EXCLUDED.notification_preference),
        notification_preferences = COALESCE(public.profiles.notification_preferences, EXCLUDED.notification_preferences)
    $sql$;
  END IF;
END $$;

-- =============================================
-- REPOSITORY CACHE ENHANCEMENTS
-- =============================================

ALTER TABLE public.repository_local_mappings
  ADD COLUMN IF NOT EXISTS git_data_cache JSONB,
  ADD COLUMN IF NOT EXISTS git_data_last_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS git_data_commit_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS git_data_branch_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS git_data_last_commit_sha TEXT,
  ADD COLUMN IF NOT EXISTS git_data_last_commit_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS git_data_contributor_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS git_data_first_commit_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS git_data_total_additions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS git_data_total_deletions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_git_repository BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS git_current_branch TEXT,
  ADD COLUMN IF NOT EXISTS git_current_head TEXT,
  ADD COLUMN IF NOT EXISTS git_scan_error TEXT;

CREATE INDEX IF NOT EXISTS idx_rlm_git_data_updated
  ON public.repository_local_mappings(git_data_last_updated);

CREATE INDEX IF NOT EXISTS idx_rlm_last_commit_date
  ON public.repository_local_mappings(git_data_last_commit_date);

CREATE INDEX IF NOT EXISTS idx_rlm_commit_count
  ON public.repository_local_mappings(git_data_commit_count);

CREATE INDEX IF NOT EXISTS idx_rlm_is_git_repo
  ON public.repository_local_mappings(is_git_repository);

CREATE INDEX IF NOT EXISTS idx_rlm_current_branch
  ON public.repository_local_mappings(git_current_branch);

CREATE INDEX IF NOT EXISTS idx_rlm_contributor_count
  ON public.repository_local_mappings(git_data_contributor_count);

CREATE INDEX IF NOT EXISTS idx_rlm_first_commit_date
  ON public.repository_local_mappings(git_data_first_commit_date);

-- =============================================
-- FOREIGN KEYS: NORMALIZE LEGACY users REFERENCES TO public.profiles
-- =============================================

CREATE OR REPLACE FUNCTION public.ensure_profiles_fk(
  p_table_name TEXT,
  p_column_name TEXT,
  p_constraint_name TEXT,
  p_on_delete_action TEXT DEFAULT 'CASCADE'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  existing_target TEXT;
BEGIN
  SELECT ccu.table_schema || '.' || ccu.table_name
  INTO existing_target
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = p_table_name
    AND kcu.column_name = p_column_name
  LIMIT 1;

  IF existing_target IS DISTINCT FROM 'public.profiles' THEN
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      p_table_name,
      p_constraint_name
    );

    FOR existing_target IN
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = p_table_name
        AND kcu.column_name = p_column_name
    LOOP
      EXECUTE format(
        'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
        p_table_name,
        existing_target
      );
    END LOOP;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE %s',
      p_table_name,
      p_constraint_name,
      p_column_name,
      p_on_delete_action
    );
  END IF;
END;
$$;

SELECT public.ensure_profiles_fk('projects', 'owner_id', 'projects_owner_id_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('project_members', 'user_id', 'project_members_user_id_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('project_invitations', 'invited_by', 'project_invitations_invited_by_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('repository_local_mappings', 'user_id', 'repository_local_mappings_user_id_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('project_watches', 'user_id', 'project_watches_user_id_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('live_activity_sessions', 'user_id', 'live_activity_sessions_user_id_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('live_activities', 'user_id', 'live_activities_user_id_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('live_file_changes', 'user_id', 'live_file_changes_user_id_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('live_team_awareness', 'user_id', 'live_team_awareness_user_id_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('push_subscriptions', 'user_id', 'push_subscriptions_user_id_fkey', 'CASCADE');
SELECT public.ensure_profiles_fk('notification_logs', 'user_id', 'notification_logs_user_id_fkey', 'CASCADE');

DROP FUNCTION public.ensure_profiles_fk(TEXT, TEXT, TEXT, TEXT);

-- =============================================
-- CONSTRAINTS INTRODUCED BY LATER SUPABASE MIGRATIONS
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'live_activity_sessions_project_user_unique'
      AND conrelid = 'public.live_activity_sessions'::regclass
  ) THEN
    ALTER TABLE public.live_activity_sessions
      ADD CONSTRAINT live_activity_sessions_project_user_unique
      UNIQUE (project_id, user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'live_activities_session_file_path_unique'
      AND conrelid = 'public.live_activities'::regclass
  ) THEN
    ALTER TABLE public.live_activities
      ADD CONSTRAINT live_activities_session_file_path_unique
      UNIQUE (session_id, file_path);
  END IF;
END $$;

-- =============================================
-- FUNCTIONS FROM ORIGINAL SUPABASE MIGRATIONS
-- NORMALIZED TO public.profiles
-- =============================================

CREATE OR REPLACE FUNCTION public.get_repository_stats(project_id_param UUID)
RETURNS TABLE (
  total_repositories BIGINT,
  git_repositories BIGINT,
  total_commits BIGINT,
  total_contributors BIGINT,
  most_active_repo TEXT,
  most_active_repo_commits INTEGER,
  oldest_commit_date TIMESTAMPTZ,
  newest_commit_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_repositories,
    COUNT(*) FILTER (WHERE is_git_repository = true) AS git_repositories,
    COALESCE(SUM(git_data_commit_count), 0) AS total_commits,
    COALESCE(SUM(git_data_contributor_count), 0) AS total_contributors,
    (
      SELECT local_path
      FROM public.repository_local_mappings
      WHERE project_id = project_id_param
        AND is_git_repository = true
      ORDER BY git_data_commit_count DESC
      LIMIT 1
    ) AS most_active_repo,
    (
      SELECT MAX(git_data_commit_count)
      FROM public.repository_local_mappings
      WHERE project_id = project_id_param
        AND is_git_repository = true
    ) AS most_active_repo_commits,
    MIN(git_data_first_commit_date) AS oldest_commit_date,
    MAX(git_data_last_commit_date) AS newest_commit_date
  FROM public.repository_local_mappings
  WHERE project_id = project_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_stale_git_repositories(hours_threshold INTEGER DEFAULT 24)
RETURNS TABLE (
  id UUID,
  local_path TEXT,
  project_id UUID,
  git_data_last_updated TIMESTAMPTZ,
  hours_since_update NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rlm.id,
    rlm.local_path,
    rlm.project_id,
    rlm.git_data_last_updated,
    EXTRACT(EPOCH FROM (NOW() - rlm.git_data_last_updated)) / 3600 AS hours_since_update
  FROM public.repository_local_mappings rlm
  WHERE rlm.is_git_repository = true
    AND (
      rlm.git_data_last_updated IS NULL
      OR rlm.git_data_last_updated < NOW() - INTERVAL '1 hour' * hours_threshold
    )
  ORDER BY rlm.git_data_last_updated ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_user_notifications()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id
      FROM public.notifications
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 10
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (p_user_id, p_title, p_message, p_type, p_data)
  RETURNING id INTO notification_id;

  INSERT INTO public.notifications_log (notification_id, user_id, delivery_method, delivery_status)
  VALUES (notification_id, p_user_id, 'app', 'pending');

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.mark_notification_delivered(
  p_notification_id UUID,
  p_delivery_method TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.notifications_log
  SET
    delivery_status = 'delivered',
    delivered_at = NOW()
  WHERE notification_id = p_notification_id
    AND delivery_method = p_delivery_method;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_old_activity_data()
RETURNS void AS $$
BEGIN
  DELETE FROM public.live_activities
  WHERE occurred_at < NOW() - INTERVAL '30 days';

  DELETE FROM public.live_activity_sessions
  WHERE is_active = false
    AND last_activity < NOW() - INTERVAL '7 days';

  DELETE FROM public.live_file_changes
  WHERE updated_at < NOW() - INTERVAL '7 days';

  UPDATE public.live_team_awareness
  SET is_online = false
  WHERE last_seen < NOW() - INTERVAL '10 minutes'
    AND is_online = true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.insert_live_activity_from_git_cache()
RETURNS TRIGGER AS $$
DECLARE
  first_commit JSONB;
  repo_record RECORD;
  existing_session_id UUID;
BEGIN
  IF NEW.git_data_cache IS NULL
     OR NEW.git_data_cache->'commits' IS NULL
     OR jsonb_array_length(NEW.git_data_cache->'commits') = 0 THEN
    RETURN NEW;
  END IF;

  first_commit := NEW.git_data_cache->'commits'->0;

  IF first_commit IS NULL OR first_commit->>'sha' IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.project_id, r.id, r.url
  INTO repo_record
  FROM public.repositories r
  WHERE r.id = NEW.repository_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id
  INTO existing_session_id
  FROM public.live_activity_sessions
  WHERE project_id = repo_record.project_id
    AND user_id = NEW.user_id
  LIMIT 1;

  IF existing_session_id IS NULL THEN
    existing_session_id := gen_random_uuid();

    INSERT INTO public.live_activity_sessions (
      id,
      user_id,
      project_id,
      repository_id,
      local_path,
      session_start,
      last_activity,
      is_active,
      current_branch,
      current_head,
      ahead_count,
      behind_count
    ) VALUES (
      existing_session_id,
      NEW.user_id,
      repo_record.project_id,
      NEW.repository_id,
      NEW.local_path,
      NOW(),
      NOW(),
      true,
      NEW.git_current_branch,
      first_commit->>'sha',
      0,
      0
    )
    ON CONFLICT (project_id, user_id) DO UPDATE
    SET
      last_activity = NOW(),
      repository_id = EXCLUDED.repository_id,
      local_path = EXCLUDED.local_path,
      current_branch = EXCLUDED.current_branch,
      current_head = EXCLUDED.current_head
    RETURNING id INTO existing_session_id;
  ELSE
    UPDATE public.live_activity_sessions
    SET
      last_activity = NOW(),
      repository_id = NEW.repository_id,
      local_path = NEW.local_path,
      current_branch = NEW.git_current_branch,
      current_head = first_commit->>'sha'
    WHERE id = existing_session_id;
  END IF;

  INSERT INTO public.live_activities (
    session_id,
    user_id,
    project_id,
    repository_id,
    activity_type,
    activity_data,
    branch_name,
    commit_hash,
    file_path,
    occurred_at
  ) VALUES (
    existing_session_id,
    NEW.user_id,
    repo_record.project_id,
    NEW.repository_id,
    'COMMIT',
    jsonb_build_object(
      'message', first_commit->>'message',
      'author', first_commit->'author',
      'stats', first_commit->'stats',
      'local_path', NEW.local_path,
      'remote_url', repo_record.url,
      'source_type', 'local'
    ),
    COALESCE(NEW.git_current_branch, first_commit->>'branch'),
    first_commit->>'sha',
    NEW.local_path,
    COALESCE((first_commit->>'date')::timestamptz, NOW())
  )
  ON CONFLICT (session_id, file_path) DO UPDATE
  SET
    activity_type = EXCLUDED.activity_type,
    activity_data = EXCLUDED.activity_data,
    branch_name = EXCLUDED.branch_name,
    commit_hash = EXCLUDED.commit_hash,
    occurred_at = EXCLUDED.occurred_at;

  INSERT INTO public.live_team_awareness (
    project_id,
    user_id,
    status,
    current_branch,
    last_commit_message,
    repository_path,
    working_on,
    last_seen,
    is_online
  ) VALUES (
    repo_record.project_id,
    NEW.user_id,
    'active',
    NEW.git_current_branch,
    first_commit->>'message',
    NEW.local_path,
    'Committed: ' || LEFT(first_commit->>'message', 50),
    NOW(),
    true
  )
  ON CONFLICT (project_id, user_id) DO UPDATE
  SET
    current_branch = EXCLUDED.current_branch,
    last_commit_message = EXCLUDED.last_commit_message,
    repository_path = EXCLUDED.repository_path,
    working_on = EXCLUDED.working_on,
    last_seen = NOW(),
    is_online = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_team_on_live_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_member RECORD;
  notification_id UUID;
  commit_message TEXT;
  actor_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.commit_hash = NEW.commit_hash
       AND OLD.branch_name = NEW.branch_name
       AND OLD.activity_data = NEW.activity_data THEN
      RETURN NEW;
    END IF;
  END IF;

  commit_message := NEW.activity_data->>'message';
  actor_name := NEW.activity_data->'author'->>'name';

  IF actor_name IS NULL THEN
    SELECT full_name
    INTO actor_name
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;

  FOR team_member IN
    SELECT DISTINCT p.id, p.notification_preferences
    FROM public.profiles p
    INNER JOIN public.project_members pm
      ON pm.user_id = p.id
    WHERE pm.project_id = NEW.project_id
      AND p.id != NEW.user_id
  LOOP
    IF team_member.notification_preferences IS NULL
       OR (team_member.notification_preferences->>'notifications')::boolean = true THEN

      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        data,
        read,
        created_at
      ) VALUES (
        team_member.id,
        'New Team Activity',
        COALESCE(actor_name, 'A teammate') || ' committed: ' || LEFT(COALESCE(commit_message, ''), 100),
        'team_activity',
        jsonb_build_object(
          'activity_id', NEW.id,
          'project_id', NEW.project_id,
          'repository_id', NEW.repository_id,
          'actor_id', NEW.user_id,
          'actor_name', actor_name,
          'activity_type', NEW.activity_type,
          'branch', NEW.branch_name,
          'commit_hash', NEW.commit_hash,
          'commit_message', commit_message,
          'occurred_at', NEW.occurred_at
        ),
        false,
        NOW()
      )
      RETURNING id INTO notification_id;

      IF team_member.notification_preferences IS NULL
         OR team_member.notification_preferences->>'app' IS NULL
         OR (team_member.notification_preferences->>'app')::boolean = true THEN
        INSERT INTO public.notifications_log (
          notification_id,
          user_id,
          delivery_method,
          delivery_status,
          created_at
        ) VALUES (
          notification_id,
          team_member.id,
          'app',
          'pending',
          NOW()
        );
      END IF;

      IF team_member.notification_preferences IS NULL
         OR team_member.notification_preferences->>'email' IS NULL
         OR (team_member.notification_preferences->>'email')::boolean = true THEN
        INSERT INTO public.notifications_log (
          notification_id,
          user_id,
          delivery_method,
          delivery_status,
          created_at
        ) VALUES (
          notification_id,
          team_member.id,
          'email',
          'pending',
          NOW()
        );
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

CREATE OR REPLACE FUNCTION public.send_email_on_notification_insert()
RETURNS TRIGGER AS $$
DECLARE
  user_email_enabled BOOLEAN;
  webhook_url TEXT := 'https://colabify.xyz/api/notifications/send-email';
  request_id BIGINT;
BEGIN
  SELECT (notification_preferences->>'email')::boolean
  INTO user_email_enabled
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF user_email_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'data', NEW.data
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_repository_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stale_git_repositories(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_delivered(UUID, TEXT) TO authenticated;

-- =============================================
-- TRIGGERS REQUIRED BY LATER SUPABASE MIGRATIONS
-- =============================================

DROP TRIGGER IF EXISTS cleanup_notifications_trigger ON public.notifications;
CREATE TRIGGER cleanup_notifications_trigger
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_notifications();

DROP TRIGGER IF EXISTS email_notification_on_insert ON public.notifications;
CREATE TRIGGER email_notification_on_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_email_on_notification_insert();

DROP TRIGGER IF EXISTS trigger_live_activity_from_git_cache ON public.repository_local_mappings;
CREATE TRIGGER trigger_live_activity_from_git_cache
  AFTER INSERT OR UPDATE OF git_data_cache ON public.repository_local_mappings
  FOR EACH ROW
  WHEN (NEW.git_data_cache IS NOT NULL)
  EXECUTE FUNCTION public.insert_live_activity_from_git_cache();

DROP TRIGGER IF EXISTS trigger_notify_team_on_live_activity ON public.live_activities;
CREATE TRIGGER trigger_notify_team_on_live_activity
  AFTER INSERT OR UPDATE ON public.live_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_team_on_live_activity();

-- =============================================
-- REALTIME ALIGNMENT
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications_log;
  END IF;
END $$;
