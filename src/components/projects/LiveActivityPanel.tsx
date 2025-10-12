'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useGitMonitoring } from '@/hooks/useGitMonitoring'

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
  const { user } = useAuth()
  const { 
    status, 
    isElectron,
    getTeamAwareness,
    getRecentActivities 
  } = useGitMonitoring()
  
  const [activities, setActivities] = useState<LiveActivity[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)

  // Check if project is being watched (from database or Electron backend)
  const isWatchingInDatabase = project?.watches?.some((watch: any) => watch.user_id === user?.id) || false
  const isWatchingInBackend = isElectron ? status.watchedProjects.includes(project.id) : false
  const isWatching = isWatchingInDatabase || isWatchingInBackend

  // Debug logging
  useEffect(() => {
    console.log('LiveActivityPanel Debug:', {
      projectId: project.id,
      userId: user?.id,
      watches: project?.watches,
      watchesDetails: project?.watches?.map((w: any) => ({ 
        id: w.id, 
        user_id: w.user_id, 
        matches: w.user_id === user?.id 
      })),
      isWatchingInDatabase,
      isWatchingInBackend,
      isWatching,
      isElectron,
      backendStatus: status
    })
  }, [project.id, user?.id, project?.watches, isWatchingInDatabase, isWatchingInBackend, isWatching, isElectron, status])

  // Fetch real data when watching or use mock data
  useEffect(() => {
    const fetchData = async () => {
      if (isWatching) {
        if (isElectron && status.isRunning && isWatchingInBackend) {
          // Use real data from Electron backend
          setLoading(true)
          try {
            const [teamData, activityData] = await Promise.all([
              getTeamAwareness(project.id),
              getRecentActivities(project.id, 20)
            ])
            
            setTeamMembers(teamData)
            setActivities(activityData)
          } catch (error) {
            console.error('Failed to fetch live data:', error)
            // Fall back to mock data
            loadMockData()
          } finally {
            setLoading(false)
          }
        } else {
          // Use mock data when watching but backend not available
          loadMockData()
        }
      } else {
        setActivities([])
        setTeamMembers([])
      }
    }

    const loadMockData = () => {
      // Simulate live activities
      const mockActivities: LiveActivity[] = [
        {
          id: '1',
          userId: user?.id || '',
          userName: (user as any)?.name || user?.email || 'You',
          activityType: 'COMMIT',
          activityData: { subject: 'Fix cluster view node titles and overflow' },
          branchName: 'feature/cluster-fixes',
          commitHash: 'abc123',
          occurredAt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
        },
        {
          id: '2',
          userId: 'other-user',
          userName: 'Sarah Chen',
          activityType: 'BRANCH_SWITCH',
          activityData: { from: 'main', to: 'feature/live-activity' },
          branchName: 'feature/live-activity',
          occurredAt: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
        },
        {
          id: '3',
          userId: 'other-user-2',
          userName: 'Mike Johnson',
          activityType: 'FILE_CHANGE',
          activityData: { filePath: 'src/components/Dashboard.tsx', changeType: 'MODIFIED' },
          branchName: 'main',
          filePath: 'src/components/Dashboard.tsx',
          occurredAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
        }
      ]

      const mockTeamMembers: TeamMember[] = [
        {
          userId: user?.id || '',
          userName: (user as any)?.name || user?.email || 'You',
          status: 'active',
          currentBranch: 'feature/cluster-fixes',
          currentFile: 'src/components/projects/repovisual/local/CommitBubbles.tsx',
          workingOn: 'Fixing cluster view issues',
          lastSeen: new Date(),
          isOnline: true
        },
        {
          userId: 'other-user',
          userName: 'Sarah Chen',
          status: 'active',
          currentBranch: 'feature/live-activity',
          currentFile: 'src/main/services/LiveActivityMonitor.ts',
          workingOn: 'Building live activity monitoring',
          lastSeen: new Date(Date.now() - 2 * 60 * 1000),
          isOnline: true
        },
        {
          userId: 'other-user-2',
          userName: 'Mike Johnson',
          status: 'away',
          currentBranch: 'main',
          workingOn: 'Code review',
          lastSeen: new Date(Date.now() - 10 * 60 * 1000),
          isOnline: false
        }
      ]

      setActivities(mockActivities)
      setTeamMembers(mockTeamMembers)
    }

    fetchData()
  }, [isWatching, user, isElectron, status.isRunning, project.id, getTeamAwareness, getRecentActivities])



  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'COMMIT':
        return '📝'
      case 'BRANCH_SWITCH':
        return '🔀'
      case 'FILE_CHANGE':
        return '📄'
      case 'PUSH':
        return '⬆️'
      case 'PULL':
        return '⬇️'
      default:
        return '🔄'
    }
  }

  const getActivityDescription = (activity: LiveActivity) => {
    switch (activity.activityType) {
      case 'COMMIT':
        return `committed "${activity.activityData.subject}"`
      case 'BRANCH_SWITCH':
        return `switched from ${activity.activityData.from} to ${activity.activityData.to}`
      case 'FILE_CHANGE':
        return `${activity.activityData.changeType.toLowerCase()} ${activity.filePath}`
      case 'PUSH':
        return `pushed to ${activity.branchName}`
      default:
        return activity.activityType.toLowerCase().replace('_', ' ')
    }
  }

  const getStatusColor = (status: string, isOnline: boolean) => {
    if (!isOnline) return 'bg-gray-500'
    switch (status) {
      case 'active':
        return 'bg-green-500'
      case 'away':
        return 'bg-yellow-500'
      case 'coding':
        return 'bg-blue-500'
      case 'reviewing':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-white">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gray-900 font-medium text-sm">Live Team Activity</h3>
            <p className="text-gray-500 text-xs mt-1">
              Real-time developer activity and team awareness
            </p>
          </div>
          {isWatching && (
            <div className="flex items-center space-x-2 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Monitoring Active</span>
            </div>
          )}
        </div>
      </div>

      {!isWatching ? (
        <div className="p-6 text-center">
          <div className="text-gray-500 text-sm mb-4">
            Project Monitoring Disabled
          </div>
          <p className="text-gray-400 text-xs">
            Enable watching on the project card to see live team activity and file changes
          </p>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Team Awareness */}
          <div>
            <h4 className="text-gray-900 font-medium text-sm mb-3 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Team Status ({teamMembers.filter(m => m.isOnline).length} online)
            </h4>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div key={member.userId} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(member.status, member.isOnline)}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-900 text-sm font-medium">
                        {member.userName}
                      </span>
                      {member.currentBranch && (
                        <span className="text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded">
                          {member.currentBranch}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-600 text-xs truncate">
                      {member.workingOn || 'Active'}
                    </div>
                    {member.currentFile && (
                      <div className="text-gray-500 text-xs truncate">
                        📄 {member.currentFile}
                      </div>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {formatTimeAgo(member.lastSeen)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activities */}
          <div>
            <h4 className="text-gray-900 font-medium text-sm mb-3">Recent Activities</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activities.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No recent activity
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border">
                    <span className="text-lg">{getActivityIcon(activity.activityType)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-900 text-sm font-medium">
                          {activity.userName}
                        </span>
                        <span className="text-gray-600 text-sm">
                          {getActivityDescription(activity)}
                        </span>
                      </div>
                      {activity.branchName && (
                        <div className="text-blue-600 text-xs">
                          on {activity.branchName}
                        </div>
                      )}
                      {activity.commitHash && (
                        <div className="text-gray-500 text-xs">
                          {activity.commitHash.substring(0, 8)}
                        </div>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {formatTimeAgo(activity.occurredAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Status Indicator */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600">Monitoring Active</span>
              </div>
              <div className="text-gray-500">
                Last sync: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}