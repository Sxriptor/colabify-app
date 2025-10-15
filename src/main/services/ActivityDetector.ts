// Repository state comparison and activity detection logic

import { RepoState, Activity, ActivityType } from '../../shared/types'
import { GitState } from './GitState'
import { GitExecutor } from '../util/gitExec'

export class ActivityDetector {
  /**
   * Compare two repository states and detect activities
   * @param prev Previous repository state
   * @param next Current repository state
   * @param projectId Project ID for the activity
   * @param repoId Repository ID for the activity
   * @param cwd Repository working directory (for additional checks)
   * @returns Array of detected activities
   */
  static async detectActivities(
    prev: RepoState | null,
    next: RepoState,
    projectId: string,
    repoId: string,
    cwd: string
  ): Promise<Activity[]> {
    const activities: Activity[] = []
    const timestamp = new Date().toISOString()

    // If no previous state, this is initial state - no activities to detect
    if (!prev) {
      return activities
    }

    // Detect branch switch
    const branchSwitch = ActivityDetector.detectBranchSwitch(prev, next)
    if (branchSwitch) {
      activities.push({
        projectId,
        repoId,
        type: 'BRANCH_SWITCH',
        details: branchSwitch,
        at: timestamp
      })
    }

    // Detect new local branches
    const newLocalBranches = ActivityDetector.detectNewLocalBranches(prev, next)
    for (const branchName of newLocalBranches) {
      activities.push({
        projectId,
        repoId,
        type: 'BRANCH_CREATED',
        details: { name: branchName, scope: 'local' },
        at: timestamp
      })
    }

    // Detect commits (only if on same branch and head changed)
    const commit = await ActivityDetector.detectCommit(prev, next, cwd)
    if (commit) {
      activities.push({
        projectId,
        repoId,
        type: 'COMMIT',
        details: commit,
        at: timestamp
      })
    }

    // Detect merge commits
    const merge = await ActivityDetector.detectMerge(prev, next, cwd)
    if (merge) {
      activities.push({
        projectId,
        repoId,
        type: 'MERGE',
        details: merge,
        at: timestamp
      })
    }

    // Detect worktree changes (only if no other activities detected)
    if (activities.length === 0) {
      const worktreeChange = ActivityDetector.detectWorktreeChange(prev, next)
      if (worktreeChange) {
        activities.push({
          projectId,
          repoId,
          type: 'WORKTREE_CHANGE',
          details: worktreeChange,
          at: timestamp
        })
      }
    }

    return activities
  }

  /**
   * Detect remote repository activities after fetch
   * @param prev Previous repository state (before fetch)
   * @param next Current repository state (after fetch)
   * @param projectId Project ID for the activity
   * @param repoId Repository ID for the activity
   * @param cwd Repository working directory
   * @returns Array of detected remote activities
   */
  static async detectRemoteActivities(
    prev: RepoState | null,
    next: RepoState,
    projectId: string,
    repoId: string,
    cwd: string
  ): Promise<Activity[]> {
    const activities: Activity[] = []
    const timestamp = new Date().toISOString()

    if (!prev) {
      return activities
    }

    // Detect new remote branches
    const newRemoteBranches = ActivityDetector.detectNewRemoteBranches(prev, next)
    for (const branchName of newRemoteBranches) {
      activities.push({
        projectId,
        repoId,
        type: 'BRANCH_CREATED',
        details: { name: branchName, scope: 'remote' },
        at: timestamp
      })
    }

    // Detect remote updates (ahead/behind changes)
    const remoteUpdate = ActivityDetector.detectRemoteUpdate(prev, next)
    if (remoteUpdate) {
      activities.push({
        projectId,
        repoId,
        type: 'REMOTE_UPDATE',
        details: remoteUpdate,
        at: timestamp
      })
    }

    // Detect push activity
    const push = await ActivityDetector.detectPush(cwd, next)
    if (push) {
      activities.push({
        projectId,
        repoId,
        type: 'PUSH',
        details: push,
        at: timestamp
      })
    }

    return activities
  }

