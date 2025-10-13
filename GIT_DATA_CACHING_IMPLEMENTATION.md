# Git Data Caching Implementation

## Overview
Implemented a comprehensive Git data caching system that stores complete repository information in the database, enabling visualization of repositories even when they're not available on the current PC.

## Database Schema Changes

### New Columns Added to `repository_local_mappings`
```sql
-- Core cache storage
git_data_cache JSONB                    -- Complete Git data as JSON
git_data_last_updated TIMESTAMPTZ       -- When cache was last updated

-- Quick reference fields for queries
git_data_commit_count INTEGER DEFAULT 0  -- Total commits cached
git_data_branch_count INTEGER DEFAULT 0  -- Total branches cached
git_data_last_commit_sha TEXT           -- Latest commit SHA
git_data_last_commit_date TIMESTAMPTZ   -- Latest commit date
```

### Indexes for Performance
- `idx_repository_local_mappings_git_data_updated` - For cache freshness queries
- `idx_repository_local_mappings_last_commit_date` - For sorting by activity
- `idx_repository_local_mappings_commit_count` - For filtering by repository size

## JSON Cache Structure
```json
{
  "repoPath": "/path/to/repo",
  "readAt": "2024-12-13T10:30:00Z",
  "cachedAt": "2024-12-13T10:30:00Z",
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
```

## Implementation Features

### 1. Automatic Cache Updates
- **Triggers on successful Git reads** - Cache is updated whenever a repository is successfully scanned
- **Background updates** - Cache updates don't block the UI
- **Error handling** - Failed cache updates don't affect visualization
- **Metadata extraction** - Summary statistics are calculated and stored

### 2. Smart Repository Handling
```typescript
// Repository states now handled:
1. Available + Fresh Data    → Full visualization with live data
2. Available + Cached Data   → Full visualization with cache indicator  
3. Not Available + Cache     → Full visualization using cached data
4. Not Available + No Cache  → Placeholder with helpful message
```

### 3. Enhanced UI States

#### **Cached Data Visualization**
- **Blue theme** indicates cached data usage
- **Cache indicators** show data source and last update
- **Full visualizations** work with cached data
- **Timestamp display** shows when data was cached

#### **No Cache Available**
- **Yellow theme** indicates missing repository
- **Clear messaging** explains the situation
- **Path information** helps with troubleshooting
- **Helpful guidance** for users

### 4. Data Processing Logic
```typescript
// Path existence check
if (!pathExists) {
  if (mapping.git_data_cache) {
    // Use cached data for full visualization
    createCachedRepository(mapping)
  } else {
    // Show placeholder with no data
    createPlaceholderRepository(mapping)
  }
  continue
}

// Path exists - read fresh data
const history = await readCompleteGitHistory(path)
if (history) {
  // Update cache with fresh data
  await updateGitDataCache(mapping.id, history)
  createLiveRepository(history)
}
```

## Benefits

### 1. **Cross-Machine Compatibility**
- Projects work on any machine regardless of which repositories are locally available
- Team members can view all project repositories even if they don't have them cloned
- Consistent project visualization across different development environments

### 2. **Offline Capability**
- Repositories can be visualized using cached data when offline
- No dependency on live Git operations for basic visualization
- Historical data remains accessible even when repositories are moved

### 3. **Performance Optimization**
- Cached data reduces Git operations on subsequent loads
- Quick reference fields enable fast queries without parsing JSON
- Indexed columns support efficient filtering and sorting

### 4. **Data Persistence**
- Repository history is preserved even if local copies are deleted
- Team knowledge is retained in the database
- Historical analysis remains possible across repository lifecycle

## User Experience

### **Live Repository** (Green indicators)
- Real-time data with full Git integration
- All features available
- Automatic cache updates

### **Cached Repository** (Blue indicators)
- Full visualization using cached data
- Clear indication of data source
- Shows cache timestamp
- All visualizations work normally

### **Missing Repository** (Yellow indicators)
- Clear explanation of the situation
- Helpful guidance for users
- Path information for troubleshooting
- No broken functionality

## Technical Implementation

### Cache Update Function
```typescript
const updateGitDataCache = async (mappingId: string, gitHistory: any) => {
  const cacheData = {
    ...gitHistory,
    cachedAt: new Date().toISOString(),
    summary: {
      totalCommits: gitHistory.commits?.length || 0,
      totalBranches: gitHistory.branches?.length || 0,
      totalContributors: new Set(gitHistory.commits?.map(c => c.author?.email)).size,
      // ... more summary stats
    }
  }

  await supabase
    .from('repository_local_mappings')
    .update({
      git_data_cache: cacheData,
      git_data_last_updated: new Date().toISOString(),
      git_data_commit_count: gitHistory.commits?.length || 0,
      // ... other fields
    })
    .eq('id', mappingId)
}
```

### Repository State Detection
```typescript
const pathExists = await electronAPI.fs.pathExists(mapping.local_path)
const hasCachedData = mapping.git_data_cache && mapping.git_data_cache.commits

if (!pathExists && hasCachedData) {
  // Use cached data for visualization
  return createCachedRepository(mapping)
} else if (!pathExists) {
  // Show placeholder
  return createPlaceholderRepository(mapping)
}
```

## Files Modified
- `supabase/migrations/20241213000000_add_git_data_cache.sql` - Database schema
- `src/components/projects/repovisual/hooks/useRepositoryData.ts` - Cache logic
- `src/components/projects/repovisual/local/LocalRepositoryView.tsx` - UI handling
- `src/components/projects/repovisual/types.ts` - Type definitions

## Future Enhancements
- Cache invalidation strategies
- Selective cache updates (only changed data)
- Cache compression for large repositories
- Cache sharing between team members
- Automatic cache refresh scheduling