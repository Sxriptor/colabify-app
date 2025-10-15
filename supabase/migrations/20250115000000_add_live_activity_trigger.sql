-- Create trigger to automatically insert live_activity when git_data_cache is updated
-- This extracts the first (most recent) commit from the cached git data

-- Function to extract first commit and insert as live activity
CREATE OR REPLACE FUNCTION insert_live_activity_from_git_cache()
RETURNS TRIGGER AS $$
DECLARE
  first_commit JSONB;
  session_id UUID;
  repo_record RECORD;
BEGIN
  -- Only process if git_data_cache has commits
  IF NEW.git_data_cache IS NULL OR
     NEW.git_data_cache->'commits' IS NULL OR
     jsonb_array_length(NEW.git_data_cache->'commits') = 0 THEN
    RETURN NEW;
  END IF;

  -- Get the first (most recent) commit
  first_commit := NEW.git_data_cache->'commits'->0;

  -- Skip if commit is null or doesn't have required fields
  IF first_commit IS NULL OR
     first_commit->>'sha' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get repository information to find project_id
  SELECT r.project_id, r.id
  INTO repo_record
  FROM repositories r
  WHERE r.id = NEW.repository_id;

  -- Skip if repository not found
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Create or get session ID for this local mapping
  -- We'll use a deterministic session ID based on the mapping
  session_id := gen_random_uuid();

  -- Check if we need to create/update a session
  INSERT INTO live_activity_sessions (
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
    session_id,
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
  ON CONFLICT (id) DO UPDATE SET
    last_activity = NOW(),
    current_branch = EXCLUDED.current_branch,
    current_head = EXCLUDED.current_head;

  -- Insert the commit as a live activity
  INSERT INTO live_activities (
    session_id,
    user_id,
    project_id,
    repository_id,
    activity_type,
    activity_data,
    branch_name,
    commit_hash,
    occurred_at
  ) VALUES (
    session_id,
    NEW.user_id,
    repo_record.project_id,
    NEW.repository_id,
    'COMMIT',
    jsonb_build_object(
      'message', first_commit->>'message',
      'author', first_commit->'author',
      'stats', first_commit->'stats'
    ),
    COALESCE(NEW.git_current_branch, first_commit->>'branch'),
    first_commit->>'sha',
    COALESCE(
      (first_commit->>'date')::timestamptz,
      NOW()
    )
  )
  ON CONFLICT DO NOTHING; -- Avoid duplicate entries

  -- Update team awareness
  INSERT INTO live_team_awareness (
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
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    current_branch = EXCLUDED.current_branch,
    last_commit_message = EXCLUDED.last_commit_message,
    repository_path = EXCLUDED.repository_path,
    working_on = EXCLUDED.working_on,
    last_seen = NOW(),
    is_online = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on repository_local_mappings
DROP TRIGGER IF EXISTS trigger_live_activity_from_git_cache ON repository_local_mappings;

CREATE TRIGGER trigger_live_activity_from_git_cache
  AFTER INSERT OR UPDATE OF git_data_cache
  ON repository_local_mappings
  FOR EACH ROW
  WHEN (NEW.git_data_cache IS NOT NULL)
  EXECUTE FUNCTION insert_live_activity_from_git_cache();

-- Add comment
COMMENT ON FUNCTION insert_live_activity_from_git_cache() IS
'Automatically extracts the first commit from git_data_cache and inserts it as a live_activity when the cache is updated';
