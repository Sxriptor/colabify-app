# Fix: Background Refresh File Changes Not Syncing

## Problem

The `GitDataManager` was using cached data and not syncing file changes to the `live_file_changes` table during background refreshes. The logs showed:

```
✅ [GitDataManager] electron-colabify cache is fresh, using cached data
```

File changes were detected but not being synced to the database.

## Root Cause

The `GitDataManager.refreshGitData()` method was:
1. Reading git state from Electron API ✅
2. Detecting uncommitted changes for UI display ✅
3. **BUT NOT** syncing the detailed file changes to the database ❌

Even though the Electron backend (`git-monitoring-simple.js`) was enhanced to return `fileChanges` with statistics in the git state, the frontend wasn't using this data to update the database.

## Solution

### Changes Made to `src/services/GitDataManager.ts`

#### 1. Added File Change Syncing

After detecting uncommitted changes (lines 393-421), added code to sync file changes to database:

```typescript
// Sync file changes to database if there are uncommitted changes
if (uncommittedChanges.length > 0 && gitState.fileChanges) {
  try {
    await this.syncFileChangesToDatabase(
      projectId,
      userId || mapping.user_id,
      repo.id,
      gitState.fileChanges
    )
    console.log(`💾 [GitDataManager] Synced ${gitState.fileChanges.length} file changes for ${repo.name}`)
  } catch (syncError) {
    console.error(`❌ [GitDataManager] Failed to sync file changes:`, syncError)
  }
}
```

#### 2. Added `syncFileChangesToDatabase()` Method

New private method that:
- Accepts project, user, repository IDs and file changes array
- Creates a session ID for tracking
- Formats file changes for the API
- Calls the `/api/live-activities/file-changes` endpoint
- Handles errors gracefully

```typescript
private async syncFileChangesToDatabase(
  projectId: string,
  userId: string,
  repositoryId: string,
  fileChanges: Array<{...}>
): Promise<void>
```

## How It Works Now

### Background Refresh Flow

```
1. Timer triggers every 5 minutes (or manual refresh)
   ↓
2. GitDataManager.refreshGitData() called
   ↓
3. Electron API returns git state WITH fileChanges array
   ↓
4. Parse uncommitted changes (for UI display)
   ↓
5. IF uncommitted changes exist AND fileChanges exist:
   ├─→ Call syncFileChangesToDatabase()
   ├─→ Format file changes for API
   ├─→ POST to /api/live-activities/file-changes
   └─→ Database updated
   ↓
6. Continue with normal cache update
```

### What Gets Synced

For each file change detected during background refresh:
- File path
- Change type (MODIFIED, ADDED, DELETED, RENAMED)
- Lines added (from `git diff --numstat`)
- Lines removed (from `git diff --numstat`)
- File type (extension)
- Timestamps

## Logs You'll Now See

### Before Fix
```
✅ [GitDataManager] electron-colabify cache is fresh, using cached data
```

### After Fix
```
✅ [GitDataManager] electron-colabify cache is fresh, using cached data
💾 [GitDataManager] Synced 3 file changes for electron-colabify
✅ [GitDataManager] File changes synced: { success: true, message: 'Synced 3 file changes' }
```

## Benefits

1. **Always Up-to-Date**: File changes are now synced even when using cached commit history
2. **Dual Coverage**: Both real-time monitoring AND background refresh sync file changes
3. **No Data Loss**: File changes aren't missed during cache-fresh periods
4. **Better Performance**: Syncing happens efficiently during existing background refresh

## Testing

To verify the fix works:

1. **Make file changes** in your repository
2. **Wait for background refresh** (5 minutes) or trigger manually
3. **Check console logs** for sync messages
4. **Query database**:
   ```sql
   SELECT 
     file_path,
     change_type,
     lines_added,
     lines_removed,
     last_change_at
   FROM live_file_changes 
   WHERE project_id = 'your-project-id'
   ORDER BY last_change_at DESC
   LIMIT 10;
   ```

## Files Modified

- `src/services/GitDataManager.ts` - Added file change syncing to background refresh

## Related Documentation

- `GIT_FILE_CHANGES_TRACKING_IMPLEMENTATION.md` - Complete implementation details
- `GIT_FILE_CHANGES_SUMMARY.md` - Quick reference guide

## Migration Notes

No database migrations needed. Uses existing:
- `live_file_changes` table
- `/api/live-activities/file-changes` endpoint
- Electron `readDirectGitState` API (already returns fileChanges)

Everything works out of the box! 🎉

