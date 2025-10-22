'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useGitMonitoring } from '@/hooks/useGitMonitoring'
import { useUnifiedGitData } from '@/hooks/useUnifiedGitData'

interface LiveActivity {
  id: string
  userId: string
  activityType: string
  activityData: any
  branchName?: string
  commitHash?: string
  filePath?: string
  occurredAt: Date
  userName?: string
}

interface LiveActivityPanelProps {
  project: any
}

export function LiveActivityPanel({ project }: LiveActivityPanelProps) {
  console.log("🔥🔥🔥 NEW LiveActivityPanel is running! Using useUnifiedGitData")
  const { user } = useAuth()
  const {
    status,
    isElectron: isElectronFromHook
  } = useGitMonitoring()

  // ✅ USE UNIFIED GIT DATA HOOK - Single source of truth
  const {
    branches,
    commits,
    users,
    loading: gitLoading
  } = useUnifiedGitData({
    projectId: project.id,
    userId: user?.id,
    autoRefresh: true,
    refreshIntervalMs: 5000
  })

  // Check if we're in Electron environment
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI

  // Check if project is being watched
  const isWatchingInDatabase = project?.watches?.some((watch: any) => watch.user_id === user?.id) || false
  const isWatchingInBackend = isElectronFromHook ? status.watchedProjects.includes(project.id) : false
  const isWatching = isWatchingInDatabase || isWatchingInBackend

  // Group commits by user with their recent activities
  const userActivities = useMemo(() => {
    const userMap = new Map<string, {
      userId: string
      userName: string
      userEmail: string
      activities: LiveActivity[]
      lastActivity: Date
      isOnline: boolean
      currentBranch?: string
    }>()

    // Process all commits and group by user
    commits.forEach((commit, index) => {
      const userName = commit.author.name || commit.author.email
      const userEmail = commit.author.email || `user-${index}@unknown`
      const userId = userEmail

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          userName,
          userEmail,
          activities: [],
          lastActivity: new Date(commit.date),
          isOnline: true,
          currentBranch: commit.branch
        })
      }

      const user = userMap.get(userId)!

      // Add activity
      user.activities.push({
        id: commit.sha,
        userId,
        userName,
        activityType: 'COMMIT',
        activityData: { subject: commit.message },
        branchName: commit.branch || 'main',
        commitHash: commit.sha,
        occurredAt: new Date(commit.date)
      })

      // Update last activity if this is more recent
      const commitDate = new Date(commit.date)
      if (commitDate > user.lastActivity) {
        user.lastActivity = commitDate
        user.currentBranch = commit.branch
      }
    })

    // Sort activities within each user by date (most recent first)
    userMap.forEach(user => {
      user.activities.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      // Limit to 10 most recent activities per user
      user.activities = user.activities.slice(0, 10)
    })

    // Convert to array and sort by most recent activity
    return Array.from(userMap.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
  }, [commits, branches])


  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Get activity icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'COMMIT': return '💾'
      case 'PUSH': return '⬆️'
      case 'PULL': return '⬇️'
      case 'BRANCH': return '🌿'
      case 'TAG': return '🏷️'
      default: return '📝'
    }
  }

  if (!isElectron) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">💻</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Electron Environment Required</h3>
          <p className="text-sm text-gray-500">
            Live activity tracking is only available in the Electron desktop application
          </p>
        </div>
      </div>
    )
  }

  if (gitLoading && userActivities.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <div className="p-6">
        {/* Watching Status */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isWatching ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {isWatching ? 'Live Activity Tracking Active' : 'Not Watching'}
                </div>
                <div className="text-xs text-gray-500">
                  {isWatching
                    ? 'Real-time updates from local repositories'
                    : 'Enable watching to see live activity'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Activity Sections */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4">Team Activity</h3>
          {userActivities.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Activity</h3>
              <p className="text-sm text-gray-500">
                Activity will appear here once team members start working
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {userActivities.map((userActivity) => (
                <div key={userActivity.userId} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* User Header */}
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${userActivity.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{userActivity.userName}</div>
                          <div className="text-xs text-gray-500">{userActivity.userEmail}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {userActivity.currentBranch && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded font-medium">
                            🔀 {userActivity.currentBranch}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(userActivity.lastActivity)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* User's Recent Activities */}
                  <div className="divide-y divide-gray-100">
                    {userActivity.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="text-lg flex-shrink-0 mt-0.5">{getActivityIcon(activity.activityType)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">{formatTimeAgo(activity.occurredAt)}</span>
                          </div>
                          <div className="text-sm text-gray-900 mb-2">
                            {activity.activityData?.subject || 'Activity'}
                          </div>
                          <div className="flex items-center space-x-2">
                            {activity.branchName && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                {activity.branchName}
                              </span>
                            )}
                            {activity.commitHash && (
                              <span className="text-xs text-gray-500 font-mono">
                                {activity.commitHash.substring(0, 7)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Activity Count Footer */}
                  <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-center">
                    <span className="text-xs text-gray-600">
                      {userActivity.activities.length} recent {userActivity.activities.length === 1 ? 'commit' : 'commits'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
