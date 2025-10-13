'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'

interface LocalChange {
  id: string
  filePath: string
  changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED' | 'UNTRACKED'
  status: string
  repository: string
  localPath: string
}

interface LocalCommit {
  sha: string
  message: string
  date: string
  branch: string
  author: {
    name: string
    email: string
  }
}

interface LocalChangesData {
  branch: string
  uncommittedChanges: LocalChange[]
  recentCommits: LocalCommit[]
  ahead: number
  behind: number
  dirty: boolean
  localPath: string
  repositoryName: string
}

interface LocalChangesPanelProps {
  project: any
}

export function LocalChangesPanel({ project }: LocalChangesPanelProps) {
  const { user } = useAuth()
  const [localChangesData, setLocalChangesData] = useState<LocalChangesData[]>([])
  const [loading, setLoading] = useState(false)

  // Check if we're in Electron environment
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI

  useEffect(() => {
    if (user && isElectron) {
      fetchLocalChanges()
    }
  }, [user, project.id, isElectron])

  const fetchLocalChanges = async () => {
    setLoading(true)
    try {
      // Get repository local mappings for current user only
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data: repositories, error: repoError } = await supabase
        .from('repositories')
        .select(`
          id,
          name,
          full_name,
          local_mappings:repository_local_mappings(
            id,
            local_path,
            user_id
          )
        `)
        .eq('project_id', project.id)

      if (repoError) {
        console.error('Error fetching repositories:', repoError)
        return
      }

      console.log('📦 Fetched repositories for local changes:', repositories)

      const allLocalChanges: LocalChangesData[] = []

      if (repositories && repositories.length > 0) {
        for (const repo of repositories) {
          if (repo.local_mappings && repo.local_mappings.length > 0) {
            // Filter to only current user's mappings
            const userMappings = repo.local_mappings.filter(
              (mapping: any) => mapping.user_id === user?.id
            )

            for (const mapping of userMappings) {
              try {
                console.log(`🔍 Reading local changes for ${mapping.local_path}`)

                // Check if path is accessible
                const electronAPI = (window as any).electronAPI
                if (!electronAPI?.git?.readDirectGitState) {
                  console.warn('Git API not available')
                  continue
                }

                // Get git state
                const gitState = await electronAPI.git.readDirectGitState(mapping.local_path)
                console.log(`📊 Git state for ${mapping.local_path}:`, gitState)

                // Get uncommitted changes
                const uncommittedChanges: LocalChange[] = []
                if (gitState.statusShort) {
                  // Parse git status output
                  const statusLines = gitState.statusShort.split('\n').filter((line: string) => line.trim())
                  statusLines.forEach((line: string, index: number) => {
                    const match = line.match(/^([A-Z?]{1,2})\s+(.+)$/)
                    if (match) {
                      const status = match[1]
                      const filePath = match[2]

                      let changeType: LocalChange['changeType'] = 'MODIFIED'
                      if (status.includes('A')) changeType = 'ADDED'
                      else if (status.includes('D')) changeType = 'DELETED'
                      else if (status.includes('R')) changeType = 'RENAMED'
                      else if (status.includes('?')) changeType = 'UNTRACKED'
                      else if (status.includes('M')) changeType = 'MODIFIED'

                      uncommittedChanges.push({
                        id: `${mapping.local_path}-${index}`,
                        filePath,
                        changeType,
                        status,
                        repository: repo.name,
                        localPath: mapping.local_path
                      })
                    }
                  })
                }

                // Get recent commits
                const recentCommits: LocalCommit[] = []
                if (electronAPI.git.readCompleteHistory) {
                  try {
                    const history = await electronAPI.git.readCompleteHistory(mapping.local_path, {
                      maxCommits: 5,
                      includeBranches: true,
                      includeStats: true
                    })

                    if (history && history.commits) {
                      history.commits.forEach((commit: any) => {
                        recentCommits.push({
                          sha: commit.sha,
                          message: commit.message,
                          date: commit.date,
                          branch: commit.branch || gitState.branch,
                          author: commit.author
                        })
                      })
                    }
                  } catch (historyError) {
                    console.warn('Could not read complete history:', historyError)
                  }
                }

                allLocalChanges.push({
                  branch: gitState.branch || 'main',
                  uncommittedChanges,
                  recentCommits,
                  ahead: gitState.ahead || 0,
                  behind: gitState.behind || 0,
                  dirty: gitState.dirty || uncommittedChanges.length > 0,
                  localPath: mapping.local_path,
                  repositoryName: repo.name
                })

              } catch (error) {
                console.error(`Error reading local changes for ${mapping.local_path}:`, error)
              }
            }
          }
        }
      }

      console.log('📊 All local changes:', allLocalChanges)
      setLocalChangesData(allLocalChanges)

    } catch (error) {
      console.error('Failed to fetch local changes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getChangeIcon = (changeType: LocalChange['changeType']) => {
    switch (changeType) {
      case 'ADDED': return '✅'
      case 'MODIFIED': return '📝'
      case 'DELETED': return '❌'
      case 'RENAMED': return '🔄'
      case 'UNTRACKED': return '❓'
      default: return '📄'
    }
  }

  const getChangeColor = (changeType: LocalChange['changeType']) => {
    switch (changeType) {
      case 'ADDED': return 'text-green-600'
      case 'MODIFIED': return 'text-blue-600'
      case 'DELETED': return 'text-red-600'
      case 'RENAMED': return 'text-purple-600'
      case 'UNTRACKED': return 'text-gray-500'
      default: return 'text-gray-600'
    }
  }

  const formatTimeAgo = (date: string) => {
    const now = new Date()
    const commitDate = new Date(date)
    const diffMs = now.getTime() - commitDate.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return commitDate.toLocaleDateString()
  }

  if (!isElectron) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">💻</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Electron Environment Required</h3>
          <p className="text-sm text-gray-500">
            Local changes can only be viewed in the Electron desktop application
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
        </div>
      </div>
    )
  }

  if (localChangesData.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">💻</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Local Repositories</h3>
          <p className="text-sm text-gray-500">
            Add a local folder mapping to see your local changes here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <div className="p-6 space-y-6">
        {localChangesData.map((data, index) => (
          <div key={index} className="border border-gray-200 rounded-lg">
            {/* Repository Header */}
            <div className="border-b border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{data.repositoryName}</h3>
                  <p className="text-xs text-gray-500 font-mono truncate mt-1">{data.localPath}</p>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded font-mono">
                    🔀 {data.branch}
                  </span>
                  {data.ahead > 0 && (
                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded">
                      ↑ {data.ahead} ahead
                    </span>
                  )}
                  {data.behind > 0 && (
                    <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded">
                      ↓ {data.behind} behind
                    </span>
                  )}
                  {data.dirty && (
                    <span className="text-red-600 bg-red-50 px-2 py-1 rounded">
                      • Uncommitted changes
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Uncommitted Changes */}
            {data.uncommittedChanges.length > 0 && (
              <div className="p-4 border-b border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Uncommitted Changes ({data.uncommittedChanges.length})
                </h4>
                <div className="space-y-2">
                  {data.uncommittedChanges.map((change) => (
                    <div key={change.id} className="flex items-center space-x-3 text-sm">
                      <span className="text-lg">{getChangeIcon(change.changeType)}</span>
                      <span className={`font-medium ${getChangeColor(change.changeType)}`}>
                        {change.changeType}
                      </span>
                      <span className="text-gray-600 font-mono flex-1 truncate">
                        {change.filePath}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {change.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Commits */}
            {data.recentCommits.length > 0 && (
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Recent Commits
                </h4>
                <div className="space-y-3">
                  {data.recentCommits.map((commit) => (
                    <div key={commit.sha} className="flex items-start space-x-3 pb-3 border-b border-gray-100 last:border-b-0">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">
                          {commit.message}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {commit.author.name}
                          </span>
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {commit.branch}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTimeAgo(commit.date)}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {commit.sha.substring(0, 7)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Changes */}
            {data.uncommittedChanges.length === 0 && data.recentCommits.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                No changes or commits found
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
