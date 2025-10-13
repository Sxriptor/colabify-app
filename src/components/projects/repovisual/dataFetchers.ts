import { GitHubBranch, GitHubCommit, LocalUserLocation, GitHubDataSource } from './types'

export const readCompleteGitHistory = async (localPath: string) => {
  try {
    console.log(`📚 Reading complete Git history from: ${localPath}`)

    const electronAPI = (window as any).electronAPI
    if (electronAPI && electronAPI.git && electronAPI.git.readCompleteHistory) {
      const history = await electronAPI.git.readCompleteHistory(localPath, {
        maxCommits: 1000,
        includeBranches: true,
        includeRemotes: true,
        includeStats: true
      })
      
      console.log(`✅ Read complete history: ${history.commits.length} commits, ${history.branches.length} branches`)
      return history
    }

    console.warn(`⚠️ Complete history method not available, falling back to basic state`)
    return await readGitDataFromPath(localPath)

  } catch (error) {
    console.error(`❌ Error reading complete Git history from ${localPath}:`, error)
    return null
  }
}

export const readGitDataFromPath = async (localPath: string) => {
  try {
    console.log(`📂 Reading Git data directly from stored path: ${localPath}`)

    const electronAPI = (window as any).electronAPI
    if (electronAPI && electronAPI.git && electronAPI.git.readDirectGitState) {
      const repoState = await electronAPI.git.readDirectGitState(localPath)
      console.log(`📊 Direct Git state from ${localPath}:`, repoState)

      return {
        name: localPath.split('/').pop() || localPath.split('\\').pop() || 'Unknown',
        path: localPath,
        branch: repoState?.branch || 'main',
        head: repoState?.head || 'unknown',
        dirty: repoState?.dirty || false,
        ahead: repoState?.ahead || 0,
        behind: repoState?.behind || 0,
        localBranches: repoState?.localBranches || ['main'],
        remoteBranches: repoState?.remoteBranches || [],
        remoteUrls: repoState?.remoteUrls || {},
        lastChecked: repoState?.lastChecked || new Date().toISOString(),
        commit: {
          sha: repoState?.head || 'unknown',
          author: {
            login: 'local-user',
            avatar_url: '/default-avatar.png'
          },
          commit: {
            author: {
              name: 'Local Developer',
              date: repoState?.lastChecked || new Date().toISOString()
            },
            message: `Latest commit on ${repoState?.branch || 'main'}`
          }
        }
      }
    }

    console.warn(`⚠️ Direct Git state method not available for ${localPath}`)
    return null

  } catch (error) {
    console.error(`❌ Error reading Git data from ${localPath}:`, error)
    return null
  }
}

export const generateCommitsFromHistory = async (history: any) => {
  if (!history || !history.commits) {
    return []
  }

  const commits: GitHubCommit[] = history.commits.map((commit: any) => ({
    sha: commit.sha,
    commit: {
      author: {
        name: commit.author.name,
        email: commit.author.email,
        date: commit.date
      },
      message: commit.message
    },
    author: {
      login: commit.author.name.toLowerCase().replace(/\s+/g, ''),
      avatar_url: `/default-avatar.png`
    },
    stats: commit.stats || {
      additions: 0,
      deletions: 0
    }
  }))

  return commits
}

export const generateCommitsFromRealData = async (repositories: any[]) => {
  const commits: GitHubCommit[] = []

  for (const repo of repositories) {
    commits.push({
      sha: repo.head || 'unknown',
      commit: {
        author: {
          name: repo.user?.name || 'Local Developer',
          email: repo.user?.email || 'developer@local.dev',
          date: repo.lastChecked || new Date().toISOString()
        },
        message: `Latest commit on ${repo.branch || 'main'} branch`
      },
      author: {
        login: repo.user?.name?.toLowerCase().replace(/\s+/g, '') || 'localdev',
        avatar_url: repo.user?.avatar_url || '/default-avatar.png'
      },
      stats: {
        additions: 0,
        deletions: 0
      }
    })

    if (repo.localBranches) {
      repo.localBranches.slice(0, 3).forEach((branchName: string, index: number) => {
        if (branchName !== repo.branch) {
          commits.push({
            sha: `${repo.head?.substring(0, 8) || 'abc123'}${index}`,
            commit: {
              author: {
                name: repo.user?.name || 'Local Developer',
                email: repo.user?.email || 'developer@local.dev',
                date: new Date(Date.now() - (index + 1) * 3600000).toISOString()
              },
              message: `Work on ${branchName} branch`
            },
            author: {
              login: repo.user?.name?.toLowerCase().replace(/\s+/g, '') || 'localdev',
              avatar_url: repo.user?.avatar_url || '/default-avatar.png'
            },
            stats: {
              additions: Math.floor(Math.random() * 50) + 5,
              deletions: Math.floor(Math.random() * 20)
            }
          })
        }
      })
    }
  }

  return commits.slice(0, 6)
}

