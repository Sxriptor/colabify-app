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

interface TeamMember {
  userId: string
  userName: string
  status: string
  currentBranch?: string
  currentFile?: string
  lastCommitMessage?: string
  workingOn?: string
  lastSeen: Date
  isOnline: boolean
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

  // Transform unified data into LiveActivity format
  const activities = useMemo<LiveActivity[]>(() => {
    const result: LiveActivity[] = []

    // Get user info from branches (which includes user data)
    const userMap = new Map()
    branches.forEach(branch => {
      if (branch.user) {
        userMap.set(branch.path, branch.user)
      }
    })

    // Transform commits into activities
    commits.slice(0, 20).forEach((commit, index) => {
      // Try to find user from branches or users array
      const branchForCommit = branches.find(b =>
        commit.branch === b.branch ||
        b.history?.commits?.some((c: any) => c.sha === commit.sha)
      )

      const userName = commit.author.name || commit.author.email
      const userId = commit.author.email || `user-${index}`

      result.push({
        id: commit.sha,
        userId,
        userName,
        activityType: 'COMMIT',
        activityData: { subject: commit.message },
        branchName: commit.branch || 'main',
        commitHash: commit.sha,
        occurredAt: new Date(commit.date)
      })
    })

    return result.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
  }, [commits, branches])

  // Transform unified data into TeamMember format
  const teamMembers = useMemo<TeamMember[]>(() => {
    const memberMap = new Map<string, TeamMember>()

    // Create team members from branches (one per user)
    branches.forEach(branch => {
      if (!branch.user) return

      const userId = branch.user.id || branch.user.email
      const userName = branch.user.name || branch.user.email

      // Get most recent commit for this branch
      const branchCommits = commits.filter(c => c.branch === branch.branch)
      const lastCommit = branchCommits[0]

      if (!memberMap.has(userId)) {
        memberMap.set(userId, {
          userId,
          userName,
          status: 'active',
          currentBranch: branch.branch,
          currentFile: undefined,
          lastCommitMessage: lastCommit?.message,
          workingOn: lastCommit?.message || `Working on ${branch.branch}`,
          lastSeen: lastCommit ? new Date(lastCommit.date) : new Date(),
          isOnline: true
        })
      }
    })

    // Also add users from the users array
    users.forEach(u => {
      if (!memberMap.has(u.userId)) {
        const userCommits = commits.filter(c => c.author.email === u.userEmail)
        const lastCommit = userCommits[0]

        memberMap.set(u.userId, {
          userId: u.userId,
          userName: u.userName,
          status: u.status,
          currentBranch: u.currentBranch,
          currentFile: undefined,
          lastCommitMessage: lastCommit?.message,
          workingOn: lastCommit?.message || `Working on ${u.currentBranch}`,
          lastSeen: lastCommit ? new Date(lastCommit.date) : new Date(),
          isOnline: u.status === 'active'
        })
      }
    })

    return Array.from(memberMap.values())
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
  }, [branches, users, commits])

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

  if (gitLoading && activities.length === 0) {
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

        {/* Team Members Section */}
        {teamMembers.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Team Activity</h3>
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.userId} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full mt-2 ${member.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900">{member.userName}</div>
                      <div className="text-xs text-gray-500">{formatTimeAgo(member.lastSeen)}</div>
                    </div>
                    {member.currentBranch && (
                      <div className="text-xs text-blue-600 mt-1">
                        🔀 {member.currentBranch}
                      </div>
                    )}
                    {member.workingOn && (
                      <div className="text-xs text-gray-600 mt-1 truncate">
                        {member.workingOn}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activities */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Activity</h3>
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Activity</h3>
              <p className="text-sm text-gray-500">
                Activity will appear here once team members start working
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="text-lg flex-shrink-0">{getActivityIcon(activity.activityType)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900">{activity.userName}</div>
                      <div className="text-xs text-gray-500">{formatTimeAgo(activity.occurredAt)}</div>
                    </div>
                    <div className="text-sm text-gray-600 mt-1 truncate">
                      {activity.activityData?.subject || 'Activity'}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
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
          )}
        </div>
      </div>
    </div>
  )
}
