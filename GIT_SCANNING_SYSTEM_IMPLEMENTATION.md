# Git Scanning System Implementation

## Overview

We've implemented a comprehensive Git scanning and caching system that automatically scans local Git repositories when they're added to projects and keeps the data up-to-date through background refresh processes.

## Architecture

### Core Components

1. **GitScanningService** (`src/services/GitScanningService.ts`)
   - Main service for scanning Git repositories
   - Handles batch processing with concurrency limits
   - Provides comprehensive error handling and reporting
   - Processes Git history into structured cache data

2. **GitCacheRefreshService** (`src/services/GitCacheRefreshService.ts`)
   - Background service for refreshing stale Git data
   - Automatic refresh scheduling with configurable intervals
   - Project-specific refresh capabilities
   - Cache health monitoring and statistics

3. **useGitScanning Hook** (`src/hooks/useGitScanning.ts`)
   - React hook for easy integration with components
   - Provides scanning state management
   - Handles auto-refresh configuration
   - Exposes scanning statistics and health metrics

### Database Schema

Enhanced the `repository_local_mappings` table with comprehensive Git data caching:

```sql
-- Core cache columns
git_data_cache JSONB                    -- Complete Git history as JSON
git_data_last_updated TIMESTAMPTZ       -- Cache timestamp
git_data_commit_count INTEGER           -- Quick commit count reference
git_data_branch_count INTEGER           -- Quick branch count reference
git_data_contributor_count INTEGER      -- Unique contributor count
git_data_last_commit_sha TEXT           -- Latest commit SHA
git_data_last_commit_date TIMESTAMPTZ   -- Latest commit date
git_data_first_commit_date TIMESTAMPTZ  -- First commit date
git_data_total_additions INTEGER        -- Total lines added
git_data_total_deletions INTEGER        -- Total lines deleted
is_git_repository BOOLEAN               -- Repository validation flag
git_current_branch TEXT                 -- Current active branch
git_current_head TEXT                   -- Current HEAD commit
git_scan_error TEXT                     -- Error message if scan failed
```

### Integration Points

1. **AddLocalFolderModal** - Scans repositories when local folders are added
2. **ConnectRepositoryModal** - Scans repositories when GitHub repos are connected
3. **Repository Visualization** - Uses cached data for faster loading
4. **Background Refresh** - Keeps data current automatically

## Features

### Comprehensive Git Data Extraction

- **Complete commit history** (configurable limit, default 2000 commits)
- **Branch information** (local and remote branches)
- **Remote repository URLs** and configuration
- **Contributor statistics** with commit counts and activity
- **Code metrics** (additions, deletions, file changes)
- **Repository health indicators** (recent activity, sync status)

### Smart Caching Strategy

- **Content-based hashing** to detect actual changes
- **Incremental updates** only when data changes
- **Cross-machine compatibility** using cached data when repos aren't locally available
- **Graceful degradation** with placeholder data for missing repositories

### Error Handling & Resilience

- **Path validation** before scanning
- **Git repository verification** 
- **Partial failure handling** (continues with other repos if one fails)
- **Detailed error reporting** with specific failure reasons
- **Automatic retry logic** for transient failures

### Performance Optimizations

- **Parallel processing** with configurable concurrency limits
- **Batch operations** for database updates
- **Debounced refresh** to prevent excessive scanning
- **Background processing** to avoid blocking UI

## Usage Examples

### Basic Scanning in Components

```typescript
import { useSimpleGitScanning } from '@/hooks/useGitScanning'

function MyComponent() {
  const { scanRepositories, isScanning, lastScanResult } = useSimpleGitScanning()
  
  const handleScan = async () => {
    const result = await scanRepositories(mappings, supabase, {
      maxCommits: 2000,
      includeBranches: true,
      includeRemotes: true,
      includeStats: true
    })
    
    if (result?.successful > 0) {
      console.log(`Scanned ${result.successful} repositories`)
    }
  }
}
```

### Auto-Refresh Setup

```typescript
import { useAutoRefreshGitScanning } from '@/hooks/useGitScanning'

function ProjectDashboard() {
  const { refreshStats, isAutoRefreshRunning } = useAutoRefreshGitScanning({
    refreshIntervalMinutes: 60,  // Refresh every hour
    staleThresholdHours: 24      // Consider data stale after 24 hours
  })
}
```

### Manual Project Refresh

