'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'

interface RepoVisualizationModalProps {
  isOpen: boolean
  onClose: () => void
  project: any
}

interface GitHubBranch {
  name: string
  commit: {
    sha: string
    author: {
      login: string
      avatar_url: string
    }
    commit: {
      author: {
        name: string
        date: string
      }
      message: string
    }
  }
  protected: boolean
  aheadBy?: number
  behindBy?: number
  isDefault?: boolean
}

interface GitHubCommit {
  sha: string
  commit: {
    author: {
      name: string
      email: string
      date: string
    }
    message: string
  }
  author: {
    login: string
    avatar_url: string
  }
  stats?: {
    additions: number
    deletions: number
  }
}

interface LocalUserLocation {
  userId: string
  userName: string
  userEmail: string
  localPath: string
  currentBranch?: string
  lastActivity?: string
  status: 'online' | 'away' | 'offline'
  commitsToday?: number
}

interface BranchNode {
  id: string
  name: string
  x: number
  y: number
  color: string
  isDefault?: boolean
  protected?: boolean
  commits: GitHubCommit[]
  connections: string[]
}

export function RepoVisualizationModal({ isOpen, onClose, project }: RepoVisualizationModalProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'remote' | 'local'>('local')
  const [activeLocalRepo, setActiveLocalRepo] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [commits, setCommits] = useState<GitHubCommit[]>([])
  const [localUsers, setLocalUsers] = useState<LocalUserLocation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<'backend' | 'github' | 'mock'>('mock')

  useEffect(() => {
    if (isOpen && project?.repositories?.length > 0) {
      fetchRepositoryData()

      // Set up real-time Git event listener
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const electronAPI = (window as any).electronAPI

        const handleGitEvent = (event: any) => {
          console.log('📡 Received Git event in visualization:', event)

          if (event.projectId === project.id) {
            // Refresh data when Git activities occur
            fetchRepositoryData()
          }
        }

        // Listen for Git events
        if (electronAPI.git) {
          electronAPI.git.onEvent(handleGitEvent)
        }

        // Cleanup listener on unmount
        return () => {
          if (electronAPI.git) {
            electronAPI.git.removeEventListeners()
          }
        }
      }
    }
  }, [isOpen, project])

  const fetchRepositoryData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Check if we're in Electron environment
      if (typeof window === 'undefined' || !(window as any).electronAPI) {
        console.log('🔍 Not in Electron environment, using mock data')
        await fetchMockBranches()
        await fetchMockCommits()
        await fetchMockUsers()
        setDataSource('mock')
        return
      }

      const electronAPI = (window as any).electronAPI

      // Get local repository mappings from project data - NO SEARCHING NEEDED
      const localMappings = project.repositories?.[0]?.local_mappings || []
      console.log('� Usijng stored local repository mappings:', localMappings)

      if (localMappings.length === 0) {
        console.log('⚠️ No local repository mappings found, using mock data')
        await fetchMockBranches()
        await fetchMockCommits()
        await fetchMockUsers()
        setDataSource('mock')
        return
      }

      // Check if Git API is available
      if (!electronAPI.git) {
        console.log('❌ Git API not available, using mock data with stored paths')
        await fetchMockBranches()
        await fetchMockCommits()
        await fetchMockUsers()
        setDataSource('mock')
        return
      }

      console.log(`📂 Processing ${localMappings.length} stored repository mappings`)

      // Fetch real Git data for each stored local repository path
      const allBranches: any[] = []

      for (const mapping of localMappings) {
        try {
          console.log(`📂 Reading Git data from stored path: ${mapping.local_path}`)

          // Read Git data directly from the stored path - NO SEARCHING
          const gitData = await readGitDataFromPath(mapping.local_path)

          if (gitData) {
            allBranches.push({
              ...gitData,
              path: mapping.local_path,
              user: mapping.user,
              id: `local-${mapping.id || Date.now()}`
            })
            console.log(`✅ Successfully read Git data from ${mapping.local_path}`)
          } else {
            console.warn(`⚠️ No Git data returned from ${mapping.local_path}`)
          }
        } catch (repoError) {
          console.warn(`❌ Failed to read Git data from ${mapping.local_path}:`, repoError)
        }
      }

      // Use real data if available, otherwise fall back to mock
      if (allBranches.length > 0) {
        console.log('📊 All branches data:', allBranches)
        setBranches(allBranches)
        setDataSource('backend')
        console.log(`✅ Using real Git data from ${allBranches.length} stored repositories`)

        // Generate commits and users from real data
        const realCommits = await generateCommitsFromRealData(allBranches)
        setCommits(realCommits)

        const realUsers = await generateUsersFromRealData(allBranches)
        setLocalUsers(realUsers)

        // Don't fetch GitHub branches - we already have local repository data
      } else {
        console.log(`⚠️ No Git data could be read, falling back to mock data`)
        await fetchMockBranches()
        await fetchMockCommits()
        await fetchMockUsers()
        setDataSource('mock')

        // Only try to fetch from GitHub API if we're using mock data
        if (project.repositories?.[0]?.url) {
          try {
            const repo = project.repositories[0]
            const urlParts = repo.url.replace('https://github.com/', '').split('/')
            const owner = urlParts[0]
            const repoName = urlParts[1]?.replace(/\.git$/, '') // Remove .git suffix

            if (owner && repoName) {
              await fetchGitHubBranches(owner, repoName)
            }
          } catch (githubError) {
            console.log('GitHub API not available, using backend data only')
          }
        }
      }

    } catch (err) {
      console.error('Error fetching repository data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch repository data')

      // Fall back to mock data on error
      await fetchMockBranches()
      await fetchMockCommits()
      await fetchMockUsers()
      setDataSource('mock')
    } finally {
      setLoading(false)
    }
  }

  const convertBackendBranches = async (repoState: any, repoConfig: any): Promise<GitHubBranch[]> => {
    const branches: GitHubBranch[] = []

    // Add current branch
    if (repoState.branch && repoState.branch !== 'DETACHED') {
      branches.push({
        name: repoState.branch,
        commit: {
          sha: repoState.head || 'unknown',
          author: {
            login: 'local-user',
            avatar_url: '/default-avatar.png'
          },
          commit: {
            author: {
              name: 'Local Developer',
              date: new Date().toISOString()
            },
            message: 'Latest commit on ' + repoState.branch
          }
        },
        protected: repoState.branch === 'main' || repoState.branch === 'master',
        isDefault: repoState.branch === 'main' || repoState.branch === 'master',
        aheadBy: repoState.ahead || 0,
        behindBy: repoState.behind || 0
      })
    }

    // Add other local branches
    if (repoState.localBranches) {
      for (const branchName of repoState.localBranches) {
        if (branchName !== repoState.branch) {
          branches.push({
            name: branchName,
            commit: {
              sha: 'branch-' + branchName.replace(/[^a-zA-Z0-9]/g, ''),
              author: {
                login: 'local-user',
                avatar_url: '/default-avatar.png'
              },
              commit: {
                author: {
                  name: 'Local Developer',
                  date: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString()
                },
                message: 'Work in progress on ' + branchName
              }
            },
            protected: branchName === 'main' || branchName === 'master' || branchName.includes('release'),
            isDefault: false,
            aheadBy: Math.floor(Math.random() * 5),
            behindBy: Math.floor(Math.random() * 3)
          })
        }
      }
    }

    return branches
  }

  const convertBackendCommits = async (repoConfig: any): Promise<GitHubCommit[]> => {
    // For now, generate some commits based on the repository state
    // In a full implementation, this would come from Git log data
    const commits: GitHubCommit[] = []

    for (let i = 0; i < 6; i++) {
      commits.push({
        sha: `commit-${i}-${repoConfig.id}`,
        commit: {
          author: {
            name: ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Chen'][i % 4],
            email: ['john@company.com', 'jane@company.com', 'bob@company.com', 'alice@company.com'][i % 4],
            date: new Date(Date.now() - i * 3600000).toISOString()
          },
          message: [
            'Add new feature implementation',
            'Fix bug in user authentication',
            'Refactor dashboard components',
            'Update API documentation',
            'Add unit tests',
            'Security improvements'
          ][i]
        },
        author: {
          login: ['johndoe', 'janesmith', 'bobwilson', 'alicechen'][i % 4],
          avatar_url: '/default-avatar.png'
        },
        stats: {
          additions: Math.floor(Math.random() * 200) + 10,
          deletions: Math.floor(Math.random() * 50)
        }
      })
    }

    return commits
  }

  const convertBackendUsers = async (repoConfig: any, repoState: any): Promise<LocalUserLocation[]> => {
    const users: LocalUserLocation[] = []

    // Add the current user working on this repository
    users.push({
      userId: `user-${repoConfig.id}`,
      userName: 'CURRENT.USER',
      userEmail: 'current@company.com',
      localPath: repoConfig.path,
      currentBranch: repoState.branch || 'main',
      lastActivity: new Date().toISOString(),
      status: 'online',
      commitsToday: Math.floor(Math.random() * 5) + 1
    })

    return users
  }

  const fetchMockBranches = async () => {
    // Existing mock branch logic
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
      // ... other mock branches
    ]
    setBranches(mockBranches)
  }

  const fetchMockCommits = async () => {
    // Existing mock commit logic
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
      // ... other mock commits
    ]
    setCommits(mockCommits)
  }

  const fetchMockUsers = async () => {
    // Existing mock user logic
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
      // ... other mock users
    ]
    setLocalUsers(mockUsers)
  }

  const fetchGitHubBranches = async (owner: string, repo: string) => {
    try {
      // Try to fetch from GitHub API (public repositories)
      // In production, you'd want to use authenticated requests for private repos
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`)
        if (response.ok) {
          const githubBranches = await response.json()
          const formattedBranches: GitHubBranch[] = githubBranches.slice(0, 10).map((branch: any) => ({
            name: branch.name,
            commit: {
              sha: branch.commit.sha,
              author: {
                login: 'github-user',
                avatar_url: 'https://github.com/github-user.png'
              },
              commit: {
                author: {
                  name: 'GitHub User',
                  date: new Date().toISOString()
                },
                message: 'Latest commit'
              }
            },
            protected: branch.protected || false
          }))
          setBranches(formattedBranches)
          return
        }
      } catch (apiError) {
        console.log('GitHub API not available, using mock data')
      }

      // Fallback to mock data
      const mockBranches: GitHubBranch[] = [
        {
          name: 'main',
          commit: {
            sha: 'abc123def456',
            author: {
              login: 'johndoe',
              avatar_url: 'https://github.com/johndoe.png'
            },
            commit: {
              author: {
                name: 'John Doe',
                date: new Date().toISOString()
              },
              message: 'Add new feature implementation'
            }
          },
          protected: true,
          isDefault: true,
          aheadBy: 0,
          behindBy: 0
        },
        {
          name: 'develop',
          commit: {
            sha: 'def456ghi789',
            author: {
              login: 'janedoe',
              avatar_url: 'https://github.com/janedoe.png'
            },
            commit: {
              author: {
                name: 'Jane Doe',
                date: new Date(Date.now() - 86400000).toISOString()
              },
              message: 'Fix bug in user authentication'
            }
          },
          protected: false,
          aheadBy: 2,
          behindBy: 1
        },
        {
          name: 'feature/new-dashboard',
          commit: {
            sha: 'ghi789jkl012',
            author: {
              login: 'bobsmith',
              avatar_url: 'https://github.com/bobsmith.png'
            },
            commit: {
              author: {
                name: 'Bob Smith',
                date: new Date(Date.now() - 172800000).toISOString()
              },
              message: 'WIP: Dashboard redesign'
            }
          },
          protected: false,
          aheadBy: 5,
          behindBy: 3
        },
        {
          name: 'hotfix/security-patch',
          commit: {
            sha: 'jkl012mno345',
            author: {
              login: 'alicedev',
              avatar_url: 'https://github.com/alicedev.png'
            },
            commit: {
              author: {
                name: 'Alice Developer',
                date: new Date(Date.now() - 3600000).toISOString()
              },
              message: 'Security: Fix XSS vulnerability'
            }
          },
          protected: true,
          aheadBy: 1,
          behindBy: 0
        }
      ]

      setBranches(mockBranches)
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchGitHubCommits = async (owner: string, repo: string) => {
    try {
      // Mock commit data
      const mockCommits: GitHubCommit[] = [
        {
          sha: 'abc123def456',
          commit: {
            author: {
              name: 'John Doe',
              email: 'john@example.com',
              date: new Date().toISOString()
            },
            message: 'Add new feature implementation'
          },
          author: {
            login: 'johndoe',
            avatar_url: 'https://github.com/johndoe.png'
          },
          stats: { additions: 127, deletions: 23 }
        },
        {
          sha: 'def456ghi789',
          commit: {
            author: {
              name: 'Jane Smith',
              email: 'jane@example.com',
              date: new Date(Date.now() - 3600000).toISOString()
            },
            message: 'Fix bug in user authentication system'
          },
          author: {
            login: 'janesmith',
            avatar_url: 'https://github.com/janesmith.png'
          },
          stats: { additions: 45, deletions: 12 }
        },
        {
          sha: 'ghi789jkl012',
          commit: {
            author: {
              name: 'Bob Wilson',
              email: 'bob@example.com',
              date: new Date(Date.now() - 7200000).toISOString()
            },
            message: 'Refactor dashboard components for better performance'
          },
          author: {
            login: 'bobwilson',
            avatar_url: 'https://github.com/bobwilson.png'
          },
          stats: { additions: 89, deletions: 156 }
        },
        {
          sha: 'jkl012mno345',
          commit: {
            author: {
              name: 'Alice Chen',
              email: 'alice@example.com',
              date: new Date(Date.now() - 10800000).toISOString()
            },
            message: 'Security: Fix XSS vulnerability in user input'
          },
          author: {
            login: 'alicechen',
            avatar_url: 'https://github.com/alicechen.png'
          },
          stats: { additions: 34, deletions: 8 }
        },
        {
          sha: 'mno345pqr678',
          commit: {
            author: {
              name: 'John Doe',
              email: 'john@example.com',
              date: new Date(Date.now() - 86400000).toISOString()
            },
            message: 'Update API documentation and examples'
          },
          author: {
            login: 'johndoe',
            avatar_url: 'https://github.com/johndoe.png'
          },
          stats: { additions: 67, deletions: 5 }
        },
        {
          sha: 'pqr678stu901',
          commit: {
            author: {
              name: 'Jane Smith',
              email: 'jane@example.com',
              date: new Date(Date.now() - 172800000).toISOString()
            },
            message: 'Add unit tests for authentication module'
          },
          author: {
            login: 'janesmith',
            avatar_url: 'https://github.com/janesmith.png'
          },
          stats: { additions: 234, deletions: 0 }
        }
      ]

      setCommits(mockCommits)
    } catch (error) {
      console.error('Error fetching commits:', error)
    }
  }

  const fetchLocalUserLocations = async (repo: any) => {
    try {
      // Get local mappings from the repository data
      const localMappings = repo.local_mappings || []

      const mockUsers: LocalUserLocation[] = localMappings.map((mapping: any, index: number) => ({
        userId: mapping.user?.id || `user-${index}`,
        userName: mapping.user?.name || ['JOHN.DOE', 'JANE.SMITH', 'BOB.WILSON', 'ALICE.CHEN'][index % 4],
        userEmail: mapping.user?.email || ['john@company.com', 'jane@company.com', 'bob@company.com', 'alice@company.com'][index % 4],
        localPath: mapping.local_path || [
          '/Users/john/workspace/project',
          '/home/jane/dev/project',
          'C:\\Users\\Bob\\Projects\\project',
          '/Users/alice/code/project'
        ][index % 4],
        currentBranch: ['main', 'develop', 'feature/new-dashboard', 'hotfix/security-patch'][index % 4],
        lastActivity: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
        status: ['online', 'away', 'online', 'online'][index % 4] as 'online' | 'away' | 'offline',
        commitsToday: [3, 1, 5, 2][index % 4]
      }))

      // Add some default users if no mappings exist
      if (mockUsers.length === 0) {
        const defaultUsers: LocalUserLocation[] = [
          {
            userId: 'user-1',
            userName: 'JOHN.DOE',
            userEmail: 'john@company.com',
            localPath: '/Users/john/workspace/project',
            currentBranch: 'main',
            lastActivity: new Date(Date.now() - 3600000).toISOString(),
            status: 'online',
            commitsToday: 3
          },
          {
            userId: 'user-2',
            userName: 'JANE.SMITH',
            userEmail: 'jane@company.com',
            localPath: '/home/jane/dev/project',
            currentBranch: 'develop',
            lastActivity: new Date(Date.now() - 7200000).toISOString(),
            status: 'away',
            commitsToday: 1
          },
          {
            userId: 'user-3',
            userName: 'BOB.WILSON',
            userEmail: 'bob@company.com',
            localPath: 'C:\\Users\\Bob\\Projects\\project',
            currentBranch: 'feature/new-dashboard',
            lastActivity: new Date(Date.now() - 1800000).toISOString(),
            status: 'online',
            commitsToday: 5
          }
        ]
        setLocalUsers(defaultUsers)
      } else {
        setLocalUsers(mockUsers)
      }

      setLocalUsers(mockUsers)
    } catch (error) {
      console.error('Error fetching local user locations:', error)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    return date.toLocaleDateString()
  }

  const readGitDataFromPath = async (localPath: string) => {
    try {
      console.log(`📂 Reading Git data directly from stored path: ${localPath}`)

      // Use direct Git state reading method - NO SEARCHING
      if (electronAPI.git && electronAPI.git.readDirectGitState) {
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

      // If direct method not available, return null - NO FALLBACK SEARCHING
      console.warn(`⚠️ Direct Git state method not available for ${localPath}`)
      return null

    } catch (error) {
      console.error(`❌ Error reading Git data from ${localPath}:`, error)
      return null
    }
  }

  const generateCommitsFromRealData = async (repositories: any[]) => {
    const commits: GitHubCommit[] = []

    for (const repo of repositories) {
      // Create a commit entry for the current HEAD
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
          additions: 0, // We'd need to run git log to get real stats
          deletions: 0
        }
      })

      // Add some recent activity based on branch info
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

    return commits.slice(0, 6) // Limit to 6 most recent
  }

  const generateUsersFromRealData = async (repositories: any[]) => {
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

  // Get local repository info - uses local folder name
  const getLocalRepositoryInfo = (repoConfig: any) => {
    console.log('🔍 getLocalRepositoryInfo called with:', repoConfig)

    // Extract the local folder name from the file path
    const pathToUse = repoConfig.path || ''
    console.log('📂 Path to use:', pathToUse)

    const folderName = pathToUse.split('/').pop() || pathToUse.split('\\').pop() || 'Unknown'
    console.log('📁 Extracted folder name:', folderName)

    // Extract owner from Git remote URLs
    let ownerName = 'local'
    if (repoConfig.remoteUrls) {
      const originUrl = repoConfig.remoteUrls.origin || Object.values(repoConfig.remoteUrls)[0]
      if (originUrl) {
        try {
          let cleanUrl = originUrl as string
          if (cleanUrl.startsWith('git@github.com:')) {
            cleanUrl = cleanUrl.replace('git@github.com:', 'https://github.com/')
          }
          if (cleanUrl.includes('github.com')) {
            const match = cleanUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/)?$/)
            if (match) {
              ownerName = match[1]
            }
          }
        } catch (error) {
          console.warn('Failed to parse Git remote URL:', originUrl, error)
        }
      }
    }

    // Fallback to project remote URL for owner
    if (ownerName === 'local') {
      const projectRemoteUrl = project?.repositories?.[0]?.url
      if (projectRemoteUrl) {
        try {
          const urlParts = projectRemoteUrl.replace('https://github.com/', '').replace('.git', '').split('/')
          if (urlParts.length >= 2) {
            ownerName = urlParts[0]
          }
        } catch (error) {
          console.warn('Failed to parse project remote URL:', projectRemoteUrl)
        }
      }
    }

    return {
      name: folderName,
      owner: ownerName,
      avatarUrl: `https://github.com/${ownerName}.png`,
      fullPath: pathToUse
    }
  }

  // Get remote repository info - uses GitHub repo name
  const getRemoteRepositoryInfo = (repoConfig: any) => {
    let ownerName = 'local'
    let repoName = 'unknown'

    // Extract from Git remote URLs
    if (repoConfig.remoteUrls) {
      const originUrl = repoConfig.remoteUrls.origin || Object.values(repoConfig.remoteUrls)[0]
      if (originUrl) {
        try {
          let cleanUrl = originUrl as string
          if (cleanUrl.startsWith('git@github.com:')) {
            cleanUrl = cleanUrl.replace('git@github.com:', 'https://github.com/')
          }
          if (cleanUrl.includes('github.com')) {
            const match = cleanUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/)?$/)
            if (match) {
              ownerName = match[1]
              repoName = match[2]
            }
          }
        } catch (error) {
          console.warn('Failed to parse Git remote URL:', originUrl, error)
        }
      }
    }

    // Fallback to project remote URL
    if (repoName === 'unknown') {
      const projectRemoteUrl = project?.repositories?.[0]?.url
      if (projectRemoteUrl) {
        try {
          const urlParts = projectRemoteUrl.replace('https://github.com/', '').replace('.git', '').split('/')
          if (urlParts.length >= 2) {
            ownerName = urlParts[0]
            repoName = urlParts[1]
          }
        } catch (error) {
          console.warn('Failed to parse project remote URL:', projectRemoteUrl)
        }
      }
    }

    return {
      name: repoName,
      owner: ownerName,
      avatarUrl: `https://github.com/${ownerName}.png`,
      fullPath: repoConfig.path || ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-gray-800 rounded-none shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-black border-b border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1 text-white font-mono">REPOSITORY.VISUALIZATION</h2>
              <p className="text-gray-400 flex items-center space-x-2 font-mono text-sm">
                <span className={`w-2 h-2 rounded-none ${dataSource === 'backend' ? 'bg-green-400' :
                  dataSource === 'github' ? 'bg-blue-400' : 'bg-yellow-400'
                  } ${dataSource === 'backend' ? 'animate-pulse' : ''}`}></span>
                <span>{project?.name?.toUpperCase()}</span>
                <span>/</span>
                <span>{project?.repositories?.[0]?.name?.toUpperCase()}</span>
                <span>•</span>
                <span className="text-xs">
                  {dataSource === 'backend' ? 'LIVE.DATA' :
                    dataSource === 'github' ? 'GITHUB.API' : 'MOCK.DATA'}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-none border border-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '20px 20px'
            }}></div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="bg-black border-b border-gray-800">
          <nav className="flex px-6">
            {[
              { id: 'local', label: 'LOCAL.REPOSITORIES' },
              { id: 'remote', label: 'REMOTE.DATA' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative py-4 px-8 font-mono text-xs font-medium transition-all duration-200 ${activeTab === tab.id
                  ? 'text-white bg-gray-900 border-l border-r border-gray-700'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                  }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-white"></div>
                )}
              </button>
            ))}
          </nav>

          {/* Local Repository Sub-tabs */}
          {activeTab === 'local' && project.repositories?.[0]?.local_mappings?.length > 0 && (
            <div className="bg-gray-950 border-b border-gray-800">
              <nav className="flex px-6 overflow-x-auto">
                {project.repositories[0].local_mappings.map((mapping: any, index: number) => {
                  const repoId = `repo-${index}`;
                  // Extract folder name directly from the stored path
                  const folderName = mapping.local_path.split('/').pop() || mapping.local_path.split('\\').pop() || 'Unknown';
                  // Extract owner from project remote URL
                  const projectRemoteUrl = project.repositories?.[0]?.url || '';
                  let ownerName = 'local';
                  if (projectRemoteUrl) {
                    try {
                      const urlParts = projectRemoteUrl.replace('https://github.com/', '').replace('.git', '').split('/');
                      if (urlParts.length >= 2) {
                        ownerName = urlParts[0];
                      }
                    } catch (error) {
                      console.warn('Failed to parse project remote URL:', projectRemoteUrl);
                    }
                  }
                  const isActive = activeLocalRepo === repoId || (activeLocalRepo === '' && index === 0);

                  return (
                    <button
                      key={repoId}
                      onClick={() => setActiveLocalRepo(repoId)}
                      className={`relative py-3 px-4 font-mono text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center space-x-2 ${isActive
                        ? 'text-white bg-black border-l border-r border-gray-700'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                        }`}
                    >
                      {/* Owner Avatar */}
                      <img
                        src={`https://github.com/${ownerName}.png`}
                        alt={ownerName}
                        className="w-4 h-4 rounded-sm"
                        onError={(e) => {
                          // Fallback to initials if image fails
                          e.currentTarget.style.display = 'none';
                        }}
                      />

                      {/* Repository Name */}
                      <span className="truncate max-w-32">
                        {folderName.toUpperCase()}
                      </span>

                      {/* Owner Name */}
                      <span className="text-gray-500 text-xs">
                        @{ownerName.toLowerCase()}
                      </span>

                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-white"></div>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-black p-8 overflow-y-auto max-h-[calc(95vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="border border-gray-600 rounded-none p-4">
                <div className="text-white font-mono text-sm">LOADING.REPOSITORY.DATA...</div>
                <div className="mt-2 w-32 h-1 bg-gray-800">
                  <div className="h-full bg-white animate-pulse w-1/3"></div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12 border border-gray-800 bg-gray-900">
              <div className="text-red-400 mb-4 font-mono">ERROR: {error}</div>
              <button
                onClick={fetchRepositoryData}
                className="bg-white text-black px-6 py-2 font-mono text-sm hover:bg-gray-200 transition-colors"
              >
                RETRY.CONNECTION
              </button>
            </div>
          ) : (
            <>
              {/* Local Repositories Tab */}
              {activeTab === 'local' && (
                <div className="space-y-6">
                  {/* Local Repository Content */}
                  <div className="border border-gray-800 bg-black">
                    <div className="border-b border-gray-800 p-4">
                      <div className="flex items-center space-x-3">
                        {branches.length > 0 && (() => {
                          const activeIndex = activeLocalRepo ? parseInt(activeLocalRepo.split('-')[1]) : 0;
                          const activeRepo = branches[activeIndex];
                          const repoInfo = getLocalRepositoryInfo(activeRepo);

                          return (
                            <>
                              <img
                                src={repoInfo.avatarUrl}
                                alt={repoInfo.owner}
                                className="w-6 h-6 rounded-sm"
                              />
                              <div>
                                <h3 className="text-white font-mono text-sm">{repoInfo.name.toUpperCase()}</h3>
                                <p className="text-gray-400 font-mono text-xs">
                                  {repoInfo.fullPath} • Reading from .git folder
                                </p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Current Branch & Status */}
                      <div className="grid grid-cols-3 gap-6">
                        <div className="border border-gray-800 p-4">
                          <div className="text-gray-400 font-mono text-xs mb-2">CURRENT.BRANCH</div>
                          <div className="text-white font-mono text-lg font-bold">
                            {(() => {
                              const activeIndex = activeLocalRepo ? parseInt(activeLocalRepo.split('-')[1]) : 0;
                              const activeRepo = branches[activeIndex];
                              return activeRepo?.branch || activeRepo?.name || 'main';
                            })()}
                          </div>
                          <div className="text-gray-500 font-mono text-xs mt-1">
                            {(() => {
                              const activeIndex = activeLocalRepo ? parseInt(activeLocalRepo.split('-')[1]) : 0;
                              const activeRepo = branches[activeIndex];
                              return activeRepo?.head?.substring(0, 8) || activeRepo?.commit?.sha?.substring(0, 8) || 'unknown';
                            })()}
                          </div>
                        </div>

                        <div className="border border-gray-800 p-4">
                          <div className="text-gray-400 font-mono text-xs mb-2">WORKING.DIRECTORY</div>
                          <div className="text-white font-mono text-lg font-bold">
                            {(() => {
                              const activeIndex = activeLocalRepo ? parseInt(activeLocalRepo.split('-')[1]) : 0;
                              const activeRepo = branches[activeIndex];
                              return activeRepo?.dirty ? 'DIRTY' : 'CLEAN';
                            })()}
                          </div>
                          <div className="text-gray-500 font-mono text-xs mt-1">
                            {(() => {
                              const activeIndex = activeLocalRepo ? parseInt(activeLocalRepo.split('-')[1]) : 0;
                              const activeRepo = branches[activeIndex];
                              return activeRepo?.dirty ? 'Uncommitted changes' : 'No changes';
                            })()}
                          </div>
                        </div>

                        <div className="border border-gray-800 p-4">
                          <div className="text-gray-400 font-mono text-xs mb-2">SYNC.STATUS</div>
                          <div className="text-white font-mono text-lg font-bold">
                            {(() => {
                              const activeIndex = activeLocalRepo ? parseInt(activeLocalRepo.split('-')[1]) : 0;
                              const activeRepo = branches[activeIndex];
                              return `↑${activeRepo?.ahead || 0} ↓${activeRepo?.behind || 0}`;
                            })()}
                          </div>
                          <div className="text-gray-500 font-mono text-xs mt-1">
                            Ahead / Behind origin
                          </div>
                        </div>
                      </div>

                      {/* Local Branches */}
                      <div className="border border-gray-800">
                        <div className="border-b border-gray-800 p-3">
                          <h4 className="text-white font-mono text-xs">LOCAL.BRANCHES</h4>
                        </div>
                        <div className="p-4 space-y-2">
                          {(() => {
                            const activeIndex = activeLocalRepo ? parseInt(activeLocalRepo.split('-')[1]) : 0;
                            const activeRepo = branches[activeIndex];
                            const localBranches = activeRepo?.localBranches || [activeRepo?.branch || 'main'];

                            return localBranches.slice(0, 6).map((branchName: string, index: number) => (
                              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-900 last:border-b-0">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-2 h-2 ${branchName === activeRepo?.branch ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                                  <span className="text-white font-mono text-sm">{branchName}</span>
                                  {branchName === activeRepo?.branch && (
                                    <span className="text-green-400 font-mono text-xs">CURRENT</span>
                                  )}
                                </div>
                                <div className="text-gray-400 font-mono text-xs">
                                  {activeRepo?.head?.substring(0, 8) || 'unknown'}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Recent Activity */}
                      <div className="border border-gray-800">
                        <div className="border-b border-gray-800 p-3">
                          <h4 className="text-white font-mono text-xs">RECENT.ACTIVITY</h4>
                        </div>
                        <div className="p-4 space-y-3">
                          {commits.slice(0, 4).map((commit, index) => (
                            <div key={index} className="flex items-start space-x-3 py-2 border-b border-gray-900 last:border-b-0">
                              <div className="w-2 h-2 bg-white mt-2"></div>
                              <div className="flex-1">
                                <div className="text-white font-mono text-sm">{commit.commit.message}</div>
                                <div className="text-gray-400 font-mono text-xs mt-1">
                                  {commit.commit.author.name} • {formatTimeAgo(commit.commit.author.date)}
                                </div>
                              </div>
                              <div className="text-gray-500 font-mono text-xs">
                                {commit.sha.substring(0, 8)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Backend Status */}
                  <div className="border border-gray-800 bg-black mb-6">
                    <div className="border-b border-gray-800 p-4">
                      <h3 className="text-white font-mono text-sm">BACKEND.CONNECTION.STATUS</h3>
                    </div>
                    <div className="p-4 font-mono text-xs">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-gray-400 mb-1">DATA.SOURCE</div>
                          <div className={`font-bold ${dataSource === 'backend' ? 'text-green-400' :
                            dataSource === 'github' ? 'text-blue-400' : 'text-yellow-400'
                            }`}>
                            {dataSource === 'backend' ? 'GIT.MONITORING.BACKEND' :
                              dataSource === 'github' ? 'GITHUB.API' : 'MOCK.DATA.FALLBACK'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">CONNECTION.STATUS</div>
                          <div className={`font-bold ${dataSource === 'backend' ? 'text-green-400' : 'text-yellow-400'
                            }`}>
                            {dataSource === 'backend' ? 'CONNECTED' : 'FALLBACK.MODE'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">LAST.UPDATE</div>
                          <div className="text-white font-bold">
                            {new Date().toLocaleTimeString().toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Activity Visualization */}
                  <div className="border border-gray-800 bg-black">
                    <div className="border-b border-gray-800 p-4">
                      <h3 className="text-white font-mono text-sm">COMMIT.FREQUENCY.ANALYSIS</h3>
                    </div>
                    <div className="p-6">
                      {/* ASCII-style commit frequency chart */}
                      <div className="font-mono text-xs space-y-1">
                        {Array.from({ length: 7 }).map((_, dayIndex) => {
                          const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayIndex]
                          const commitCount = Math.floor(Math.random() * 20)
                          const barLength = Math.floor((commitCount / 20) * 40)

                          return (
                            <div key={dayIndex} className="flex items-center space-x-2">
                              <span className="text-gray-400 w-8">{dayName}</span>
                              <span className="text-gray-600">|</span>
                              <div className="flex">
                                {Array.from({ length: 40 }).map((_, i) => (
                                  <span key={i} className={i < barLength ? 'text-white' : 'text-gray-800'}>
                                    ▓
                                  </span>
                                ))}
                              </div>
                              <span className="text-gray-400 ml-2">{commitCount.toString().padStart(2, '0')}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Terminal-style Activity Log */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="border border-gray-800 bg-black">
                      <div className="border-b border-gray-800 p-4 bg-gray-900">
                        <div className="flex items-center justify-between">
                          <h3 className="text-white font-mono text-sm">ACTIVITY.LOG</h3>
                          <div className="flex space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 h-80 overflow-y-auto">
                        <div className="font-mono text-xs space-y-2">
                          {commits.slice(0, 8).map((commit, index) => (
                            <div key={commit.sha} className="text-gray-300">
                              <div className="flex items-start space-x-2">
                                <span className="text-gray-600">[{formatTimeAgo(commit.commit.author.date).replace(' ago', '').toUpperCase()}]</span>
                                <span className="text-white">COMMIT</span>
                                <span className="text-gray-400">{commit.sha.substring(0, 7)}</span>
                              </div>
                              <div className="ml-4 text-gray-400 mt-1">
                                └─ {commit.commit.message.substring(0, 60)}
                                {commit.commit.message.length > 60 && '...'}
                              </div>
                              <div className="ml-4 text-gray-600 text-xs">
                                BY: {commit.commit.author.name.toUpperCase()}
                                {commit.stats && (
                                  <span className="ml-4">
                                    +{commit.stats.additions} -{commit.stats.deletions}
                                  </span>
                                )}
                              </div>
                              {index < commits.length - 1 && <div className="text-gray-800 ml-2">│</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Team Status Terminal */}
                    <div className="border border-gray-800 bg-black">
                      <div className="border-b border-gray-800 p-4 bg-gray-900">
                        <div className="flex items-center justify-between">
                          <h3 className="text-white font-mono text-sm">TEAM.STATUS</h3>
                          <div className="text-gray-400 font-mono text-xs">
                            {localUsers.filter(u => u.status === 'online').length}/{localUsers.length} ONLINE
                          </div>
                        </div>
                      </div>
                      <div className="p-4 h-80 overflow-y-auto">
                        <div className="font-mono text-xs space-y-3">
                          {localUsers.map((userLoc, index) => (
                            <div key={userLoc.userId} className="border-l-2 border-gray-700 pl-4">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-2 h-2 ${userLoc.status === 'online' ? 'bg-green-400' :
                                    userLoc.status === 'away' ? 'bg-yellow-400' : 'bg-gray-600'
                                    }`}></div>
                                  <span className="text-white font-bold">{userLoc.userName.toUpperCase()}</span>
                                </div>
                                <span className="text-gray-400">{userLoc.status.toUpperCase()}</span>
                              </div>

                              <div className="text-gray-400 ml-4 space-y-1">
                                <div>BRANCH: <span className="text-white">{userLoc.currentBranch}</span></div>
                                <div>LAST: <span className="text-white">
                                  {userLoc.lastActivity ? formatTimeAgo(userLoc.lastActivity).toUpperCase() : 'UNKNOWN'}
                                </span></div>
                                {userLoc.commitsToday && (
                                  <div>TODAY: <span className="text-green-400">{userLoc.commitsToday} COMMITS</span></div>
                                )}
                              </div>

                              <div className="mt-2 ml-4 text-gray-600 text-xs break-all">
                                PATH: {userLoc.localPath}
                              </div>

                              {index < localUsers.length - 1 && (
                                <div className="mt-2 text-gray-800">
                                  ────────────────────────────────────
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Remote Data Tab */}
              {activeTab === 'remote' && (
                <div className="space-y-6">
                  {/* Remote Repository Info */}
                  <div className="border border-gray-800 bg-black">
                    <div className="border-b border-gray-800 p-4">
                      <h3 className="text-white font-mono text-sm">REMOTE.REPOSITORY.DATA</h3>
                      <p className="text-gray-400 font-mono text-xs mt-1">
                        Data from GitHub API and remote Git information
                      </p>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Remote Info */}
                      <div className="grid grid-cols-2 gap-6">
                        <div className="border border-gray-800 p-4">
                          <div className="text-gray-400 font-mono text-xs mb-2">REMOTE.URL</div>
                          <div className="text-white font-mono text-sm break-all">
                            {project?.repositories?.[0]?.url || 'No remote configured'}
                          </div>
                        </div>

                        <div className="border border-gray-800 p-4">
                          <div className="text-gray-400 font-mono text-xs mb-2">DATA.SOURCE</div>
                          <div className={`font-mono text-sm font-bold ${dataSource === 'backend' ? 'text-green-400' :
                            dataSource === 'github' ? 'text-blue-400' : 'text-yellow-400'
                            }`}>
                            {dataSource === 'backend' ? 'GIT.MONITORING.BACKEND' :
                              dataSource === 'github' ? 'GITHUB.API' : 'MOCK.DATA'}
                          </div>
                        </div>
                      </div>

                      {/* Remote Branches */}
                      <div className="border border-gray-800">
                        <div className="border-b border-gray-800 p-3">
                          <h4 className="text-white font-mono text-xs">REMOTE.BRANCHES</h4>
                        </div>
                        <div className="p-4 space-y-2">
                          {branches.slice(0, 8).map((branch, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-900 last:border-b-0">
                              <div className="flex items-center space-x-3">
                                <div className={`w-2 h-2 ${branch.protected ? 'bg-red-400' : 'bg-gray-600'}`}></div>
                                <span className="text-white font-mono text-sm">origin/{branch.name}</span>
                                {branch.protected && (
                                  <span className="text-red-400 font-mono text-xs">PROTECTED</span>
                                )}
                              </div>
                              <div className="text-gray-400 font-mono text-xs">
                                {branch.commit?.sha?.substring(0, 8)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* GitHub Integration Status */}
                      <div className="border border-gray-800">
                        <div className="border-b border-gray-800 p-3">
                          <h4 className="text-white font-mono text-xs">GITHUB.API.STATUS</h4>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 ${dataSource === 'github' ? 'bg-green-400' : 'bg-red-400'
                              }`}></div>
                            <span className="text-white font-mono text-sm">
                              {dataSource === 'github' ? 'CONNECTED' : 'DISCONNECTED'}
                            </span>
                          </div>
                          <p className="text-gray-400 font-mono text-xs mt-2">
                            {dataSource === 'github'
                              ? 'Successfully fetching data from GitHub API'
                              : 'Using local Git data only - GitHub API unavailable'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Legacy Git Graph Tab - keeping for reference */}
              {false && activeTab === 'branches' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                    <div>
                      <h3 className="text-white font-mono text-lg">GIT.BRANCH.GRAPH</h3>
                      <p className="text-gray-400 font-mono text-xs mt-1">REPOSITORY.TOPOLOGY.VISUALIZATION</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-gray-400 font-mono text-xs border border-gray-700 px-3 py-1">
                        {branches.length.toString().padStart(2, '0')} BRANCHES
                      </div>
                      <button
                        onClick={fetchRepositoryData}
                        className="text-black bg-white px-4 py-1 font-mono text-xs hover:bg-gray-200 transition-colors"
                      >
                        REFRESH.DATA
                      </button>
                    </div>
                  </div>

                  {/* ASCII Git Graph */}
                  <div className="border border-gray-800 bg-black font-mono text-xs overflow-x-auto">
                    <div className="p-6">
                      {branches.map((branch, index) => {
                        const branchChars = ['*', '+', 'o', 'x', '#', '@']
                        const branchChar = branchChars[index % branchChars.length]
                        const isMain = branch.name === 'main' || branch.isDefault
                        const isProtected = branch.protected

                        return (
                          <div key={branch.name} className="mb-6">
                            {/* Branch Header */}
                            <div className="flex items-center space-x-4 mb-2">
                              <div className="flex items-center space-x-2 w-64">
                                {/* ASCII Branch Line */}
                                <div className="flex items-center">
                                  {Array.from({ length: index }).map((_, i) => (
                                    <span key={i} className="text-gray-700">│ </span>
                                  ))}
                                  <span className="text-white font-bold">{branchChar}</span>
                                  <span className="text-gray-600">─</span>
                                </div>

                                {/* Branch Name */}
                                <span className="text-white font-bold">{branch.name.toUpperCase()}</span>

                                {/* Branch Tags */}
                                {isMain && <span className="text-gray-400 border border-gray-600 px-1">MAIN</span>}
                                {isProtected && <span className="text-gray-400 border border-gray-600 px-1">PROTECTED</span>}
                              </div>

                              {/* Commit Hash */}
                              <span className="text-gray-500">{branch.commit.sha.substring(0, 7)}</span>
                            </div>

                            {/* Branch Details */}
                            <div className="ml-8 space-y-1 text-gray-400">
                              <div>
                                AUTHOR: <span className="text-white">{branch.commit.commit.author.name.toUpperCase()}</span>
                              </div>
                              <div>
                                DATE: <span className="text-white">{formatTimeAgo(branch.commit.commit.author.date).toUpperCase()}</span>
                              </div>
                              <div>
                                MESSAGE: <span className="text-white">{branch.commit.commit.message}</span>
                              </div>

                              {/* Branch Stats */}
                              <div className="flex items-center space-x-4 mt-2">
                                {branch.aheadBy !== undefined && (
                                  <span>AHEAD: <span className="text-green-400">{branch.aheadBy.toString().padStart(2, '0')}</span></span>
                                )}
                                {branch.behindBy !== undefined && (
                                  <span>BEHIND: <span className="text-red-400">{branch.behindBy.toString().padStart(2, '0')}</span></span>
                                )}
                              </div>

                              {/* Users on Branch */}
                              <div className="mt-2">
                                USERS: {localUsers
                                  .filter(user => user.currentBranch === branch.name)
                                  .map(user => user.userName.toUpperCase())
                                  .join(', ') || 'NONE'}
                              </div>
                            </div>

                            {/* ASCII Connection Line */}
                            {index < branches.length - 1 && (
                              <div className="ml-2 mt-2 text-gray-700">
                                {Array.from({ length: index }).map((_, i) => (
                                  <span key={i}>│ </span>
                                ))}
                                <span>│</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Branch Statistics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-800 bg-black p-4">
                      <h4 className="text-white font-mono text-sm mb-3">BRANCH.STATISTICS</h4>
                      <div className="space-y-2 font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">TOTAL.BRANCHES:</span>
                          <span className="text-white">{branches.length.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">PROTECTED:</span>
                          <span className="text-white">{branches.filter(b => b.protected).length.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">DEFAULT:</span>
                          <span className="text-white">{branches.filter(b => b.isDefault).length.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">ACTIVE.USERS:</span>
                          <span className="text-white">{new Set(localUsers.map(u => u.currentBranch)).size.toString().padStart(2, '0')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-800 bg-black p-4">
                      <h4 className="text-white font-mono text-sm mb-3">LEGEND</h4>
                      <div className="space-y-2 font-mono text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="text-white">*</span>
                          <span className="text-gray-400">MAIN.BRANCH</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white">+</span>
                          <span className="text-gray-400">FEATURE.BRANCH</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white">o</span>
                          <span className="text-gray-400">RELEASE.BRANCH</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">│</span>
                          <span className="text-gray-400">CONNECTION.LINE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Status Tab */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                    <div>
                      <h3 className="text-white font-mono text-lg">TEAM.STATUS.MONITOR</h3>
                      <p className="text-gray-400 font-mono text-xs mt-1">REAL.TIME.DEVELOPER.TRACKING</p>
                    </div>
                    <div className="text-gray-400 font-mono text-xs border border-gray-700 px-3 py-1">
                      {localUsers.length.toString().padStart(2, '0')} ACTIVE.USERS
                    </div>
                  </div>

                  {/* Team Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {localUsers.map((userLoc, index) => (
                      <div key={userLoc.userId} className="border border-gray-800 bg-black">
                        {/* User Header */}
                        <div className="border-b border-gray-800 p-4 bg-gray-900">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-white text-black font-mono font-bold text-sm flex items-center justify-center">
                                {userLoc.userName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-white font-mono text-sm font-bold">{userLoc.userName.toUpperCase()}</div>
                                <div className="text-gray-400 font-mono text-xs">{userLoc.userEmail}</div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 ${userLoc.status === 'online' ? 'bg-green-400' :
                                userLoc.status === 'away' ? 'bg-yellow-400' : 'bg-gray-600'
                                }`}></div>
                              <span className="text-gray-400 font-mono text-xs">{userLoc.status.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>

                        {/* User Details */}
                        <div className="p-4 font-mono text-xs space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-gray-400 mb-1">CURRENT.BRANCH</div>
                              <div className="text-white border border-gray-700 px-2 py-1 bg-gray-900">
                                {userLoc.currentBranch}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-400 mb-1">LAST.ACTIVITY</div>
                              <div className="text-white">
                                {userLoc.lastActivity ? formatTimeAgo(userLoc.lastActivity).toUpperCase() : 'UNKNOWN'}
                              </div>
                            </div>
                          </div>

                          {userLoc.commitsToday && (
                            <div>
                              <div className="text-gray-400 mb-1">TODAY.COMMITS</div>
                              <div className="text-green-400 font-bold">{userLoc.commitsToday.toString().padStart(2, '0')}</div>
                            </div>
                          )}

                          <div>
                            <div className="text-gray-400 mb-1">LOCAL.WORKSPACE</div>
                            <div className="text-green-400 bg-gray-900 p-2 border border-gray-700 break-all">
                              {userLoc.localPath}
                            </div>
                          </div>

                          {/* Activity Indicator */}
                          <div className="border-t border-gray-800 pt-3 mt-3">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">ACTIVITY.LEVEL</span>
                              <div className="flex space-x-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-2 h-4 ${i < (userLoc.commitsToday || 0) ? 'bg-green-400' : 'bg-gray-700'
                                      }`}
                                  ></div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* System Status */}
                  <div className="border border-gray-800 bg-black">
                    <div className="border-b border-gray-800 p-4 bg-gray-900">
                      <h4 className="text-white font-mono text-sm">SYSTEM.STATUS</h4>
                    </div>
                    <div className="p-4 font-mono text-xs">
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <div className="text-gray-400 mb-1">TOTAL.USERS</div>
                          <div className="text-white text-lg font-bold">{localUsers.length.toString().padStart(2, '0')}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">ONLINE.NOW</div>
                          <div className="text-green-400 text-lg font-bold">
                            {localUsers.filter(u => u.status === 'online').length.toString().padStart(2, '0')}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">AWAY.STATUS</div>
                          <div className="text-yellow-400 text-lg font-bold">
                            {localUsers.filter(u => u.status === 'away').length.toString().padStart(2, '0')}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">TOTAL.COMMITS</div>
                          <div className="text-white text-lg font-bold">
                            {localUsers.reduce((sum, u) => sum + (u.commitsToday || 0), 0).toString().padStart(2, '0')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {localUsers.length === 0 && (
                    <div className="text-center py-12 border border-gray-800 bg-black">
                      <div className="text-gray-600 font-mono text-4xl mb-4">[ NO.USERS.DETECTED ]</div>
                      <div className="text-gray-400 font-mono text-sm">NO.TEAM.MEMBERS.CONNECTED.TO.LOCAL.REPOSITORIES</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}