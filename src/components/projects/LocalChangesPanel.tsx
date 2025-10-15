'use client'

import { useMemo } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useUnifiedGitData } from '@/hooks/useUnifiedGitData'

interface LocalChangesData {
  branch: string
  uncommittedChanges: Array<{
    id: string
    filePath: string
    changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED' | 'UNTRACKED'
    status: string
  }>
  recentCommits: Array<{
    sha: string
    message: string
    date: string
    branch: string
    author: { name: string; email: string }
  }>
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

  // ✅ USE UNIFIED GIT DATA HOOK - Single source of truth
  const {
    branches,
    commits,
    uncommittedChanges,
    loading,
    usingCache
  } = useUnifiedGitData({
    projectId: project.id,
    userId: user?.id,
    autoRefresh: true,
    refreshIntervalMs: 5000 // Check for changes every 5 seconds
  })

  // Check if we're in Electron environment
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI

  // Transform unified data into LocalChangesData format
  const localChangesData = useMemo<LocalChangesData[]>(() => {
    const result: LocalChangesData[] = []

    for (const branch of branches) {
      // Get recent commits for this branch/repo
      const recentCommits = commits
        .filter(c => c.branch === branch.branch || !c.branch)
        .slice(0, 5)
        .map(c => ({
          sha: c.sha,
          message: c.message,
          date: c.date,
          branch: c.branch || branch.branch,
          author: c.author
        }))

      // Get uncommitted changes for this repo
      const repoUncommittedChanges = uncommittedChanges
        .filter(change => change.localPath === branch.path)
        .map(change => ({
          id: change.id,
          filePath: change.filePath,
          changeType: change.changeType,
          status: change.status
        }))

      result.push({
        branch: branch.branch,
        uncommittedChanges: repoUncommittedChanges,
        recentCommits,
        ahead: branch.ahead,
        behind: branch.behind,
        dirty: branch.dirty || repoUncommittedChanges.length > 0,
        localPath: branch.path,
        repositoryName: branch.name
      })
    }

    return result
  }, [branches, commits, uncommittedChanges])

  const getChangeIcon = (changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED' | 'UNTRACKED') => {
    switch (changeType) {
      case 'ADDED': return '✅'
      case 'MODIFIED': return '📝'
      case 'DELETED': return '❌'
      case 'RENAMED': return '🔄'
      case 'UNTRACKED': return '❓'
      default: return '📄'
    }
  }

  const getChangeColor = (changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED' | 'UNTRACKED') => {
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
