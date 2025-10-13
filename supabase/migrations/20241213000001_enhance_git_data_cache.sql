-- Enhance Git data caching with additional metadata columns
-- This migration adds more detailed tracking columns for better Git repository management

ALTER TABLE repository_local_mappings 
ADD COLUMN IF NOT EXISTS git_data_contributor_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS git_data_first_commit_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS git_data_total_additions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS git_data_total_deletions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_git_repository BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS git_current_branch TEXT,
ADD COLUMN IF NOT EXISTS git_current_head TEXT,
ADD COLUMN IF NOT EXISTS git_scan_error TEXT;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_is_git_repo 
ON repository_local_mappings(is_git_repository);

CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_current_branch 
ON repository_local_mappings(git_current_branch);

CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_contributor_count 
ON repository_local_mappings(git_data_contributor_count);

CREATE INDEX IF NOT EXISTS idx_repository_local_mappings_first_commit_date 
ON repository_local_mappings(git_data_first_commit_date);

-- Add comments for the new columns
COMMENT ON COLUMN repository_local_mappings.git_data_contributor_count IS 
'Total number of unique contributors in the Git repository';

COMMENT ON COLUMN repository_local_mappings.git_data_first_commit_date IS 
'Date of the first commit in the repository history';

COMMENT ON COLUMN repository_local_mappings.git_data_total_additions IS 
'Total lines of code added across all commits';

COMMENT ON COLUMN repository_local_mappings.git_data_total_deletions IS 
'Total lines of code deleted across all commits';

COMMENT ON COLUMN repository_local_mappings.is_git_repository IS 
'Boolean flag indicating if the local path is a valid Git repository';

COMMENT ON COLUMN repository_local_mappings.git_current_branch IS 
'Current active branch name in the local repository';

COMMENT ON COLUMN repository_local_mappings.git_current_head IS 
'Current HEAD commit SHA in the local repository';

COMMENT ON COLUMN repository_local_mappings.git_scan_error IS 
'Error message if Git scanning failed for this repository';

-- Create a function to get repository statistics
CREATE OR REPLACE FUNCTION get_repository_stats(project_id_param UUID)
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
    COUNT(*) as total_repositories,
    COUNT(*) FILTER (WHERE is_git_repository = true) as git_repositories,
    COALESCE(SUM(git_data_commit_count), 0) as total_commits,
    COALESCE(SUM(git_data_contributor_count), 0) as total_contributors,
    (SELECT local_path FROM repository_local_mappings 
     WHERE project_id = project_id_param AND is_git_repository = true 
     ORDER BY git_data_commit_count DESC LIMIT 1) as most_active_repo,
    (SELECT MAX(git_data_commit_count) FROM repository_local_mappings 
     WHERE project_id = project_id_param AND is_git_repository = true) as most_active_repo_commits,
    MIN(git_data_first_commit_date) as oldest_commit_date,
    MAX(git_data_last_commit_date) as newest_commit_date
  FROM repository_local_mappings 
  WHERE project_id = project_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create a function to refresh Git data cache for stale repositories
CREATE OR REPLACE FUNCTION get_stale_git_repositories(hours_threshold INTEGER DEFAULT 24)
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
    EXTRACT(EPOCH FROM (NOW() - rlm.git_data_last_updated)) / 3600 as hours_since_update
  FROM repository_local_mappings rlm
  WHERE 
    rlm.is_git_repository = true 
    AND (
      rlm.git_data_last_updated IS NULL 
      OR rlm.git_data_last_updated < NOW() - INTERVAL '1 hour' * hours_threshold
    )
  ORDER BY rlm.git_data_last_updated ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION get_repository_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_stale_git_repositories(INTEGER) TO authenticated;