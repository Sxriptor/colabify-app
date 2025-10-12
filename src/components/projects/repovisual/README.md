# Repository Visualization - Refactored Structure

This directory contains the refactored Repository Visualization Modal components, organized into a clean, modular structure.

## Directory Structure

```
repovisual/
├── types.ts                    # TypeScript interfaces and types
├── utils.ts                    # Utility functions (formatTimeAgo, getRepoInfo, etc.)
├── dataFetchers.ts            # Data fetching logic (Git, GitHub API, mock data)
├── hooks/
│   └── useRepositoryData.ts   # Custom hook for managing repository data state
├── local/                     # Local repository tab components
│   ├── LocalRepositoryView.tsx      # Main local tab view
│   ├── LocalBranchList.tsx          # Local branches list
│   ├── LocalActivityLog.tsx         # Terminal-style activity log
│   ├── RecentActivity.tsx           # Recent commits display
│   └── TeamStatus.tsx               # Team member status panel
├── remote/                    # Remote repository tab components
│   ├── RemoteRepositoryView.tsx     # Main remote tab view
│   └── RemoteBranchVisualization.tsx # ASCII branch tree visualization
└── shared/                    # Shared/reusable components
    ├── StatusCard.tsx               # Reusable status card component
    ├── CommitFrequencyChart.tsx     # Commit frequency visualization
    └── BackendStatus.tsx            # Backend connection status display
```

## Main Component

**`RepoVisualizationModal.tsx`** (parent directory)
- Main modal container
- Tab navigation (Local/Remote)
- Sub-tab navigation for multiple local repositories
- Loading and error states
- Delegates rendering to view components

## Core Files

### `types.ts`
Defines all TypeScript interfaces:
- `GitHubBranch` - Branch data structure
- `GitHubCommit` - Commit data structure
- `LocalUserLocation` - Team member location data
- `BranchNode` - D3 visualization node (for future use)
- `DataSource`, `GitHubDataSource`, `ActiveTab` - Type unions

### `utils.ts`
Utility functions:
- `formatTimeAgo()` - Formats timestamps to relative time
- `getLocalRepositoryInfo()` - Extracts local repo metadata
- `getRemoteRepositoryInfo()` - Extracts remote repo metadata

### `dataFetchers.ts`
Data fetching logic:
- `readGitDataFromPath()` - Reads Git data from local path via Electron API
- `generateCommitsFromRealData()` - Generates commit list from real Git data
- `generateUsersFromRealData()` - Generates user list from real Git data
- `fetchMockBranches()` - Provides mock branch data
- `fetchMockCommits()` - Provides mock commit data
- `fetchMockUsers()` - Provides mock user data
- `fetchGitHubBranches()` - Fetches branches from GitHub API

### `hooks/useRepositoryData.ts`
Custom React hook that:
- Manages all repository data state
- Handles data fetching on mount and project changes
- Sets up real-time Git event listeners
- Checks GitHub connection status
- Provides loading, error, and data states to components

## Component Organization

### Local Tab (`local/`)
Components for displaying local repository data:

- **LocalRepositoryView** - Main container for local tab
- **LocalBranchList** - Displays local branches with current branch indicator
- **LocalActivityLog** - Terminal-style commit log
- **RecentActivity** - Recent commits with author and time
- **TeamStatus** - Team members working on the repository

### Remote Tab (`remote/`)
Components for displaying remote repository data:

- **RemoteRepositoryView** - Main container for remote tab
- **RemoteBranchVisualization** - ASCII-style branch tree with connections

### Shared Components (`shared/`)
Reusable components used across tabs:

- **StatusCard** - Generic status display card
- **CommitFrequencyChart** - ASCII bar chart for commit frequency
- **BackendStatus** - Connection status indicator

## Data Flow

1. **RepoVisualizationModal** opens
2. **useRepositoryData** hook initializes
3. Hook fetches data from:
   - Electron Git API (local repositories)
   - GitHub API (remote data)
   - Mock data (fallback)
4. Data is passed to view components
5. View components render using shared components
6. Real-time updates via Electron IPC events

## Benefits of This Structure

1. **Separation of Concerns** - Each file has a single, clear responsibility
2. **Reusability** - Shared components can be used across tabs
3. **Maintainability** - Easy to locate and modify specific functionality
4. **Testability** - Individual components and functions can be tested in isolation
5. **Scalability** - Easy to add new features or visualizations
6. **Type Safety** - Centralized type definitions ensure consistency

## Future Enhancements

Potential additions to this structure:

- `d3/` directory for D3.js visualizations
- `animations/` for complex animations
- `charts/` for additional chart types
- More granular data fetching hooks
- WebSocket integration for real-time updates

## Original File

The original monolithic file has been backed up as:
`RepoVisualizationModal.backup.tsx`
