# Cache-First Loading - How It Works 🚀

## The Problem We Solved

**Before:** Every time you opened the repo visualization, it ran Git commands and waited 2-5 seconds.

**After:** Instant display from database cache, background refresh only updates if changed.

## How It Works Now

### First Time Opening (No Cache Yet)

```
1. Open modal
   ↓
2. Check repository_local_mappings.git_data_cache
   ↓
3. No cache found ❌
   ↓
4. Show loading spinner
   ↓
5. Run Git commands (reads .git folders)
   ↓
6. Display data (2-5 seconds)
   ↓
7. Save to git_data_cache ✅
   ↓
8. Next time will be instant!
```

**Console Output:**
```
🎬 Modal opened - starting cache-first load sequence
⚡ CACHE LOAD: Reading from repository_local_mappings.git_data_cache...
📂 CACHE LOAD: Found 2 local mappings
📦 CACHE LOAD: No cached data found - will load fresh
💡 Future opens will be instant using cached data!
🔄 GIT FETCH: Showing loading state for fresh fetch
📚 Reading complete Git history from: /path/to/repo1
📚 Reading complete Git history from: /path/to/repo2
✅ Read 150 commits from /path/to/repo1
💾 Updating Git data cache for mapping xyz-123
✅ Git data cache updated for mapping xyz-123
✅ GIT FETCH: Loading complete
```

### Subsequent Opens (With Cache)

```
1. Open modal
   ↓
2. Check repository_local_mappings.git_data_cache
   ↓
3. Cache found! ✅
   ↓
4. Display cached data INSTANTLY (< 100ms)
   ↓
5. Wait 1 second
   ↓
6. Run Git commands silently in background
   ↓
7. Compare with cached data
   ↓
8. Only update UI if changed
```

**Console Output:**
```
🎬 Modal opened - starting cache-first load sequence
⚡ CACHE LOAD: Reading from repository_local_mappings.git_data_cache...
📂 CACHE LOAD: Found 2 local mappings
💾 CACHE LOAD: Found 150 commits for repo1
💾 CACHE LOAD: Found 89 commits for repo2
✅ CACHE LOAD: Displaying 2 repos, 239 commits INSTANTLY
⏱️ Cache displayed - scheduling background refresh in 1 second...
    [UI shows data here - 1 second pause]
🔄 Starting background Git refresh (1 scan per repo)
🔄 GIT FETCH: Starting background refresh (silent)
⚠️ GIT FETCH: Already fetching - skipping duplicate request
📚 Reading complete Git history from: /path/to/repo1
✅ No data changes detected - skipping UI update
✅ GIT FETCH: Loading complete
```

## Cache Population

The cache (`repository_local_mappings.git_data_cache`) gets populated when:

### 1. Manual Fetch (Repo Visualization)
- You open the visualization modal
- Git commands run
- Data saved to `git_data_cache` via `updateGitDataCache()`

### 2. Auto-Scanner (Background Service)
- Runs every 5-10 seconds (configurable)
- Scans all repositories with `local_mappings`
- Saves to `git_data_cache` automatically

### 3. When Adding a Folder
- User adds local folder via "Add Local Folder" modal
- Creates entry in `repository_local_mappings`
- Auto-scanner will pick it up on next run
- OR visualization will scan it on first open

## Preventing Duplicates

### isFetching Flag
```typescript
if (isFetching) {
  console.log('⚠️ Already fetching - skipping duplicate')
  return // Prevents duplicate scans!
}
```

This prevents:
- ❌ Manual fetch + auto-scanner running at same time
- ❌ Multiple manual fetches
- ❌ Tab switches triggering multiple fetches

## Auto-Scanner Coordination

The auto-scanner runs independently, but:
- The visualization's `isFetching` flag prevents conflicts
- Git events trigger background checks (not full scans)
- Test events are filtered out

## Cache Freshness

### When Cache is Used
- Less than 24 hours old
- Contains valid commits data
- Repository path matches

### When Cache is Ignored
- Older than 24 hours
- Missing/corrupt data
- Never been scanned

## Troubleshooting

### "Still seeing duplicates"
**Cause:** Auto-scanner and manual fetch running simultaneously

**Solution:** The `isFetching` flag should prevent this. Check console for:
```
⚠️ GIT FETCH: Already fetching - skipping duplicate request
```

### "Cache not showing instantly"
**Cause:** Cache not populated yet (first time)

**Expected:** First open will scan and populate cache. Second open will be instant.

**Check:** Look in database:
```sql
SELECT 
  local_path,
  git_data_cache IS NOT NULL as has_cache,
  git_data_commit_count,
  git_data_last_updated
FROM repository_local_mappings;
```

### "Too many console logs"
**Current behavior:** Detailed logging helps debug
- Prefix `CACHE LOAD:` = cache operations
- Prefix `GIT FETCH:` = Git command operations

Can be reduced in production if needed.

## Expected Timeline

| Time | Action | What User Sees |
|------|--------|----------------|
| 0ms | Modal opens | Empty modal |
| 10-50ms | Check cache | Still empty |
| 50-100ms | Display cache | ✅ **Data appears!** |
| 1000ms | Schedule background | Data still showing |
| 1000ms+ | Run Git commands | Data still showing (silent) |
| 3000ms+ | Compare results | Update only if changed |

## Summary

✅ **First open**: Scans and caches (one-time setup)
✅ **All future opens**: Instant from cache (< 100ms)
✅ **Background refresh**: Silent, only updates if changed
✅ **No duplicates**: `isFetching` flag prevents conflicts
✅ **Persists**: Cache survives app restarts
✅ **Works offline**: If folder not accessible, uses cache

---

**Next Test:** Close modal, reopen it - should be instant with cached data!

