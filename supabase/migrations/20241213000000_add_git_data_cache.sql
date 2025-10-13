-- Add Git data cache column to repository_local_mappings table
-- This will store the complete Git history and metadata as JSON when a repository is scanned

ALTER TABLE repository_local_mappings 
ADD COLUMN git_data_cache JSONB,
ADD COLUMN git_data_last_updated TIMESTAMPTZ,
ADD COLUMN git_data_commit_count INTEGER DEFAULT 0,
ADD COLUMN git_data_branch_count INTEGER DEFAULT 0,
ADD COLUMN git_data_last_commit_sha TEXT,
ADD COLUMN git_data_last_commit_date TIMESTAMPTZ;

-- Add indexes for better query performance
CREATE INDEX idx_repository_local_mappings_git_data_updated 
ON repository_local_mappings(git_data_last_updated);

CREATE INDEX idx_repository_local_mappings_last_commit_date 
ON repository_local_mappings(git_data_last_commit_date);

CREATE INDEX idx_repository_local_mappings_commit_count 
ON repository_local_mappings(git_data_commit_count);

-- Add comments to document the new columns
COMMENT ON COLUMN repository_local_mappings.git_data_cache IS 
'Complete Git repository data cached as JSON including commits, branches, remotes, and metadata';

COMMENT ON COLUMN repository_local_mappings.git_data_last_updated IS 
'Timestamp when the Git data cache was last updated';

COMMENT ON COLUMN repository_local_mappings.git_data_commit_count IS 
'Total number of commits in the cached Git data for quick reference';

COMMENT ON COLUMN repository_local_mappings.git_data_branch_count IS 
'Total number of branches in the cached Git data for quick reference';

COMMENT ON COLUMN repository_local_mappings.git_data_last_commit_sha IS 
'SHA of the most recent commit for change detection';

COMMENT ON COLUMN repository_local_mappings.git_data_last_commit_date IS 
'Date of the most recent commit for sorting and filtering';

-- Example of the JSON structure that will be stored in git_data_cache:
/*
{
  "repoPath": "/path/to/repo",
  "readAt": "2024-12-13T10:30:00Z",
  "commits": [
    {
      "sha": "abc123...",
      "message": "Commit message",
      "author": {
        "name": "Author Name",
        "email": "author@example.com"
      },
      "date": "2024-12-13T09:00:00Z",
      "branches": ["main", "feature-branch"],
      "stats": {
        "additions": 10,
        "deletions": 5
      }
    }
  ],
  "branches": [
    {
      "name": "main",
      "isLocal": true,
      "isRemote": false,
      "lastCommitSha": "abc123..."
    }
  ],
  "remotes": {
    "origin": "https://github.com/user/repo.git"
  },
  "currentBranch": "main",
  "isDirty": false,
  "ahead": 0,
  "behind": 0,
  "contributors": [
    {
      "name": "Author Name",
      "email": "author@example.com",
      "commitCount": 25,
      "lastCommitDate": "2024-12-13T09:00:00Z"
    }
  ],
  "summary": {
    "totalCommits": 150,
    "totalBranches": 5,
    "totalContributors": 3,
    "firstCommitDate": "2024-01-01T00:00:00Z",
    "lastCommitDate": "2024-12-13T09:00:00Z",
    "linesOfCode": {
      "additions": 5000,
      "deletions": 1200
    }
  }
}
*/