  /**
   * Detect branch switch activity
   */
  private static detectBranchSwitch(prev: RepoState, next: RepoState): { from: string, to: string } | null {
    if (prev.branch !== next.branch) {
      return {
        from: prev.branch,
        to: next.branch
      }
    }
    return null
  }

  /**
   * Detect new local branches
   */
  private static detectNewLocalBranches(prev: RepoState, next: RepoState): string[] {
    const prevBranches = new Set(prev.localBranches)
    return next.localBranches.filter(branch => !prevBranches.has(branch))
  }

  /**
   * Detect new remote branches
   */
  private static detectNewRemoteBranches(prev: RepoState, next: RepoState): string[] {
    const prevBranches = new Set(prev.remoteBranches)
    return next.remoteBranches.filter(branch => !prevBranches.has(branch))
  }

  /**
   * Detect commit activity
   */
  private static async detectCommit(
    prev: RepoState, 
    next: RepoState, 
    cwd: string
  ): Promise<{ branch: string, head: string, author: string, subject: string } | null> {
    // Only detect commits if:
    // 1. We're on the same branch
    // 2. The HEAD changed
    // 3. It's not a merge commit (handled separately)
    if (prev.branch === next.branch && prev.head !== next.head) {
      try {
        const isMerge = await GitState.isMergeHead(cwd)
        if (!isMerge) {
          const commitMeta = await GitState.getLastCommitMeta(cwd)
          return {
            branch: next.branch,
            head: next.head,
            author: commitMeta.author,
            subject: commitMeta.subject
          }
        }
      } catch (error) {
        console.warn('Failed to get commit metadata:', error)
      }
    }
    return null
  }

  /**
   * Detect merge activity
   */
  private static async detectMerge(
    prev: RepoState, 
    next: RepoState, 
    cwd: string
  ): Promise<{ branch: string, head: string, parentsCount: number } | null> {
    // Detect merge if HEAD changed and current commit is a merge
    if (prev.head !== next.head) {
      try {
        const isMerge = await GitState.isMergeHead(cwd)
        if (isMerge) {
          // Get parent count for merge details
          const result = await GitExecutor.exec(['log', '-1', '--pretty=%P'], cwd)
          const parents = result.stdout.trim().split(' ').filter(p => p.length > 0)
          
          return {
            branch: next.branch,
            head: next.head,
            parentsCount: parents.length
          }
        }
      } catch (error) {
        console.warn('Failed to detect merge:', error)
      }
    }
    return null
  }

  /**
   * Detect worktree changes
   */
  private static detectWorktreeChange(prev: RepoState, next: RepoState): { summary: string } | null {
    if (prev.statusShort !== next.statusShort) {
      return {
        summary: next.statusShort || 'Working tree clean'
      }
    }
    return null
  }

  /**
   * Detect remote update activity
   */
  private static detectRemoteUpdate(
    prev: RepoState, 
    next: RepoState
  ): { branch: string, ahead: number, behind: number } | null {
    // Check if ahead/behind counts changed
    if (prev.ahead !== next.ahead || prev.behind !== next.behind) {
      return {
        branch: next.branch,
        ahead: next.ahead,
        behind: next.behind
      }
    }
    return null
  }

  /**
   * Detect push activity using reflog analysis
   */
  private static async detectPush(
    cwd: string, 
    currentState: RepoState
  ): Promise<{ branch: string, head: string } | null> {
    try {
      const hasPush = await GitState.detectRecentPush(cwd, 2)
      if (hasPush) {
        return {
          branch: currentState.branch,
          head: currentState.head
        }
      }
    } catch (error) {
      console.warn('Failed to detect push activity:', error)
    }
    return null
  }

