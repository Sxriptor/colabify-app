# Stable Props Fix - Prevent D3.js Rebuilds

## Problem
Even with component memoization, the D3.js visualizations were still rebuilding every 5 seconds because:
1. **New object references** were created in the hook on every state update
2. **Array/object props** were different references even with identical data
3. **Component memoization** couldn't prevent re-renders due to changing prop references
4. **Expensive D3.js operations** were triggered unnecessarily

## Root Cause
The issue was at the **data source level** - the `useRepositoryData` hook was creating new arrays and objects every time, even when the actual data content was identical. This meant that even with perfect component memoization, the props were still "different" from React's perspective.

## Solution: Stable Props at the Hook Level

### 1. Memoized Data in Hook
Instead of trying to compare data in each component, we now create **stable references** in the hook itself using `useMemo` with content-based dependencies.

```typescript
// Before: New arrays/objects every time
return {
  branches,      // New array reference every time
  commits,       // New array reference every time
  localUsers     // New array reference every time
}

// After: Stable references that only change when content changes
const stableBranches = useMemo(() => branches, [JSON.stringify(branches.map(...))])
const stableCommits = useMemo(() => commits, [JSON.stringify(commits.map(...))])
const stableLocalUsers = useMemo(() => localUsers, [JSON.stringify(localUsers.map(...))])

return {
  branches: stableBranches,
  commits: stableCommits,
  localUsers: stableLocalUsers
}
```

### 2. Content-Based Memoization
- **JSON.stringify** of essential fields creates stable dependency
- **Only essential data** included in comparison (no timestamps, volatile fields)
- **Same content = same reference** across re-renders

### 3. Simplified Component Memoization
- **Removed complex comparison functions** from components
- **Simple `React.memo`** is now sufficient since props are stable
- **Cleaner, more maintainable code**

## Implementation Details

### Hook-Level Stable Props
```typescript
const stableBranches = useMemo(() => branches, [JSON.stringify(branches.map(b => ({
  name: b.name,
  head: b.head,
  branch: b.branch,
  dirty: b.dirty,
  ahead: b.ahead,
  behind: b.behind,
  localBranches: b.localBranches,
  remoteBranches: b.remoteBranches,
  path: b.path
  // Excludes lastChecked and other volatile fields
})))])
```

### Component-Level Simplification
```typescript
// Before: Complex custom comparison
export const CommitBubbles = memo(Component, customComparisonFunction)

// After: Simple memo (props are already stable)
export const CommitBubbles = memo(Component)
```

## Performance Benefits

### Before Fix
- ❌ New prop references every 5 seconds
- ❌ D3.js SVG recreation on identical data
- ❌ Expensive useEffect re-runs
- ❌ Visual flickering and performance issues

### After Fix
- ✅ **Stable prop references** when data is identical
- ✅ **D3.js operations skipped** when no real changes
- ✅ **useEffect dependencies stable** - no unnecessary re-runs
- ✅ **Zero visual updates** when data hasn't changed

## Expected Behavior

### When No Data Changes
- ✅ Hook returns **exact same object references**
- ✅ Components receive **identical props**
- ✅ **No re-renders** triggered
- ✅ **No D3.js operations** executed
- ✅ **Completely stable** visualizations

### When Data Actually Changes
- ✅ Hook detects content change via JSON comparison
- ✅ **New stable references** created for changed data
- ✅ Components re-render **only when necessary**
- ✅ D3.js visualizations update smoothly

## Technical Approach

### Content-Based Dependencies
Instead of depending on object references, we depend on **serialized content**:
```typescript
// Dependency changes only when actual content changes
[JSON.stringify(commits.map(c => ({
  sha: c.sha,
  message: c.commit?.message,
  author: c.commit?.author?.name,
  // ... only stable, essential fields
})))]
```

### Excluded Volatile Fields
- **Timestamps** (lastChecked, generated dates)
- **Object references** (nested objects that might change)
- **Computed values** that might vary between reads

## Files Modified
- `src/components/projects/repovisual/hooks/useRepositoryData.ts` - Added stable memoization
- `src/components/projects/repovisual/local/CommitBubbles.tsx` - Simplified memoization
- `src/components/projects/repovisual/local/BranchTimeline.tsx` - Simplified memoization
- `src/components/projects/repovisual/local/ContributorGraph.tsx` - Simplified memoization

## Result
The D3.js visualizations should now be **completely stable** and only rebuild when there are actual changes to the underlying Git data, eliminating the constant 5-second refresh cycles.