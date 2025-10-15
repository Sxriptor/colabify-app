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
    autoRefresh: isOpen && activeTab === 'local', // Only auto-refresh when modal is open and on local tab
    refreshIntervalMs: 5000
  })

  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<DataSource>('mock')
  const [githubConnected, setGithubConnected] = useState<boolean>(false)
  const [githubDataSource, setGithubDataSource] = useState<GitHubDataSource>('disconnected')

  // Remote data state
  const [remoteBranches, setRemoteBranches] = useState<GitHubBranch[]>([])
  const [remoteCommits, setRemoteCommits] = useState<GitHubCommit[]>([])
  const [remoteLoading, setRemoteLoading] = useState(false)

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

  // Fetch remote data from GitHub API when switching to remote tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'remote') return

    const fetchRemoteData = async () => {
      // Get repository URL from project
      const repoUrl = project?.repositories?.[0]?.url
      if (!repoUrl) {
        console.log('⚠️ No repository URL found')
        setError('No repository URL configured')
        return
      }

      // Parse owner and repo from URL
      // Supports: https://github.com/owner/repo or https://github.com/owner/repo.git
      let owner = ''
      let repo = ''
      try {
        const urlParts = repoUrl
          .replace('https://github.com/', '')
          .replace('http://github.com/', '')
          .replace('.git', '')
          .split('/')

        if (urlParts.length >= 2) {
          owner = urlParts[0]
          repo = urlParts[1]
        } else {
          throw new Error('Invalid GitHub URL format')
        }
      } catch (parseError) {
        console.error('❌ Failed to parse repository URL:', repoUrl)
        setError('Invalid repository URL format')
        return
      }

      console.log(`🌐 Fetching remote data for ${owner}/${repo}`)
      setRemoteLoading(true)
      setError(null)

      try {
        const electronAPI = (window as any).electronAPI
        let githubToken = null

        // Get GitHub token
        if (electronAPI && electronAPI.getGitHubToken) {
          try {
            githubToken = await electronAPI.getGitHubToken()
            console.log('🔑 GitHub token available:', !!githubToken)
            setGithubConnected(!!githubToken)
          } catch (tokenError) {
            console.log('⚠️ Could not get GitHub token:', tokenError)
            setGithubConnected(false)
          }
        }

        const headers: HeadersInit = {
          'Accept': 'application/vnd.github.v3+json'
        }

        if (githubToken) {
          headers['Authorization'] = `Bearer ${githubToken}`
          console.log('🔐 Using authenticated GitHub API request')
        } else {
          console.log('📖 Using unauthenticated GitHub API request (rate limited)')
        }

        // Fetch branches
        const branchesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers })

        if (!branchesResponse.ok) {
          setGithubDataSource('disconnected')
          if (branchesResponse.status === 401) {
            throw new Error('GitHub token invalid or expired. Please sign in again.')
          } else if (branchesResponse.status === 403) {
            throw new Error('GitHub API rate limit exceeded. Please sign in to increase limits.')
          } else if (branchesResponse.status === 404) {
            throw new Error(`Repository ${owner}/${repo} not found or not accessible.`)
          } else {
            throw new Error(`GitHub API error: ${branchesResponse.status} ${branchesResponse.statusText}`)
          }
        }

        const branchesData = await branchesResponse.json()
        setGithubDataSource('connected')

        // Transform branch data
        const formattedBranches: GitHubBranch[] = branchesData.map((branch: any) => ({
          name: branch.name,
          commit: {
            sha: branch.commit.sha,
            author: {
              login: branch.commit.author?.login || branch.commit.commit?.author?.name || 'Unknown',
              avatar_url: branch.commit.author?.avatar_url || ''
            },
            commit: {
              author: {
                name: branch.commit.commit?.author?.name || 'Unknown',
                date: branch.commit.commit?.author?.date || new Date().toISOString()
              },
              message: branch.commit.commit?.message || 'No commit message'
            }
          },
          protected: branch.protected || false
        }))

        setRemoteBranches(formattedBranches)

        // Fetch commits
        const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=50`, { headers })

        if (commitsResponse.ok) {
          const commitsData = await commitsResponse.json()

          // Transform commit data
          const formattedCommits: GitHubCommit[] = commitsData.map((commit: any) => ({
            sha: commit.sha,
            commit: {
              author: commit.commit.author,
              message: commit.commit.message
            },
            author: commit.author,
            stats: {
              additions: 0,
              deletions: 0
            }
          }))

          setRemoteCommits(formattedCommits)
        }

        console.log('✅ Remote data fetched successfully')
        setDataSource('github')
      } catch (error) {
        console.error('❌ Error fetching remote data:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch remote data')
        setGithubDataSource('disconnected')
      } finally {
        setRemoteLoading(false)
      }
    }

    fetchRemoteData()
  }, [isOpen, activeTab, project])

  return {
    loading: activeTab === 'remote' ? remoteLoading : unifiedLoading,
    branches: activeTab === 'remote' ? remoteBranches : branches,
    commits: activeTab === 'remote' ? remoteCommits : commits,
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
