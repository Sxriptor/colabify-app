'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'

interface RemoteCommit {
  sha: string
  message: string
  author: {
    name: string
    avatar_url?: string
    login: string
  }
  date: string
  branch: string
  url: string
}

interface RemoteRepositoryStatus {
  repositoryName: string
  repositoryFullName: string
  repositoryUrl: string
  defaultBranch: string
  recentCommits: RemoteCommit[]
  branches: string[]
  localStatus?: {
    localPath: string
    currentBranch: string
    ahead: number
    behind: number
    hasLocalMapping: boolean
  }[]
}

interface RemoteUpdatesPanelProps {
  project: any
}

export function RemoteUpdatesPanel({ project }: RemoteUpdatesPanelProps) {
  const { user } = useAuth()
  const [remoteData, setRemoteData] = useState<RemoteRepositoryStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if we're in Electron environment
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI

  useEffect(() => {
    // Initial fetch
    fetchRemoteUpdates()

    // Set up auto-refresh every 10 seconds
    const refreshInterval = setInterval(() => {
      console.log('⏰ Auto-refreshing remote updates data...')
      fetchRemoteUpdates()
    }, 10000) // 10 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(refreshInterval)
    }
  }, [project.id, user])

  const fetchRemoteUpdates = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get repositories from database
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data: repositories, error: repoError } = await supabase
        .from('repositories')
        .select(`
          id,
          name,
          full_name,
          url,
          local_mappings:repository_local_mappings(
            id,
            local_path,
            user_id
          )
        `)
        .eq('project_id', project.id)

      if (repoError) {
        console.error('Error fetching repositories:', repoError)
        setError('Failed to fetch repository information')
        return
      }

      console.log('📦 Fetched repositories for remote updates:', repositories)

      if (!repositories || repositories.length === 0) {
        setRemoteData([])
        return
      }

      // Get GitHub token for API requests
      let githubToken = null

      // First try to get token from Supabase session (user's GitHub OAuth token)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('📋 Session data:', {
          hasSession: !!session,
          hasProviderToken: !!session?.provider_token,
          hasProviderRefreshToken: !!session?.provider_refresh_token,
          provider: session?.user?.app_metadata?.provider,
          accessToken: session?.access_token ? '(exists)' : '(missing)'
        })

        if (session?.provider_token) {
          githubToken = session.provider_token
          console.log('🔑 Using GitHub provider_token from Supabase session')
        } else if (session?.access_token) {
          // Fallback to access_token if provider_token isn't available
          githubToken = session.access_token
          console.log('🔑 Using access_token from Supabase session (fallback)')
        }
      } catch (error) {
        console.warn('Could not get token from Supabase session:', error)
      }

      // Fallback to Electron API if available
      if (!githubToken && isElectron) {
        const electronAPI = (window as any).electronAPI
        if (electronAPI && electronAPI.getGitHubToken) {
          try {
            githubToken = await electronAPI.getGitHubToken()
            console.log('🔑 Using GitHub token from Electron API')

            // Test the token
            if (githubToken) {
              const tokenPreview = `${githubToken.substring(0, 4)}...${githubToken.substring(githubToken.length - 4)}`
              console.log(`🔐 Token preview: ${tokenPreview}, length: ${githubToken.length}`)

              // Test with GitHub API and check scopes
              try {
                const testResponse = await fetch('https://api.github.com/user', {
                  headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                  }
                })
                if (testResponse.ok) {
                  const userData = await testResponse.json()
                  console.log(`✅ Token valid! Authenticated as: ${userData.login}`)

                  // Check token scopes from headers
                  const scopes = testResponse.headers.get('X-OAuth-Scopes')
                  console.log(`🔍 Token scopes: ${scopes || '(none)'}`)

                  if (!scopes || !scopes.includes('repo')) {
                    console.warn('⚠️ Token missing "repo" scope for private repositories!')
                  }
                } else {
                  console.error(`❌ Token test failed: ${testResponse.status}`)
                }
              } catch (testError) {
                console.error('❌ Token test error:', testError)
              }
            }
          } catch (tokenError) {
            console.log('⚠️ Could not get GitHub token from Electron:', tokenError)
          }
        }
      }

      if (githubToken) {
        console.log('✅ GitHub token available for API requests')
      } else {
        console.warn('⚠️ No GitHub token available - API requests will be rate limited and private repos inaccessible')
      }

      const allRemoteData: RemoteRepositoryStatus[] = []

      // Fetch remote data for each repository
      for (const repo of repositories) {
        try {
          // Parse owner/repo from full_name
          const [owner, repoName] = repo.full_name.split('/')

          if (!owner || !repoName) {
            console.warn(`Invalid full_name format: ${repo.full_name}`)
            continue
          }

          console.log(`🌐 Fetching remote data for ${owner}/${repoName}`)
          console.log(`📍 Repository URL from database: ${repo.url}`)

          // Fetch repository info
          const headers: HeadersInit = {
            'Accept': 'application/vnd.github.v3+json'
          }
          if (githubToken) {
            headers['Authorization'] = `Bearer ${githubToken}`
          }

          // Get default branch info
          const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`
          console.log(`🔗 API URL: ${apiUrl}`)

          const repoResponse = await fetch(apiUrl, { headers })

          if (!repoResponse.ok) {
            console.error(`❌ Failed to fetch repo: ${repoResponse.status} ${repoResponse.statusText}`)
            console.error(`💡 Verify the repository exists at: https://github.com/${owner}/${repoName}`)
            console.error(`💡 Database has: full_name="${repo.full_name}", url="${repo.url}"`)
            continue
          }

          const repoInfo = await repoResponse.json()
          const defaultBranch = repoInfo.default_branch || 'main'

          // Fetch recent commits from default branch
          const commitsResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/commits?per_page=10&sha=${defaultBranch}`,
            { headers }
          )

          if (!commitsResponse.ok) {
            console.error(`Failed to fetch commits: ${commitsResponse.status}`)
            continue
          }

          const commits = await commitsResponse.json()

          // Fetch branches
          const branchesResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/branches`,
            { headers }
          )

          let branches: string[] = [defaultBranch]
          if (branchesResponse.ok) {
            const branchesData = await branchesResponse.json()
            branches = branchesData.map((b: any) => b.name)
          }

          // Map commits
          const recentCommits: RemoteCommit[] = commits.map((commit: any) => ({
            sha: commit.sha,
            message: commit.commit.message.split('\n')[0], // First line only
            author: {
              name: commit.commit.author.name,
              avatar_url: commit.author?.avatar_url,
              login: commit.author?.login || commit.commit.author.name
            },
            date: commit.commit.author.date,
            branch: defaultBranch,
            url: commit.html_url
          }))

          // Get local status if available
          const localStatus = []
          if (isElectron && repo.local_mappings && repo.local_mappings.length > 0) {
            for (const mapping of repo.local_mappings) {
              try {
                const electronAPI = (window as any).electronAPI
                if (electronAPI?.git?.readDirectGitState) {
                  const gitState = await electronAPI.git.readDirectGitState(mapping.local_path)

                  localStatus.push({
                    localPath: mapping.local_path,
                    currentBranch: gitState.branch || 'unknown',
                    ahead: gitState.ahead || 0,
                    behind: gitState.behind || 0,
                    hasLocalMapping: true
                  })
                }
              } catch (error) {
                console.warn(`Could not read git state for ${mapping.local_path}:`, error)
              }
            }
          }

          allRemoteData.push({
            repositoryName: repo.name,
            repositoryFullName: repo.full_name,
            repositoryUrl: repo.url,
            defaultBranch,
            recentCommits,
            branches,
            localStatus: localStatus.length > 0 ? localStatus : undefined
          })

        } catch (error) {
          console.error(`Error fetching remote data for ${repo.full_name}:`, error)
        }
      }

      console.log('📊 All remote data:', allRemoteData)

      // Compare with existing data to see if update is needed
      const hasChanges = JSON.stringify(allRemoteData) !== JSON.stringify(remoteData)

      if (hasChanges) {
        console.log('🔄 Remote data changed, updating UI')
        setRemoteData(allRemoteData)
      } else {
        console.log('✅ No remote changes detected, skipping update')
      }

    } catch (error) {
      console.error('Failed to fetch remote updates:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch remote updates')
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (date: string) => {
    const now = new Date()
    const commitDate = new Date(date)
    const diffMs = now.getTime() - commitDate.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return commitDate.toLocaleDateString()
  }

  if (loading && remoteData.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
        </div>
      </div>
    )
  }

  if (error && remoteData.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Fetching Remote Updates</h3>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (remoteData.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🌐</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Remote Repositories</h3>
          <p className="text-sm text-gray-500">
            Connect a GitHub repository to see remote updates
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gray-900 font-medium text-sm">Remote Repository Updates</h3>
            <p className="text-gray-500 text-xs mt-1">
              Latest commits and activity from GitHub
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-blue-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Monitoring Active</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {remoteData.map((repo, index) => (
          <div key={index} className="border border-gray-200 rounded-lg">
            {/* Repository Header */}
            <div className="border-b border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-gray-900">{repo.repositoryName}</h3>
                    <a
                      href={repo.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-xs"
                    >
                      View on GitHub ↗
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{repo.repositoryFullName}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-mono">
                    🔀 {repo.defaultBranch}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {repo.branches.length} branches
                  </span>
                </div>
              </div>
            </div>

            {/* Local Status */}
            {repo.localStatus && repo.localStatus.length > 0 && (
              <div className="border-b border-gray-200 bg-blue-50 p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Local Repository Status</h4>
                <div className="space-y-2">
                  {repo.localStatus.map((status, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600 font-mono text-xs truncate">
                          {status.localPath}
                        </span>
                        <span className="text-blue-600 bg-white px-2 py-0.5 rounded text-xs">
                          {status.currentBranch}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {status.ahead > 0 && (
                          <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">
                            ↑ {status.ahead} ahead
                          </span>
                        )}
                        {status.behind > 0 && (
                          <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs">
                            ↓ {status.behind} behind
                          </span>
                        )}
                        {status.ahead === 0 && status.behind === 0 && (
                          <span className="text-gray-500 bg-gray-50 px-2 py-1 rounded text-xs">
                            ✓ Up to date
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Commits */}
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Recent Commits ({repo.recentCommits.length})
              </h4>
              <div className="space-y-3">
                {repo.recentCommits.map((commit) => (
                  <div key={commit.sha} className="flex items-start space-x-3 pb-3 border-b border-gray-100 last:border-b-0">
                    {commit.author.avatar_url ? (
                      <img
                        src={commit.author.avatar_url}
                        alt={commit.author.name}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                        {commit.author.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 truncate">
                        {commit.message}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-600">
                          {commit.author.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(commit.date)}
                        </span>
                        <a
                          href={commit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          View commit ↗
                        </a>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      {commit.sha.substring(0, 7)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
