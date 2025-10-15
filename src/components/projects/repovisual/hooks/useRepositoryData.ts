import { useState, useEffect, useMemo } from 'react'
import { GitHubBranch, GitHubCommit, LocalUserLocation, DataSource, GitHubDataSource } from '../types'
import { useUnifiedGitData } from '@/hooks/useUnifiedGitData'

/**
 * useRepositoryData - Simplified wrapper around useUnifiedGitData
 *
 * This hook now uses the unified git data system, eliminating redundant git scans.
 * All git data comes from a single source (database cache + background refresh).
 */
export function useRepositoryData(isOpen: boolean, project: any, activeTab?: string) {
  // ✅ USE UNIFIED GIT DATA HOOK - Single source of truth
  const {
    branches: unifiedBranches,
    commits: unifiedCommits,
    users: unifiedUsers,
    loading: unifiedLoading,
    usingCache,
    isRefreshing
  } = useUnifiedGitData({
    projectId: project?.id,
    autoRefresh: isOpen, // Only auto-refresh when modal is open
    refreshIntervalMs: 5000
  })

  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<DataSource>('mock')
  const [githubConnected, setGithubConnected] = useState<boolean>(false)
  const [githubDataSource, setGithubDataSource] = useState<GitHubDataSource>('disconnected')

  // Transform unified data to match expected GitHubBranch type
  const branches = useMemo<GitHubBranch[]>(() => {
    return unifiedBranches.map(branch => ({
      name: branch.name,
      commit: {
        sha: branch.head,
        author: {
          login: branch.user?.name || 'Unknown',
          avatar_url: branch.user?.avatar_url || ''
        },
        commit: {
          author: {
            name: branch.user?.name || 'Unknown',
            date: branch.lastChecked || new Date().toISOString()
          },
          message: 'Latest commit'
        }
      },
      protected: false,
      path: branch.path,
      branch: branch.branch,
      head: branch.head,
      dirty: branch.dirty,
      ahead: branch.ahead,
      behind: branch.behind,
      localBranches: branch.localBranches,
      remoteBranches: branch.remoteBranches,
      remoteUrls: branch.remoteUrls,
      lastChecked: branch.lastChecked,
      user: branch.user,
      id: `branch-${branch.path}`,
      history: branch.history,
      fromCache: branch.fromCache
    }))
  }, [unifiedBranches])

  // Transform unified commits to match expected GitHubCommit type
  const commits = useMemo<GitHubCommit[]>(() => {
    return unifiedCommits.map(commit => ({
      sha: commit.sha,
      commit: {
        message: commit.message,
        author: {
          name: commit.author.name,
          email: commit.author.email,
          date: commit.date
        }
      },
      author: {
        login: commit.author.name,
        avatar_url: ''
      },
      stats: commit.stats
    }))
  }, [unifiedCommits])

  // Transform unified users to match expected LocalUserLocation type
  const localUsers = useMemo<LocalUserLocation[]>(() => {
    return unifiedUsers.map(user => ({
      userId: user.userId,
      userName: user.userName,
      userEmail: user.userEmail,
      localPath: user.localPath,
      currentBranch: user.currentBranch,
      status: (user.status === 'active' ? 'online' : user.status === 'cached' ? 'away' : 'offline') as 'online' | 'away' | 'offline',
      commitsToday: user.commitsToday
    }))
  }, [unifiedUsers])

  // Update data source based on unified data state
  useEffect(() => {
    if (unifiedBranches.length > 0) {
      setDataSource(usingCache ? 'cached' as DataSource : 'backend')
    }
  }, [unifiedBranches, usingCache])

  // Check GitHub connection when switching to remote tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'remote') return

    const checkGitHubConnection = async () => {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          const hasToken = await (window as any).electronAPI.hasGitHubToken()
          setGithubConnected(hasToken)
          console.log('🔍 GitHub connection status:', hasToken ? 'Connected' : 'Disconnected')
        } catch (error) {
          console.log('⚠️ Could not check GitHub connection:', error)
          setGithubConnected(false)
        }
      }
    }

    checkGitHubConnection()
  }, [isOpen, activeTab])

  return {
    loading: unifiedLoading,
    branches,
    commits,
    localUsers,
    error,
    dataSource,
    githubConnected,
    githubDataSource,
    showingCachedData: usingCache,
    isBackgroundRefreshing: isRefreshing,
    fetchRepositoryData: () => {} // Deprecated - unified hook handles this automatically
  }
}
