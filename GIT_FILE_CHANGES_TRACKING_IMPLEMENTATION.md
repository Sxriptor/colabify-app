# Git File Changes Tracking Implementation

## Overview

This document describes the implementation of file change tracking in the git scanning system. When the git monitoring detects recent changes, it now automatically detects individual file changes and inserts/updates them in the `live_file_changes` database table.

## Changes Made

### 1. Database Schema

The system uses the existing `live_file_changes` table defined in `supabase/migrations/20241212000000_add_live_activity_monitoring.sql`:

```sql
CREATE TABLE IF NOT EXISTS live_file_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES live_activity_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- File details
  file_path TEXT NOT NULL,
  file_type TEXT,
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
```

### 2. ActivityDetector Enhancement (`src/main/services/ActivityDetector.ts`)

Added a new method `detectFileChanges()` that:
- Parses git status output to identify changed files
- Determines the change type (MODIFIED, ADDED, DELETED, RENAMED) from git status codes
- Uses `git diff --numstat` to get statistics for each file:
  - Lines added
  - Lines removed
- Returns structured file change data

**Key Features:**
- Handles both staged and unstaged changes
- Gracefully handles deleted files (no diff stats needed)
- Falls back to defaults if diff stats cannot be retrieved

```typescript
static async detectFileChanges(
  cwd: string,
  currentState: RepoState
): Promise<Array<{
  filePath: string,
  changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED',
  linesAdded: number,
  linesRemoved: number
}>>
```

### 3. DatabaseSync Enhancement (`src/main/services/DatabaseSync.ts`)

Updated the `syncFileChanges()` method to:
- Accept additional parameters: `userId` and `projectId`
- Make actual API calls to Supabase REST API
- Use the `Prefer: resolution=merge-duplicates` header for upsert behavior
- Handle errors gracefully with proper logging

**Method Signature:**
```typescript
async syncFileChanges(
  sessionId: string,
  userId: string,
  projectId: string,
  fileChanges: FileChange[]
): Promise<void>
```

### 4. GitMonitoringBackend Enhancement (`src/main/services/GitMonitoringBackend.ts`)

Added `detectAndSyncFileChanges()` method that:
- Triggers when `WORKTREE_CHANGE` or `COMMIT` activities are detected
- Retrieves the repository configuration
- Reads the current git state
- Calls `ActivityDetector.detectFileChanges()` to get file change details
- Syncs the changes to the database via `DatabaseSync.syncFileChanges()`

**Integration Points:**
- Automatically called in the `handleActivity()` method
- Works seamlessly with existing activity detection pipeline

### 5. LiveActivityMonitor Enhancement (`src/main/services/LiveActivityMonitor.ts`)

Updated the `performPeriodicSync()` method to:
- Iterate through all active sessions
- Sync accumulated file changes to the database every 60 seconds
- Pass proper session context (userId, projectId) to the sync method

### 6. Electron Simple Git Monitoring (`electron/git-monitoring-simple.js`)

Enhanced the `getActualGitState()` method to:
- Include file changes in the git state object
- Added `detectFileChanges()` method that:
  - Parses git status output
  - Determines change types
  - Retrieves diff statistics using `git diff --numstat`
  - Returns file change data

**Output Structure:**
```javascript
{
  branch: 'main',
  head: 'abc1234',
  statusShort: 'M  src/file.js\nA  src/new.js',
  fileChanges: [
    {
      filePath: 'src/file.js',
      changeType: 'MODIFIED',
      linesAdded: 10,
      linesRemoved: 5
    },
    {
      filePath: 'src/new.js',
      changeType: 'ADDED',
      linesAdded: 50,
      linesRemoved: 0
    }
  ],
  // ... other fields
}
```

### 7. API Endpoint (`src/app/api/live-activities/file-changes/route.ts`)

Created a new API endpoint to handle file change synchronization from the frontend/Electron app:

**POST `/api/live-activities/file-changes`**
- Accepts: `sessionId`, `projectId`, `fileChanges[]`
- Validates user authentication
- Verifies user has access to the project
- Upserts file changes to `live_file_changes` table
- Returns success status and synced data

**GET `/api/live-activities/file-changes`**
- Accepts query params: `sessionId` or `projectId`
- Returns file changes for the specified session or project
- Filters by current user
- Limits to 100 most recent changes

## Data Flow

### Backend (TypeScript) - Real-time Monitoring

```
1. Git Watcher detects file system changes
   ↓
2. GitState reads repository state (including git status)
   ↓
3. ActivityDetector compares states and detects WORKTREE_CHANGE
   ↓
4. GitMonitoringBackend.handleActivity() triggered
   ↓
5. GitMonitoringBackend.detectAndSyncFileChanges() called
   ↓
6. ActivityDetector.detectFileChanges() parses git status
   ↓
7. DatabaseSync.syncFileChanges() sends data to Supabase
   ↓
8. API endpoint receives and validates data
   ↓
9. Data inserted/updated in live_file_changes table
```

### Frontend - Background Refresh (GitDataManager)

