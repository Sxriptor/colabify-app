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
}

interface LocalUserLocation {
  userId: string
  userName: string
  userEmail: string
  localPath: string
  currentBranch?: string
  lastActivity?: string
}

export function RepoVisualizationModal({ isOpen, onClose, project }: RepoVisualizationModalProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'users'>('overview')
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [commits, setCommits] = useState<GitHubCommit[]>([])
  const [localUsers, setLocalUsers] = useState<LocalUserLocation[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && project?.repositories?.length > 0) {
      fetchRepositoryData()
    }
  }, [isOpen, project])

  const fetchRepositoryData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Get the first repository for now
      const repo = project.repositories[0]
      
      // Extract owner and repo name from GitHub URL
      const urlParts = repo.url.replace('https://github.com/', '').split('/')
      const owner = urlParts[0]
      const repoName = urlParts[1]

      // Fetch branches and commits from GitHub API
      await Promise.all([
        fetchGitHubBranches(owner, repoName),
        fetchGitHubCommits(owner, repoName),
        fetchLocalUserLocations(repo)
      ])

    } catch (err) {
      console.error('Error fetching repository data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch repository data')
    } finally {
      setLoading(false)
    }
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
          protected: true
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
          protected: false
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
          protected: false
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
          }
        },
        {
          sha: 'def456ghi789',
          commit: {
            author: {
              name: 'Jane Doe',
              email: 'jane@example.com',
              date: new Date(Date.now() - 86400000).toISOString()
            },
            message: 'Fix bug in user authentication'
          },
          author: {
            login: 'janedoe',
            avatar_url: 'https://github.com/janedoe.png'
          }
        },
        {
          sha: 'ghi789jkl012',
          commit: {
            author: {
              name: 'Bob Smith',
              email: 'bob@example.com',
              date: new Date(Date.now() - 172800000).toISOString()
            },
            message: 'Update documentation and add examples'
          },
          author: {
            login: 'bobsmith',
            avatar_url: 'https://github.com/bobsmith.png'
          }
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
        userName: mapping.user?.name || 'Unknown User',
        userEmail: mapping.user?.email || 'unknown@example.com',
        localPath: mapping.local_path,
        currentBranch: ['main', 'develop', 'feature/new-dashboard'][index % 3],
        lastActivity: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString()
      }))
      
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Repository Visualization</h2>
            <p className="text-sm text-gray-500 mt-1">
              {project?.name} • {project?.repositories?.[0]?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'branches', label: 'Branches', icon: '🌿' },
              { id: 'users', label: 'Users', icon: '👥' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">⚠️ {error}</div>
              <button
                onClick={fetchRepositoryData}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Repository Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="text-blue-500 text-2xl mr-3">🌿</div>
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{branches.length}</div>
                          <div className="text-sm text-blue-600">Branches</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="text-green-500 text-2xl mr-3">👥</div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">{localUsers.length}</div>
                          <div className="text-sm text-green-600">Local Users</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="text-purple-500 text-2xl mr-3">📝</div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">{commits.length}</div>
                          <div className="text-sm text-purple-600">Recent Commits</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Git History</h3>
                    <div className="space-y-3">
                      {commits.slice(0, 5).map((commit) => (
                        <div key={commit.sha} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                          <img
                            src={commit.author?.avatar_url || '/default-avatar.png'}
                            alt={commit.author?.login}
                            className="w-8 h-8 rounded-full"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              {commit.commit.message}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {commit.commit.author.name} • {formatTimeAgo(commit.commit.author.date)}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {commit.sha.substring(0, 7)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* User Locations */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">User Locations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {localUsers.map((userLoc) => (
                        <div key={userLoc.userId} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium">
                              {userLoc.userName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{userLoc.userName}</div>
                              <div className="text-xs text-gray-500">{userLoc.userEmail}</div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">Branch:</span> {userLoc.currentBranch}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            <span className="font-medium">Path:</span> {userLoc.localPath}
                          </div>
                          {userLoc.lastActivity && (
                            <div className="text-xs text-gray-400 mt-2">
                              Last activity: {formatTimeAgo(userLoc.lastActivity)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Branches Tab */}
              {activeTab === 'branches' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Repository Branches</h3>
                    <div className="text-sm text-gray-500">
                      {branches.length} branch{branches.length !== 1 ? 'es' : ''}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {branches.map((branch) => (
                      <div key={branch.name} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-medium text-gray-900">{branch.name}</span>
                              {branch.protected && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  🔒 Protected
                                </span>
                              )}
                              {branch.name === 'main' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  Default
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-3 text-sm text-gray-600">
                              <img
                                src={branch.commit.author?.avatar_url || '/default-avatar.png'}
                                alt={branch.commit.author?.login}
                                className="w-6 h-6 rounded-full"
                              />
                              <span>{branch.commit.commit.author.name}</span>
                              <span>•</span>
                              <span>{formatTimeAgo(branch.commit.commit.author.date)}</span>
                            </div>
                            
                            <div className="text-sm text-gray-700 mt-2">
                              {branch.commit.commit.message}
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-400 font-mono ml-4">
                            {branch.commit.sha.substring(0, 7)}
                          </div>
                        </div>

                        {/* Users on this branch */}
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <div className="text-xs font-medium text-gray-500 mb-2">Users on this branch:</div>
                          <div className="flex flex-wrap gap-2">
                            {localUsers
                              .filter(user => user.currentBranch === branch.name)
                              .map(user => (
                                <div key={user.userId} className="flex items-center space-x-1 bg-gray-100 rounded-full px-2 py-1">
                                  <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center text-xs text-white">
                                    {user.userName.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs text-gray-700">{user.userName}</span>
                                </div>
                              ))}
                            {localUsers.filter(user => user.currentBranch === branch.name).length === 0 && (
                              <span className="text-xs text-gray-400 italic">No local users</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Project Contributors</h3>
                    <div className="text-sm text-gray-500">
                      {localUsers.length} local user{localUsers.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {localUsers.map((userLoc) => (
                      <div key={userLoc.userId} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-lg">
                            {userLoc.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{userLoc.userName}</div>
                            <div className="text-sm text-gray-500">{userLoc.userEmail}</div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Current Branch:</span>
                            <span className="font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
                              {userLoc.currentBranch}
                            </span>
                          </div>

                          <div className="text-sm">
                            <div className="text-gray-500 mb-1">Local Path:</div>
                            <div className="font-mono text-xs bg-gray-50 p-2 rounded border break-all">
                              {userLoc.localPath}
                            </div>
                          </div>

                          {userLoc.lastActivity && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">Last Activity:</span>
                              <span className="text-gray-700">{formatTimeAgo(userLoc.lastActivity)}</span>
                            </div>
                          )}

                          <div className="pt-3 border-t border-gray-100">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span className="text-xs text-gray-500">Active</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {localUsers.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-4xl mb-4">👥</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Local Users</h3>
                      <p className="text-gray-500">No team members have connected their local repositories yet.</p>
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