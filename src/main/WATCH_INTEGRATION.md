# Watch System Integration Guide

## 🔍 Current Watch System Analysis

### Database Schema
```sql
-- project_watches table
CREATE TABLE project_watches (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, project_id)
);
```

### Frontend Watch Flow
```typescript
// 1. Fetch projects with watch status
const { data } = await supabase
  .from('projects')
  .select(`
    *,
    watches:project_watches!project_watches_project_id_fkey(id, user_id)
  `)

// 2. Determine if user is watching
const isWatching = project.watches?.some(watch => watch.user_id === currentUserId)

// 3. Toggle watch state
const handleWatchToggle = async (projectId: string, isWatching: boolean) => {
  if (isWatching) {
    // Remove watch
    await supabase.from('project_watches')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', user?.id)
  } else {
    // Add watch  
    await supabase.from('project_watches')
      .insert({ project_id: projectId, user_id: user?.id })
  }
  
  // 🔗 NEW: Notify Git monitoring backend
  await electronAPI.invoke('git:watchProject', projectId, !isWatching)
}
```

## 🔗 Git Monitoring Integration Points

### 1. **Watch Toggle Integration** ✅
- **Location**: `src/components/dashboard/DashboardContent.tsx`
- **Integration**: Added `git:watchProject` IPC call to existing `handleWatchToggle()`
- **Flow**: Supabase update → Git backend notification → Local state update

### 2. **Repository Mapping**
- **Current**: `repositories` table with `local_mappings` for local paths
- **Git Backend**: Needs `RepoConfig` objects with `{ id, projectId, path, watching, last }`
- **Sync Point**: Convert database mappings to Git backend configurations

### 3. **Startup Synchronization**
- **Need**: Restore watch state from database on app startup
- **Implementation**: `DatabaseSync.syncWatchedProjects(currentUserId)`
- **Flow**: App start → Query watched projects → Start Git monitoring

### 4. **User Context**
- **Current**: Watch state is per-user (`user_id` in `project_watches`)
- **Git Backend**: Needs current user context for filtering
- **Solution**: Pass `currentUserId` to Git monitoring initialization

## 🚀 Implementation Strategy

### Phase 1: Basic Integration (Current)
```javascript
// Simple Git monitoring with watch tracking
class SimpleGitMonitoring {
  watchedProjects = new Set()
  
  async handleWatchProject(projectId, on) {
    if (on) {
      this.watchedProjects.add(projectId)
    } else {
      this.watchedProjects.delete(projectId)
    }
    // Emit events to renderer
  }
}
```

### Phase 2: Database Synchronization
```typescript
// Full TypeScript implementation with database sync
class GitMonitoringBackend {
  async initialize(mainWindow, currentUserId) {
    // 1. Load repository configurations from database
    const watchedProjects = await this.databaseSync.syncWatchedProjects(currentUserId)
    
    // 2. Start Git monitoring for watched projects
    for (const projectId of watchedProjects) {
      await this.projectWatcherManager.startWatching(projectId)
    }
  }
}
```

### Phase 3: Real-time Synchronization
```typescript
// Listen for database changes and sync Git monitoring
supabase
  .channel('project_watches')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'project_watches' },
    (payload) => {
      // Sync Git monitoring with database changes
      this.handleDatabaseWatchChange(payload)
    }
  )
```

## 📊 Data Flow Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend UI   │    │    Supabase DB   │    │  Git Monitoring     │
│                 │    │                  │    │     Backend         │
├─────────────────┤    ├──────────────────┤    ├─────────────────────┤
│ ProjectCard     │───▶│ project_watches  │    │ ProjectWatcher      │
│ Watch Button    │    │ INSERT/DELETE    │    │ GitWatcher          │
│                 │    │                  │    │ RepoStore           │
│ handleWatchToggle│◄──┤                  │◄───│                     │
│                 │    │ Query watched    │    │ Sync on startup     │
│ Local State     │    │ projects         │    │                     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 │
                    ┌──────────────────┐
                    │   IPC Channel    │
                    │ git:watchProject │
                    │   git:event      │
                    └──────────────────┘
```

## 🔧 Testing the Integration

### 1. **Verify Watch Toggle**
```bash
# Start app and check console
npm run dev

# Expected logs:
# 🚀 Initializing simple Git monitoring...
# 📡 Git IPC: Starting watch for project abc-123
# ✅ Now watching project abc-123
# 📊 Currently watching 1 projects: ['abc-123']
```

### 2. **Test IPC Communication**
- Click watch button on project card
- Check browser console for Git backend notifications
- Verify events appear in Git Monitoring Test component

### 3. **Verify State Persistence**
- Toggle watch on/off multiple times
- Check that state is maintained correctly
- Verify database updates in Supabase dashboard

## 🎯 Key Integration Points

### ✅ **Completed**
1. **IPC Handler Registration** - `git:watchProject`, `git:listProjectRepos`, `git:getRepoState`
2. **Frontend Integration** - Added Git backend notification to `handleWatchToggle()`
3. **Event Emission** - Git events sent to renderer via `git:event` channel
4. **Test Interface** - GitMonitoringTest component for verification

### 🔄 **Next Steps**
1. **Database Sync** - Implement `DatabaseSync` service for startup restoration
2. **Repository Mapping** - Convert `local_mappings` to `RepoConfig` objects  
3. **User Context** - Pass current user ID to Git monitoring backend
4. **Real-time Sync** - Listen for database changes and update Git monitoring

### 🚀 **Future Enhancements**
1. **Activity UI** - Display Git activities in project dashboard
2. **Notifications** - Push notifications for important Git events
3. **Filtering** - User preferences for which activities to monitor
4. **Analytics** - Track team activity and productivity metrics

## 🔍 Debugging Tips

### Check Watch State
```javascript
// In browser console
window.electronAPI.invoke('git:listProjectRepos', 'project-id')
  .then(repos => console.log('Repositories:', repos))
```

### Monitor Git Events
```javascript
// Listen for all Git events
window.electronAPI.ipcRenderer.on('git:event', (event) => {
  console.log('Git Event:', event)
})
```

### Verify Database State
```sql
-- Check current watches in Supabase
SELECT p.name, pw.user_id, pw.created_at 
FROM project_watches pw
JOIN projects p ON p.id = pw.project_id
ORDER BY pw.created_at DESC;
```

This integration ensures the Git monitoring backend works seamlessly with the existing project watch system while maintaining data consistency and user experience.