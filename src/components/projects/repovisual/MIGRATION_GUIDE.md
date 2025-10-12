# Migration Guide - RepoVisualizationModal Refactoring

## Overview

This guide helps you understand what changed and where to find things in the new structure.

## Quick Reference: Where Did Everything Go?

### Types & Interfaces

**Before:** Defined at the top of `RepoVisualizationModal.tsx`
```typescript
interface GitHubBranch { ... }
interface GitHubCommit { ... }
interface LocalUserLocation { ... }
```

**After:** In `repovisual/types.ts`
```typescript
import { GitHubBranch, GitHubCommit, LocalUserLocation } from './repovisual/types'
```

---

### Utility Functions

**Before:** Inside the component
```typescript
const formatTimeAgo = (dateString: string) => { ... }
const getLocalRepositoryInfo = (repoConfig: any) => { ... }
const getRemoteRepositoryInfo = (repoConfig: any) => { ... }
```

**After:** In `repovisual/utils.ts`
```typescript
import { formatTimeAgo, getLocalRepositoryInfo, getRemoteRepositoryInfo } from './repovisual/utils'
```

---

### Data Fetching Functions

**Before:** Inside the component
```typescript
const fetchRepositoryData = async () => { ... }
const readGitDataFromPath = async (localPath: string) => { ... }
const fetchGitHubBranches = async (owner: string, repo: string) => { ... }
const fetchMockBranches = async () => { ... }
```

**After:** In `repovisual/dataFetchers.ts` and `repovisual/hooks/useRepositoryData.ts`
```typescript
// Hook handles the main fetching logic
import { useRepositoryData } from './repovisual/hooks/useRepositoryData'

// Individual fetchers are in dataFetchers.ts
import * as dataFetchers from './repovisual/dataFetchers'
```

---

### State Management

**Before:** useState hooks in the component
```typescript
const [branches, setBranches] = useState<GitHubBranch[]>([])
const [commits, setCommits] = useState<GitHubCommit[]>([])
const [loading, setLoading] = useState(false)
```

**After:** Custom hook `useRepositoryData`
```typescript
const {
  branches,
  commits,
  localUsers,
  loading,
  error,
  dataSource
} = useRepositoryData(isOpen, project)
```

---

### UI Components

#### Local Tab Content

**Before:** All JSX in one massive return statement
```typescript
{activeTab === 'local' && (
  <div>
    {/* 500+ lines of JSX */}
  </div>
)}
```

**After:** Organized components
```typescript
{activeTab === 'local' && (
  <LocalRepositoryView
    branches={branches}
    commits={commits}
    localUsers={localUsers}
    activeLocalRepo={activeLocalRepo}
    dataSource={dataSource}
    project={project}
  />
)}
```

Components:
- `LocalRepositoryView.tsx` - Main container
- `LocalBranchList.tsx` - Branch list
- `LocalActivityLog.tsx` - Activity log
- `RecentActivity.tsx` - Recent commits
- `TeamStatus.tsx` - Team status

#### Remote Tab Content

**Before:** All JSX in one return statement
```typescript
{activeTab === 'remote' && (
  <div>
    {/* 300+ lines of JSX */}
  </div>
)}
```

**After:** Organized components
```typescript
{activeTab === 'remote' && (
  <RemoteRepositoryView
    branches={branches}
    project={project}
  />
)}
```

Components:
- `RemoteRepositoryView.tsx` - Main container
- `RemoteBranchVisualization.tsx` - Branch tree

#### Shared Components

**Before:** Repeated JSX patterns
```typescript
<div className="border border-gray-800 p-4">
  <div className="text-gray-400 font-mono text-xs mb-2">{label}</div>
  <div className="text-white font-mono text-lg font-bold">{value}</div>
</div>
```

**After:** Reusable components
```typescript
<StatusCard label="CURRENT.BRANCH" value="main" subtext="abc123" />
```

Components:
- `StatusCard.tsx` - Status display card
- `CommitFrequencyChart.tsx` - Commit frequency chart
- `BackendStatus.tsx` - Backend connection status

---

## Finding Specific Features

### "Where is the branch list rendering?"

**Location:** `repovisual/local/LocalBranchList.tsx`

