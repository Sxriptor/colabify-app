# Repository Visualization Architecture

## Component Hierarchy

```
RepoVisualizationModal (Main Container)
│
├── Header
│   ├── Title & Project Info
│   └── Close Button
│
├── Tab Navigation
│   ├── Local Repositories Tab
│   └── Remote Data Tab
│
├── Sub-Tab Navigation (Local only)
│   └── Multiple Local Repository Tabs
│
└── Content Area
    │
    ├── Local Tab Content
    │   └── LocalRepositoryView
    │       ├── Repository Header (owner, name, path)
    │       ├── Status Cards (3 columns)
    │       │   ├── Current Branch
    │       │   ├── Working Directory
    │       │   └── Sync Status
    │       ├── LocalBranchList
    │       ├── RecentActivity
    │       ├── BackendStatus
    │       ├── CommitFrequencyChart
    │       └── Grid Layout (2 columns)
    │           ├── LocalActivityLog
    │           └── TeamStatus
    │
    └── Remote Tab Content
        └── RemoteRepositoryView
            ├── Repository Info Header
            ├── RemoteBranchVisualization
            └── Legend
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  RepoVisualizationModal                      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         useRepositoryData Hook                         │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         Data Sources                             │ │ │
│  │  │                                                   │ │ │
│  │  │  1. Electron Git API (Local Repos)              │ │ │
│  │  │     └─> readGitDataFromPath()                   │ │ │
│  │  │                                                   │ │ │
│  │  │  2. GitHub API (Remote Data)                    │ │ │
│  │  │     └─> fetchGitHubBranches()                   │ │ │
│  │  │                                                   │ │ │
│  │  │  3. Mock Data (Fallback)                        │ │ │
│  │  │     ├─> fetchMockBranches()                     │ │ │
│  │  │     ├─> fetchMockCommits()                      │ │ │
│  │  │     └─> fetchMockUsers()                        │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  State:                                                 │ │
│  │  ├─ branches: GitHubBranch[]                           │ │
│  │  ├─ commits: GitHubCommit[]                            │ │
│  │  ├─ localUsers: LocalUserLocation[]                    │ │
│  │  ├─ loading: boolean                                   │ │
│  │  ├─ error: string | null                               │ │
│  │  └─ dataSource: 'backend' | 'github' | 'mock'         │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              View Components                           │ │
│  │                                                         │ │
│  │  LocalRepositoryView  ◄──┐                            │ │
│  │  RemoteRepositoryView ◄──┤  Props: branches, commits, │ │
│  │                           │         users, dataSource  │ │
│  └───────────────────────────┴────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## File Responsibilities

### Core Files

**types.ts**
- Defines all TypeScript interfaces
- Exports type unions for state management
- Single source of truth for data structures

**utils.ts**
- Pure utility functions
- No side effects
- Reusable across components
- Examples: formatTimeAgo, getRepoInfo

**dataFetchers.ts**
- All data fetching logic
- Electron IPC communication
- GitHub API calls
- Mock data generation
- Data transformation

### State Management

**hooks/useRepositoryData.ts**
- Custom React hook
- Manages all repository data state
- Handles data fetching lifecycle
- Sets up real-time event listeners
- Provides clean API to components

### UI Components

**Local Tab Components** (`local/`)
- Each component handles one specific UI concern
- Receives data via props
- No direct data fetching
- Focused, single-responsibility components

**Remote Tab Components** (`remote/`)
- Similar structure to local components
- Displays remote repository data
- ASCII-style visualizations

**Shared Components** (`shared/`)
- Reusable across tabs
- Generic, configurable components
- No tab-specific logic

## Design Principles

1. **Single Responsibility** - Each file/component has one clear purpose
2. **Separation of Concerns** - UI, logic, and data are separated
3. **Composition** - Complex UIs built from simple components
4. **Reusability** - Shared components reduce duplication
5. **Type Safety** - TypeScript ensures data consistency
6. **Testability** - Pure functions and isolated components
7. **Maintainability** - Easy to locate and modify features

## Import Strategy

```typescript
// Main Modal
import { useRepositoryData } from './repovisual/hooks/useRepositoryData'
import { LocalRepositoryView } from './repovisual/local/LocalRepositoryView'
import { RemoteRepositoryView } from './repovisual/remote/RemoteRepositoryView'
import { ActiveTab } from './repovisual/types'

// View Components
import { StatusCard } from '../shared/StatusCard'
import { LocalBranchList } from './LocalBranchList'
import { getLocalRepositoryInfo } from '../utils'
import { GitHubBranch } from '../types'

// Hook
import * as dataFetchers from '../dataFetchers.js'
import { GitHubBranch, DataSource } from '../types'
```

## Real-Time Updates

```
Electron Main Process
        │
        │ Git Events (commit, branch change, etc.)
        │
        ▼
Electron IPC Channel
        │
        │ electronAPI.git.onEvent()
        │
        ▼
useRepositoryData Hook
        │
        │ Triggers fetchRepositoryData()
        │
        ▼
Components Re-render
```

## Future Extensibility

Easy to add:
- New visualization types (add to `local/` or `remote/`)
- New data sources (add to `dataFetchers.ts`)
- New shared components (add to `shared/`)
- D3.js visualizations (create `d3/` directory)
- WebSocket integration (modify `useRepositoryData`)
- Additional tabs (add new view components)

## Testing Strategy

Each layer can be tested independently:

1. **Utils** - Unit test pure functions
2. **Data Fetchers** - Mock Electron API, test data transformation
3. **Hook** - Test state management with React Testing Library
4. **Components** - Test rendering with mock data
5. **Integration** - Test full flow with Electron in test mode
