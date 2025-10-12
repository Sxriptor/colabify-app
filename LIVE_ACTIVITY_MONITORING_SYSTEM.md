# Live Activity Monitoring System

## Overview

The Live Activity Monitoring System provides real-time tracking of developer activity across watched projects. It monitors file changes, git operations, and team presence to create a shared "live activity graph" that enhances team collaboration and awareness.

## Architecture

### Core Components

1. **GitMonitoringBackend** - Main orchestrator service
2. **LiveActivityMonitor** - Real-time file and activity tracking
3. **ProjectWatcher** - Project-level git monitoring coordinator
4. **GitWatcher** - File system watcher for git changes
5. **DatabaseSync** - Supabase integration for data persistence
6. **GitMonitoringIPC** - Electron IPC bridge
7. **useGitMonitoring** - React hook for UI integration

### Database Schema

#### Core Tables

- **project_watches** - Tracks which projects users are watching
- **live_activity_sessions** - Active development sessions
- **live_activities** - Individual activity events (commits, file changes, etc.)
- **live_file_changes** - File-level change tracking
- **live_team_awareness** - Real-time team presence and status

## Features

### 1. Project Watching
- Users can enable/disable monitoring per project
- Only watches projects with local folder mappings
- Automatic sync between database and local monitoring

### 2. Real-time Activity Tracking
- **Git Operations**: Commits, branch switches, pushes, pulls
- **File Changes**: File modifications, additions, deletions
- **Developer Presence**: Online status, current branch, focused file
- **Work Context**: What developers are currently working on

### 3. Team Awareness
- See who's online and actively coding
- View current branches and files being edited
- Recent commit messages and activity
- Status indicators (active, away, coding, reviewing)

### 4. Live Activity Feed
- Real-time stream of team activities
- Contextual information (branch, commit hash, file paths)
- Time-based activity grouping
- Activity type icons and descriptions

## Implementation Details

### Backend Services

#### GitMonitoringBackend
```typescript
// Main service that coordinates everything
const backend = new GitMonitoringBackend({
  userId: 'user-id',
  enableLiveActivity: true,
  syncInterval: 60000
})

await backend.start()
await backend.toggleProjectWatch('project-id', true)
```

#### LiveActivityMonitor
```typescript
// Tracks file changes and developer activity
const monitor = new LiveActivityMonitor(databaseSync, userId)
const sessionId = await monitor.startMonitoring(repoConfig)
await monitor.updateFocusFile(sessionId, '/path/to/file.ts')
```

### Frontend Integration

#### React Hook
```typescript
const {
  status,
  toggleProjectWatch,
  getTeamAwareness,
  getRecentActivities
} = useGitMonitoring()

// Toggle project watching
await toggleProjectWatch('project-id', true)

// Get live team data
const teamMembers = await getTeamAwareness('project-id')
const activities = await getRecentActivities('project-id', 20)
```

#### UI Component
```typescript
<LiveActivityPanel
  project={project}
  isWatching={isProjectWatched(project.id)}
  onToggleWatch={(watching) => toggleProjectWatch(project.id, watching)}
/>
```

### Electron Integration

#### IPC Handlers
- `git-monitoring:start` - Start monitoring backend
- `git-monitoring:stop` - Stop monitoring backend
- `git-monitoring:toggle-project-watch` - Enable/disable project watching
- `git-monitoring:get-team-awareness` - Get team status
- `git-monitoring:get-recent-activities` - Get activity feed

## Data Flow

### 1. Initialization
1. User opens Electron app
2. GitMonitoringBackend starts automatically
3. Syncs watched projects from database
4. Starts monitoring configured repositories

### 2. Activity Detection
1. File system watcher detects changes
2. Git watcher detects git operations
3. Activities are processed and enriched
4. Data is synced to database
5. UI updates in real-time

### 3. Team Awareness
1. Developer activities update team status
2. Presence heartbeat maintains online status
3. Focus file changes update current work context
4. Team members see live updates

## Configuration

### Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
```

### Monitoring Settings
- **Sync Interval**: How often to sync with database (default: 1 minute)
- **Session Timeout**: When to mark sessions inactive (default: 10 minutes)
- **Heartbeat Interval**: Presence update frequency (default: 30 seconds)

## Security & Privacy

### Row Level Security (RLS)
- Users can only see data for projects they're members of
- Personal activity data is protected
- Project owners have additional permissions

### Data Retention
- Activities older than 30 days are automatically cleaned up
- Inactive sessions are removed after 7 days
- File changes are retained for 7 days

## Usage Examples

### Enable Project Watching
```typescript
// In React component
const { toggleProjectWatch } = useGitMonitoring()

const handleEnableWatching = async () => {
  const result = await toggleProjectWatch(project.id, true)
  if (result.success) {
    console.log('Started watching project')
  }
}
```

### Display Team Activity
```typescript
// Get live team data
const teamMembers = await getTeamAwareness(project.id)

teamMembers.forEach(member => {
  console.log(`${member.userName} is ${member.status}`)
  console.log(`Working on: ${member.workingOn}`)
  console.log(`Current branch: ${member.currentBranch}`)
})
```

### Show Recent Activities
```typescript
const activities = await getRecentActivities(project.id, 10)

activities.forEach(activity => {
  console.log(`${activity.userName} ${activity.activityType}`)
  console.log(`Details:`, activity.activityData)
})
```

## Benefits

### For Individual Developers
- **Context Awareness**: See what teammates are working on
- **Coordination**: Avoid conflicts and duplicate work
- **Learning**: Observe coding patterns and practices
- **Motivation**: Stay engaged with team activity

### For Teams
- **Collaboration**: Real-time awareness of team activity
- **Project Health**: Monitor development velocity and patterns
- **Code Review**: See when changes are ready for review
- **Onboarding**: Help new team members understand project activity

### for Project Managers
- **Visibility**: Real-time view of development progress
- **Resource Planning**: Understand team capacity and focus areas
- **Bottleneck Detection**: Identify areas where team members need help
- **Activity Metrics**: Data-driven insights into development patterns

## Future Enhancements

1. **Code Review Integration**: Track review requests and approvals
2. **IDE Integration**: Deeper editor integration for better context
3. **Notification System**: Smart notifications for relevant activities
4. **Analytics Dashboard**: Historical activity analysis and insights
5. **Mobile App**: View team activity on mobile devices
6. **Slack/Discord Integration**: Activity notifications in team chat
7. **AI Insights**: Intelligent suggestions based on activity patterns

## Troubleshooting

### Common Issues

1. **Backend Not Starting**: Check user authentication and database connection
2. **No Activities Detected**: Verify local folder mappings and git repository status
3. **Team Data Not Loading**: Check project membership and RLS policies
4. **High CPU Usage**: Adjust file watcher ignore patterns for large repositories

### Debug Commands
```typescript
// Check backend status
const status = await window.electron.invoke('git-monitoring:status')

// Restart monitoring
await window.electron.invoke('git-monitoring:stop')
await window.electron.invoke('git-monitoring:start', config)
```

This system creates a powerful foundation for real-time team collaboration and awareness, transforming individual development work into a shared, visible experience that enhances productivity and team cohesion.