export const generateUsersFromRealData = async (repositories: any[]) => {
  const users: LocalUserLocation[] = []

  for (const repo of repositories) {
    users.push({
      userId: repo.user?.id || `user-${repo.id}`,
      userName: repo.user?.name?.toUpperCase() || 'LOCAL.DEVELOPER',
      userEmail: repo.user?.email || 'developer@local.dev',
      localPath: repo.path,
      currentBranch: repo.branch || 'main',
      lastActivity: repo.lastChecked || new Date().toISOString(),
      status: 'online' as const,
      commitsToday: repo.ahead || 1
    })
  }

  return users
}

export const fetchMockBranches = async (setBranches: (branches: GitHubBranch[]) => void) => {
  const mockBranches: GitHubBranch[] = [
    {
      name: 'main',
      commit: {
        sha: 'abc123def456',
        author: { login: 'johndoe', avatar_url: '/default-avatar.png' },
        commit: {
          author: { name: 'John Doe', date: new Date().toISOString() },
          message: 'Add new feature implementation'
        }
      },
      protected: true,
      isDefault: true,
      aheadBy: 0,
      behindBy: 0
    }
  ]
  setBranches(mockBranches)
}

export const fetchMockCommits = async (setCommits: (commits: GitHubCommit[]) => void) => {
  const mockCommits: GitHubCommit[] = [
    {
      sha: 'abc123def456',
      commit: {
        author: { name: 'John Doe', email: 'john@example.com', date: new Date().toISOString() },
        message: 'Add new feature implementation'
      },
      author: { login: 'johndoe', avatar_url: '/default-avatar.png' },
      stats: { additions: 127, deletions: 23 }
    }
  ]
  setCommits(mockCommits)
}

export const fetchMockUsers = async (setLocalUsers: (users: LocalUserLocation[]) => void) => {
  const mockUsers: LocalUserLocation[] = [
    {
      userId: 'user-1',
      userName: 'JOHN.DOE',
      userEmail: 'john@company.com',
      localPath: '/Users/john/workspace/project',
      currentBranch: 'main',
      lastActivity: new Date(Date.now() - 3600000).toISOString(),
      status: 'online',
      commitsToday: 3
    }
  ]
  setLocalUsers(mockUsers)
}

export const fetchGitHubBranches = async (
  owner: string, 
  repo: string, 
  setGithubDataSource: (source: GitHubDataSource) => void,
  setError: (error: string | null) => void
) => {
  try {
    const electronAPI = (window as any).electronAPI
    let githubToken = null

    if (electronAPI && electronAPI.getGitHubToken) {
      try {
        githubToken = await electronAPI.getGitHubToken()
        console.log('🔑 GitHub token available:', !!githubToken)
      } catch (tokenError) {
        console.log('⚠️ Could not get GitHub token:', tokenError)
      }
    }

    try {
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json'
      }

      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`
        console.log('🔐 Using authenticated GitHub API request')
      } else {
        console.log('📖 Using unauthenticated GitHub API request (rate limited)')
      }

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers })

      if (response.ok) {
        setGithubDataSource('connected')
        console.log('✅ Fetched branches from GitHub API')
        return
      } else {
        console.log(`⚠️ GitHub API returned ${response.status}: ${response.statusText}`)
        setGithubDataSource('disconnected')
        if (response.status === 401) {
          setError('GitHub token invalid or expired. Please sign in again.')
        } else if (response.status === 403) {
          setError('GitHub API rate limit exceeded. Please sign in to increase limits.')
        } else if (response.status === 404) {
          setError(`Repository ${owner}/${repo} not found or not accessible. Check if the repository exists and you have access.`)
        } else {
          setError(`GitHub API error: ${response.status} ${response.statusText}`)
        }
      }
    } catch (apiError) {
      console.log('❌ GitHub API error:', apiError)
      setGithubDataSource('disconnected')
    }
  } catch (error) {
    console.error('Error fetching branches:', error)
  }
}