```typescript
const { refreshProjectRepositories } = useGitScanning()

const refreshProject = async (projectId: string) => {
  const success = await refreshProjectRepositories(projectId, {
    forceRefresh: true
  })
}
```

## Cache Data Structure

The `git_data_cache` JSONB column stores comprehensive repository data:

```json
{
  "repoPath": "/path/to/repo",
  "cachedAt": "2024-12-13T10:30:00Z",
  "currentState": {
    "branch": "main",
    "head": "abc123...",
    "dirty": false,
    "ahead": 0,
    "behind": 0
  },
  "commits": [
    {
      "sha": "abc123...",
      "message": "Commit message",
      "author": {
        "name": "Author Name",
        "email": "author@example.com"
      },
      "date": "2024-12-13T09:00:00Z",
      "stats": {
        "additions": 10,
        "deletions": 5,
        "files": 3
      }
    }
  ],
  "branches": [
    {
      "name": "main",
      "isLocal": true,
      "isRemote": false,
      "commit": "abc123..."
    }
  ],
  "remotes": {
    "origin": {
      "fetch": "https://github.com/user/repo.git",
      "push": "https://github.com/user/repo.git"
    }
  },
  "contributors": [
    {
      "email": "author@example.com",
      "name": "Author Name",
      "commitCount": 25,
      "lastCommitDate": "2024-12-13T09:00:00Z",
      "totalAdditions": 500,
      "totalDeletions": 100
    }
  ],
  "summary": {
    "totalCommits": 150,
    "totalBranches": 5,
    "totalContributors": 3,
    "totalRemotes": 1,
    "totalTags": 10,
    "firstCommitDate": "2024-01-01T00:00:00Z",
    "lastCommitDate": "2024-12-13T09:00:00Z",
    "recentActivity": {
      "commitsLast30Days": 15,
      "isActive": true,
      "activeBranch": "main"
    },
    "codeMetrics": {
      "totalAdditions": 5000,
      "totalDeletions": 1200,
      "netLines": 3800,
      "averageCommitSize": 42
    },
    "repositoryHealth": {
      "hasRemotes": true,
      "hasMultipleBranches": true,
      "hasRecentActivity": true,
      "isUpToDate": true
    }
  }
}
```

## Database Functions

### Repository Statistics

```sql
SELECT * FROM get_repository_stats('project-uuid');
```

Returns comprehensive statistics for all repositories in a project.

### Stale Repository Detection

```sql
SELECT * FROM get_stale_git_repositories(24); -- 24 hours threshold
```

Identifies repositories that need cache refresh.

## Benefits

1. **Faster Visualization Loading** - Pre-cached data eliminates scan delays
2. **Cross-Machine Compatibility** - Visualize repos even when not locally available
3. **Automatic Data Freshness** - Background refresh keeps data current
4. **Comprehensive Analytics** - Rich repository insights and metrics
5. **Robust Error Handling** - Graceful handling of various failure scenarios
6. **Performance Optimized** - Efficient scanning and caching strategies

## Compatibility

The new Git scanning system is fully compatible with the existing repository visualization system:

- **Same Data Source**: Uses the same `electronAPI.git.readCompleteHistory()` API
- **Same Database Schema**: Reads/writes to the same cache columns
- **Complementary Timing**: Proactive caching + reactive reading
- **Fallback Support**: Existing system handles cached vs. fresh data seamlessly

## Configuration

### Scanning Options

- `maxCommits`: Maximum commits to scan (default: 2000)
- `includeBranches`: Include branch information (default: true)
- `includeRemotes`: Include remote repository data (default: true)
- `includeStats`: Include commit statistics (default: true)
- `forceRefresh`: Force refresh even if cache is recent (default: false)

### Refresh Options

- `staleThresholdHours`: Hours before data is considered stale (default: 24)
- `refreshIntervalMinutes`: Auto-refresh interval (default: 60)
- `maxRepositoriesPerBatch`: Max repos to refresh per batch (default: 5)
- `enableAutoRefresh`: Enable automatic background refresh (default: false)

## Monitoring

The system provides comprehensive monitoring through:

- **Scan Results**: Success/failure counts, error details
- **Refresh Statistics**: Last refresh time, repositories processed
- **Cache Health**: Age of cached data, error repositories
- **Performance Metrics**: Scan duration, batch processing stats

This implementation provides a robust, scalable foundation for Git repository data management with excellent user experience and developer productivity benefits.