```
1. Background refresh triggered (every 5 minutes or manually)
   ↓
2. GitDataManager.refreshGitData() called
   ↓
3. Electron API reads git state (includes fileChanges from git status)
   ↓
4. Parse uncommitted changes for UI display
   ↓
5. If fileChanges exist, call GitDataManager.syncFileChangesToDatabase()
   ↓
6. API endpoint receives and validates data
   ↓
7. Data inserted/updated in live_file_changes table
```

## Usage Examples

### Backend (TypeScript)

```typescript
// File changes are automatically detected and synced
// when git activities occur. No manual intervention needed.

// To manually trigger detection:
const fileChanges = await ActivityDetector.detectFileChanges(
  '/path/to/repo',
  currentRepoState
)

// To sync to database:
await databaseSync.syncFileChanges(
  sessionId,
  userId,
  projectId,
  fileChanges
)
```

### Frontend (API Call)

```typescript
// Sync file changes from frontend
const response = await fetch('/api/live-activities/file-changes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session-123',
    projectId: 'project-456',
    fileChanges: [
      {
        filePath: 'src/components/Button.tsx',
        fileType: 'tsx',
        changeType: 'MODIFIED',
        linesAdded: 15,
        linesRemoved: 3,
        charactersAdded: 450,
        charactersRemoved: 120,
        firstChangeAt: new Date().toISOString(),
        lastChangeAt: new Date().toISOString()
      }
    ]
  })
})

// Retrieve file changes
const response = await fetch(
  '/api/live-activities/file-changes?projectId=project-456'
)
const { fileChanges } = await response.json()
```

### Electron (JavaScript)

```javascript
// Get git state with file changes
const gitState = await gitMonitoring.getActualGitState('/path/to/repo')

// gitState.fileChanges contains array of file changes
console.log(`Detected ${gitState.fileChanges.length} changed files`)

gitState.fileChanges.forEach(change => {
  console.log(`${change.changeType}: ${change.filePath}`)
  console.log(`  +${change.linesAdded} -${change.linesRemoved}`)
})
```

## File Change Types

| Type | Description | Git Status Code |
|------|-------------|-----------------|
| `MODIFIED` | File content has been modified | M |
| `ADDED` | New file has been added | A |
| `DELETED` | File has been deleted | D |
| `RENAMED` | File has been renamed or moved | R |

## Git Status Code Mapping

The implementation parses git status porcelain format:
- First column: Staging area status
- Second column: Working tree status
- After 2 chars: File path

Examples:
```
M  src/file.js       → MODIFIED
A  src/new.js        → ADDED
D  src/old.js        → DELETED
R  old.js -> new.js  → RENAMED
MM src/both.js       → MODIFIED (staged and unstaged)
```

## Performance Considerations

1. **Debouncing**: Git watcher uses 400ms debounce to prevent excessive processing
2. **Batching**: File changes are synced in batches during periodic sync (60s interval)
3. **Caching**: LiveActivityMonitor maintains in-memory cache of file changes per session
4. **Limits**: API endpoint limits results to 100 most recent changes
5. **Upsert**: Database uses UNIQUE constraint on (session_id, file_path) for efficient updates

## Error Handling

- Gracefully handles repositories without remotes
- Falls back to defaults if diff stats unavailable
- Logs errors without crashing the monitoring system
- Returns empty arrays on parse failures
- API returns appropriate HTTP status codes

## Security

- User authentication required for API access
- Project access verification before sync
- Row Level Security (RLS) policies enforced on database
- File changes scoped to user's own sessions and accessible projects

## Testing

To test the implementation:

1. **Start git monitoring** for a project
2. **Make changes** to files in the repository
3. **Check logs** for "📁 Detected X file changes" messages
4. **Query database**:
   ```sql
   SELECT * FROM live_file_changes 
   WHERE project_id = 'your-project-id'
   ORDER BY last_change_at DESC;
   ```

## Future Enhancements

Potential improvements:
- Character-level change tracking using actual file diffs
- Support for binary file detection
- File content snippets for preview
- Conflict detection between team members
- Real-time notifications for file changes
- Visual diff integration

## Related Files

- `src/main/services/ActivityDetector.ts` - File change detection logic
- `src/main/services/DatabaseSync.ts` - Database synchronization
- `src/main/services/GitMonitoringBackend.ts` - Activity handling (real-time)
- `src/main/services/LiveActivityMonitor.ts` - Session management
- `src/services/GitDataManager.ts` - Frontend background refresh and file change syncing
- `electron/git-monitoring-simple.js` - Electron integration (includes file changes in git state)
- `src/app/api/live-activities/file-changes/route.ts` - API endpoint
- `supabase/migrations/20241212000000_add_live_activity_monitoring.sql` - Database schema

## Troubleshooting

### File changes not appearing in database

1. Check that git monitoring is running
2. Verify Supabase configuration is set in environment variables
3. Check console logs for sync errors
4. Ensure RLS policies allow user access
5. Verify session exists in `live_activity_sessions` table

### Incorrect line counts

- Ensure files are tracked by git (not in .gitignore)
- Check that `git diff --numstat` works manually
- Verify file encoding is supported

### API returns 403 Access Denied

- User must be owner or active member of the project
- Check `project_members` table for user's membership status