  /**
   * Validate repository state data integrity
   * @param state Repository state to validate
   * @returns True if state is valid
   */
  static validateRepoState(state: RepoState): boolean {
    try {
      // Check required string fields
      if (typeof state.branch !== 'string' || 
          typeof state.head !== 'string' || 
          typeof state.statusShort !== 'string') {
        return false
      }

      // Check numeric fields
      if (typeof state.ahead !== 'number' || 
          typeof state.behind !== 'number' ||
          state.ahead < 0 || 
          state.behind < 0) {
        return false
      }

      // Check array fields
      if (!Array.isArray(state.localBranches) || 
          !Array.isArray(state.remoteBranches)) {
        return false
      }

      // Check that all branch names are strings
      if (state.localBranches.some(b => typeof b !== 'string') ||
          state.remoteBranches.some(b => typeof b !== 'string')) {
        return false
      }

      // Check upstream field (optional)
      if (state.upstream !== undefined && typeof state.upstream !== 'string') {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Create a deep copy of repository state
   * @param state Repository state to copy
   * @returns Deep copy of the state
   */
  static cloneRepoState(state: RepoState): RepoState {
    return {
      branch: state.branch,
      head: state.head,
      statusShort: state.statusShort,
      upstream: state.upstream,
      ahead: state.ahead,
      behind: state.behind,
      localBranches: [...state.localBranches],
      remoteBranches: [...state.remoteBranches]
    }
  }

  /**
   * Detect file changes from repository state
   * Returns list of changed files with their change types
   */
  static async detectFileChanges(
    cwd: string,
    currentState: RepoState
  ): Promise<Array<{ filePath: string, changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED', linesAdded: number, linesRemoved: number }>> {
    try {
      const fileChanges: Array<{ filePath: string, changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED', linesAdded: number, linesRemoved: number }> = []
      
      // Parse status output to get changed files
      if (!currentState.statusShort || currentState.statusShort.trim() === '') {
        return fileChanges
      }

      const statusLines = currentState.statusShort.split('\n').filter(line => line.trim())
      
      for (const line of statusLines) {
        if (line.length < 3) continue
        
        const status = line.substring(0, 2)
        const filePath = line.substring(3).trim()
        
        let changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED' = 'MODIFIED'
        
        // Determine change type from git status codes
        if (status.includes('A')) {
          changeType = 'ADDED'
        } else if (status.includes('D')) {
          changeType = 'DELETED'
        } else if (status.includes('R')) {
          changeType = 'RENAMED'
        } else if (status.includes('M') || status.includes('U')) {
          changeType = 'MODIFIED'
        }

        // Get diff stats for the file (if not deleted)
        let linesAdded = 0
        let linesRemoved = 0
        
        if (changeType !== 'DELETED') {
          try {
            const diffResult = await GitExecutor.exec(['diff', '--numstat', 'HEAD', '--', filePath], cwd)
            const diffLine = diffResult.stdout.trim()
            if (diffLine) {
              const parts = diffLine.split('\t')
              if (parts.length >= 2) {
                linesAdded = parseInt(parts[0]) || 0
                linesRemoved = parseInt(parts[1]) || 0
              }
            }
          } catch (diffError) {
            // File might be unstaged, try without HEAD
            try {
              const diffResult = await GitExecutor.exec(['diff', '--numstat', '--', filePath], cwd)
              const diffLine = diffResult.stdout.trim()
              if (diffLine) {
                const parts = diffLine.split('\t')
                if (parts.length >= 2) {
                  linesAdded = parseInt(parts[0]) || 0
                  linesRemoved = parseInt(parts[1]) || 0
                }
              }
            } catch {
              // Unable to get diff stats, use defaults
            }
          }
        }

        fileChanges.push({
          filePath,
          changeType,
          linesAdded,
          linesRemoved
        })
      }

      return fileChanges
    } catch (error) {
      console.error('Failed to detect file changes:', error)
      return []
    }
  }
}