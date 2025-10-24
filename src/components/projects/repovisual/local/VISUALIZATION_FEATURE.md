# Git Repository Visualization Feature

## Overview

The Git Repository Visualization feature provides an interactive D3.js-powered visualization of your complete Git repository history. It reads data directly from local `.git` directories, allowing you to explore branches, commits, merges, and contributors across multiple repositories without requiring remote access.

## Architecture

### Data Flow

```
Local .git Directory
    ↓
Git History Reader (Electron Backend)
    ↓
Complete Repository History (JSON)
    ↓
React Components + D3.js Visualizations
    ↓
Interactive Graphs & Charts
```

### Components

#### Backend (Electron)

1. **git-history-reader.js**
   - Reads complete commit history from `.git` directories
   - Extracts branches, commits, contributors, tags, and remotes
   - Provides caching for performance
   - Supports up to 1000 commits per repository

2. **git-monitoring-backend.js**
   - Manages IPC communication
   - Handles multiple repository connections
   - Provides real-time updates

#### Frontend (React + D3.js)

1. **CommitHistoryGraph.tsx**
   - Interactive force-directed graph showing commit relationships
   - Displays parent-child commit connections
   - Draggable nodes with detailed commit information
   - Click to view full commit details

2. **BranchTimeline.tsx**
   - Chronological timeline of commits
   - Shows commit progression over time
   - Hover tooltips with commit details
   - Time-based x-axis with commit count y-axis

3. **ContributorGraph.tsx**
   - Bar chart showing commits per contributor
   - Displays additions/deletions statistics
   - Interactive hover effects
   - Sorted by commit count

## Features

### Complete History Reading

The system reads:
- **All commits** (up to 1000 per repository)
- **All branches** (local and remote)
- **All contributors** with commit counts
- **All tags** with dates
- **Remote URLs** and configurations
- **Commit statistics** (additions, deletions, files changed)

### Interactive Visualizations

1. **Commit History Graph**
   - Force-directed layout showing commit relationships
   - Drag nodes to explore connections
   - Click nodes to see detailed information
   - Visual representation of merge commits

2. **Branch Timeline**
   - Time-based visualization of commits
   - See when commits were made
   - Identify active development periods
   - Smooth curve connecting commits

3. **Contributor Activity**
   - See who's contributing the most
   - View code change statistics
   - Identify key contributors
   - Compare team member activity

### Multi-Repository Support

- Connect multiple local folders
- Each folder is treated as an independent repository
- Aggregate data across all repositories
- Switch between repositories with tabs

## Usage

### Connecting a Repository

1. Navigate to a project in the application
2. Click "Add Local Folder" in the Local tab
3. Select a folder containing a `.git` directory
4. The system automatically reads the complete history

### Viewing Visualizations

1. Open the Repository Visualization modal
2. Select the "Local" tab
3. Choose a repository from the sub-tabs
4. Scroll down to see the three main visualizations:
   - Commit History Graph
   - Branch Timeline
   - Contributor Activity

### Interacting with Graphs

**Commit History Graph:**
- Drag nodes to rearrange the layout
- Click nodes to view commit details
- Hover over nodes to see commit messages
- The graph automatically positions related commits

**Branch Timeline:**
- Hover over commit points to see details
- View chronological progression
- Identify commit frequency patterns

**Contributor Graph:**
- Hover over bars to see detailed statistics
- Compare contributor activity
- View additions/deletions per contributor

## Technical Details

### Git Commands Used

The backend executes these Git commands:

```bash
# Read commits
git log --max-count=1000 --all --pretty=format:%H|%an|%ae|%aI|%s|%P --date-order

# Read branches
git branch -a -v --format=%(refname:short)|%(objectname)|%(upstream:short)|%(HEAD)

# Read contributors
git shortlog -sne --all

# Read commit stats
git show --stat --format= <commit-hash>

# Read remotes
git remote -v

# Read tags
git tag -l --format=%(refname:short)|%(objectname)|%(creatordate:iso8601)
```

### Data Structure

```typescript
interface GitHistory {
  repoPath: string
  commits: Commit[]
  branches: Branch[]
  remotes: Record<string, Remote>
  contributors: Contributor[]
  tags: Tag[]
  stats: {
    totalCommits: number
    totalBranches: number
    totalContributors: number
    totalTags: number
  }
  readAt: string
}
```

### Caching

- History is cached for 5 minutes
- Cache key includes repository path and options
- Automatic cache invalidation on updates
- Reduces Git command execution overhead

### Performance

- Reads up to 1000 commits per repository
- Parallel data fetching for multiple repositories
- D3.js force simulation for efficient rendering
- Optimized for repositories with hundreds of commits

## Configuration

### Options

When reading history, you can configure:

```typescript
{
  maxCommits: 1000,        // Maximum commits to read
  includeBranches: true,   // Include branch information
  includeRemotes: true,    // Include remote URLs
  includeStats: true       // Include commit statistics
}
```

### Customization

The visualizations can be customized by modifying:

- **Graph dimensions**: Update width/height in component props
- **Color schemes**: Modify D3 color scales
- **Force simulation**: Adjust force parameters
- **Tooltip content**: Customize hover information

## Troubleshooting

### No Commits Showing

1. Verify the folder contains a `.git` directory
2. Check that Git is installed and accessible
3. Ensure the repository has commits
4. Check browser console for errors

### Performance Issues

1. Reduce `maxCommits` option
2. Disable `includeStats` for faster reading
3. Clear cache and reload
4. Check repository size

### Visualization Not Rendering

1. Ensure D3.js is installed (`npm install d3`)
2. Check for JavaScript errors in console
3. Verify SVG elements are being created
4. Check component dimensions

## Future Enhancements

- [ ] Branch merge visualization
- [ ] Commit diff viewer
- [ ] File change heatmap
- [ ] Time-based filtering
- [ ] Export visualizations as images
- [ ] Compare multiple repositories
- [ ] Search commits by message/author
- [ ] Zoom and pan controls
- [ ] Custom color schemes
- [ ] Animation of commit history

## API Reference

### IPC Handlers

```javascript
// Read complete Git history
electronAPI.git.readCompleteHistory(repoPath, options)

// Read basic Git state
electronAPI.git.readDirectGitState(repoPath)

// Watch for Git changes
electronAPI.git.watchProject(projectId, true)
```

### React Hooks

```typescript
// Use repository data
const { commits, branches, loading } = useRepositoryData(isOpen, project)
```

### Data Fetchers

```typescript
// Read complete history
const history = await readCompleteGitHistory(localPath)

// Generate commits from history
const commits = await generateCommitsFromHistory(history)
```

## License

This feature is part of the Colabify application.