### "Where is the GitHub API call?"

**Location:** `repovisual/dataFetchers.ts` → `fetchGitHubBranches()`

### "Where is the real-time Git event listener?"

**Location:** `repovisual/hooks/useRepositoryData.ts` → `useEffect` with `electronAPI.git.onEvent()`

### "Where is the commit frequency chart?"

**Location:** `repovisual/shared/CommitFrequencyChart.tsx`

### "Where is the team status display?"

**Location:** `repovisual/local/TeamStatus.tsx`

### "Where is the ASCII branch visualization?"

**Location:** `repovisual/remote/RemoteBranchVisualization.tsx`

---

## Making Changes

### Adding a New Status Card

**Before:** Add JSX to the massive component
```typescript
// Somewhere in the 1,864 lines...
<div className="border border-gray-800 p-4">
  {/* New status card */}
</div>
```

**After:** Use the StatusCard component
```typescript
// In LocalRepositoryView.tsx or any component
<StatusCard
  label="NEW.STATUS"
  value="Value"
  subtext="Additional info"
/>
```

### Adding a New Data Source

**Before:** Add logic to `fetchRepositoryData()`
```typescript
const fetchRepositoryData = async () => {
  // Add 50+ lines of new logic
}
```

**After:** Add function to `dataFetchers.ts`
```typescript
// In dataFetchers.ts
export const fetchNewDataSource = async () => {
  // Your logic here
}

// In useRepositoryData.ts
const newData = await dataFetchers.fetchNewDataSource()
```

### Adding a New Visualization

**Before:** Add JSX to the component
```typescript
// Somewhere in the massive return statement
<div>
  {/* 100+ lines of visualization code */}
</div>
```

**After:** Create new component
```typescript
// Create: repovisual/local/NewVisualization.tsx
export function NewVisualization({ data }) {
  return (
    <div>
      {/* Your visualization */}
    </div>
  )
}

// Use in LocalRepositoryView.tsx
<NewVisualization data={someData} />
```

---

## Import Changes

### If you were importing the modal:

**Before:**
```typescript
import { RepoVisualizationModal } from '@/components/projects/RepoVisualizationModal'
```

**After:** (Same - no change needed!)
```typescript
import { RepoVisualizationModal } from '@/components/projects/RepoVisualizationModal'
```

### If you need types:

**Before:** Types were not exported
```typescript
// Had to duplicate type definitions
```

**After:** Import from types file
```typescript
import { GitHubBranch, GitHubCommit, LocalUserLocation } from '@/components/projects/repovisual/types'
```

---

## Testing Changes

### Before: Hard to test

- One massive component
- Tightly coupled logic
- Difficult to mock data
- Hard to isolate features

### After: Easy to test

```typescript
// Test individual components
import { StatusCard } from './shared/StatusCard'
test('renders status card', () => {
  render(<StatusCard label="TEST" value="123" />)
  expect(screen.getByText('TEST')).toBeInTheDocument()
})

// Test utility functions
import { formatTimeAgo } from './utils'
test('formats time correctly', () => {
  expect(formatTimeAgo(someDate)).toBe('2h ago')
})

// Test data fetchers with mocks
import * as dataFetchers from './dataFetchers'
jest.mock('./dataFetchers')
```

---

## Rollback Plan

If you need to revert to the original:

1. The original file is backed up as `RepoVisualizationModal.backup.tsx`
2. Simply rename it back:
   ```bash
   mv RepoVisualizationModal.backup.tsx RepoVisualizationModal.tsx
   ```
3. Delete the `repovisual/` directory if desired

---

## Benefits Summary

✅ **Easier to Navigate** - Find features by file name
✅ **Easier to Modify** - Change one component without affecting others
✅ **Easier to Test** - Test individual pieces in isolation
✅ **Easier to Reuse** - Shared components can be used elsewhere
✅ **Easier to Collaborate** - Multiple developers can work on different files
✅ **Easier to Understand** - Clear structure and responsibilities

---

## Questions?

Check these files for more information:
- `README.md` - Overview of the structure
- `ARCHITECTURE.md` - Detailed architecture diagrams
- `REFACTORING_SUMMARY.md` - What was changed and why
