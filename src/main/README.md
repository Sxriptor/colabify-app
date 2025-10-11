# Git Monitoring Backend

This directory contains the backend implementation for Git repository monitoring in the Electron application.

## Structure

```
src/main/
├── index.ts                    # Main entry point and GitMonitoringBackend class
├── ipc/
│   └── GitIPC.ts              # IPC handlers for renderer communication
├── services/
│   ├── GitState.ts            # Git command execution and state reading
│   ├── GitWatcher.ts          # Individual repository file system monitoring
│   ├── ProjectWatcher.ts      # Project-level repository coordination
│   └── ProjectWatcherManager.ts # Manager for all project watchers
├── store/
│   └── RepoStore.ts           # JSON-based repository configuration storage
└── util/
    └── gitExec.ts             # Safe Git command execution utility
```

## Implementation Status

- ✅ **Task 1**: Project structure and core interfaces
- ⏳ **Task 2**: Git command execution utilities (GitExecutor, GitState)
- ⏳ **Task 3**: Repository state management and storage (RepoStore)
- ⏳ **Task 4**: File system monitoring (GitWatcher)
- ⏳ **Task 5**: Project-level monitoring (ProjectWatcher, ProjectWatcherManager)
- ⏳ **Task 6**: IPC communication layer (GitIPC)
- ⏳ **Task 7**: Electron main process integration
- ⏳ **Task 8**: Error handling and performance optimization

## Usage

```typescript
import { gitMonitoringBackend } from './src/main'

// Initialize in electron/main.js after app is ready
await gitMonitoringBackend.initialize()

// Cleanup on app shutdown
await gitMonitoringBackend.cleanup()
```

## Dependencies

- `chokidar` - Cross-platform file system watching
- `electron` - IPC communication and app integration
- Built-in Node.js modules: `child_process`, `fs`, `path`