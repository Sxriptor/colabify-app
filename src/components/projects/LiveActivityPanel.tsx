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
    isElectron: isElectronFromHook,
    getTeamAwareness,
    getRecentActivities
  } = useGitMonitoring()

  const [activities, setActivities] = useState<LiveActivity[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)

  // Check if we're in Electron environment (use electronAPI instead of electron)
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI

  // Helper function to check if a local path is accessible
  const checkPathAccessibility = async (localPath: string): Promise<boolean> => {
    if (!isElectron) {
      console.log('❌ Not in Electron environment (electronAPI not found)')
      return false
    }

    try {
      const electronAPI = (window as any).electronAPI
      if (electronAPI && electronAPI.git && electronAPI.git.readDirectGitState) {
        const state = await electronAPI.git.readDirectGitState(localPath)
        console.log(`✅ Path ${localPath} is accessible, state:`, state)
        return true
      }
      console.log('❌ Git API not available')
      return false
    } catch (error) {
      console.log(`❌ Path ${localPath} is not accessible:`, error)
      return false
    }
  }

  // Helper function to read live git data from an accessible path
  const readLiveGitData = async (localPath: string) => {
    if (!isElectron) return null

    try {
      const electronAPI = (window as any).electronAPI
      if (electronAPI && electronAPI.git) {
        console.log(`🔍 Reading git state for ${localPath}`)

        // Get git state
        const gitState = await electronAPI.git.readDirectGitState(localPath)
        console.log(`📊 Git state:`, gitState)

        // Try to get complete history
        let recentCommits = []
        if (electronAPI.git.readCompleteHistory) {
          try {
            console.log(`📚 Reading complete history for ${localPath}`)
            const history = await electronAPI.git.readCompleteHistory(localPath, {
              maxCommits: 10,
              includeBranches: true,
              includeStats: true
            })
            console.log(`📜 History result:`, history)

            if (history && history.commits) {
              recentCommits = history.commits.slice(0, 5).map((commit: any) => ({
                sha: commit.sha,
                message: commit.message,
                date: commit.date,
                author: commit.author,
                branch: commit.branch
              }))
              console.log(`✅ Extracted ${recentCommits.length} recent commits`)
            }
          } catch (historyError) {
            console.warn('⚠️ Could not read complete history:', historyError)
          }
        } else {
          console.warn('⚠️ readCompleteHistory not available')
        }

        const result = {
          branch: gitState?.branch || 'main',
          head: gitState?.head,
          lastCommitMessage: recentCommits[0]?.message,
          lastActivity: recentCommits[0]?.date || new Date().toISOString(),
          lastModifiedFile: undefined,
          recentCommits
        }

        console.log(`📦 Final git data:`, result)
        return result
      }
      console.warn('⚠️ Git API not available')
      return null
    } catch (error) {
      console.error(`❌ Error reading live git data from ${localPath}:`, error)
      return null
    }
  }

  // Check if project is being watched (from database or Electron backend)
  const isWatchingInDatabase = project?.watches?.some((watch: any) => watch.user_id === user?.id) || false
  const isWatchingInBackend = isElectronFromHook ? status.watchedProjects.includes(project.id) : false
  const isWatching = isWatchingInDatabase || isWatchingInBackend

  console.log('🔍 Electron detection:', {
    isElectron: !!isElectron,
    isElectronFromHook: !!isElectronFromHook,
    hasElectronAPI: !!(window as any).electronAPI,
    hasGitAPI: !!((window as any).electronAPI?.git)
  })

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
      setLoading(true)
      try {
        // Get repository local mappings for the project
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
                user_id,
                user:users(id, name, email, avatar_url)
              )
            `)
            .eq('project_id', project.id)

          if (repoError) {
            console.error('Error fetching repositories:', repoError)
            loadMockData()
            return
          }

          console.log('📦 Fetched repositories:', repositories)

          // Check which local paths are accessible and fetch live data
          const teamData: TeamMember[] = []
          const activityData: LiveActivity[] = []

          if (repositories && repositories.length > 0) {
            for (const repo of repositories) {
              if (repo.local_mappings && repo.local_mappings.length > 0) {
                for (const mapping of repo.local_mappings) {
                  try {
                    const user = Array.isArray(mapping.user) ? mapping.user[0] : mapping.user
                    console.log(`🔍 Checking mapping for user ${user.name}:`, mapping.local_path)

                    // Check if we can access this local path
                    const isAccessible = await checkPathAccessibility(mapping.local_path)
                    console.log(`📍 Path ${mapping.local_path} accessible:`, isAccessible)

                    if (isAccessible && isElectron) {
                      // Use live .git data for accessible paths
                      const gitData = await readLiveGitData(mapping.local_path)
                      console.log(`📊 Git data for ${mapping.local_path}:`, gitData)

                      if (gitData) {
                        teamData.push({
                          userId: mapping.user_id,
                          userName: user.name || user.email,
                          status: 'active',
                          currentBranch: gitData.branch,
                          currentFile: gitData.lastModifiedFile,
                          lastCommitMessage: gitData.lastCommitMessage,
                          workingOn: gitData.lastCommitMessage || `Working on ${gitData.branch}`,
                          lastSeen: new Date(gitData.lastActivity),
                          isOnline: true
                        })

                        // Add recent commits as activities
                        if (gitData.recentCommits && gitData.recentCommits.length > 0) {
                          console.log(`💾 Adding ${gitData.recentCommits.length} commits to activities`)
                          gitData.recentCommits.forEach((commit: any) => {
                            activityData.push({
                              id: commit.sha,
                              userId: mapping.user_id,
                              userName: user.name || user.email,
                              activityType: 'COMMIT',
                              activityData: { subject: commit.message },
                              branchName: commit.branch || gitData.branch,
                              commitHash: commit.sha,
                              occurredAt: new Date(commit.date)
                            })
                          })
                        }
                      } else {
                        console.warn(`⚠️ No git data returned for ${mapping.local_path}`)
                      }
                    } else {
                      console.log(`📝 Using fallback data for inaccessible path ${mapping.local_path}`)
                      // Use repository_local_mappings data for inaccessible paths
                      teamData.push({
                        userId: mapping.user_id,
                        userName: user.name || user.email,
                        status: 'away',
                        currentBranch: undefined,
                        workingOn: `Working on ${repo.name}`,
                        lastSeen: new Date(),
                        isOnline: false
                      })
                    }
                  } catch (error) {
                    console.error(`Error processing mapping for ${mapping.local_path}:`, error)
                    // Fall back to basic info from database
                    const user = Array.isArray(mapping.user) ? mapping.user[0] : mapping.user
                    teamData.push({
                      userId: mapping.user_id,
                      userName: user.name || user.email,
                      status: 'away',
                      workingOn: `Working on ${repo.name}`,
                      lastSeen: new Date(),
                      isOnline: false
                    })
                  }
                }
              }
            }
          }

          // If using Electron backend and it's running, also get backend data
          if (isElectronFromHook && status.isRunning && isWatchingInBackend) {
            try {
              const [backendTeamData, backendActivityData] = await Promise.all([
                getTeamAwareness(project.id),
                getRecentActivities(project.id, 20)
              ])

              // Merge backend data with database data, preferring more detailed backend data
              backendTeamData.forEach(member => {
                const existingIndex = teamData.findIndex(m => m.userId === member.userId)
                if (existingIndex >= 0) {
                  // Update existing member with more detailed backend data
                  teamData[existingIndex] = {
                    ...teamData[existingIndex],
                    ...member,
                    // Keep userName from database if backend doesn't have it
                    userName: member.userName || teamData[existingIndex].userName
                  }
                } else {
                  teamData.push(member)
                }
              })

              backendActivityData.forEach(activity => {
                if (!activityData.find(a => a.id === activity.id)) {
                  activityData.push(activity)
                }
              })
            } catch (error) {
              console.error('Failed to fetch backend data:', error)
            }
          }

          // Deduplicate team members by userId (just in case)
          const uniqueTeamData = Array.from(
            new Map(teamData.map(member => [member.userId, member])).values()
          )

          // Sort activities by date
          activityData.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())

          // Compare with existing data to see if update is needed
        const hasChanges =
          JSON.stringify(uniqueTeamData) !== JSON.stringify(teamMembers) ||
          JSON.stringify(activityData.slice(0, 20)) !== JSON.stringify(activities)

        if (hasChanges) {
          console.log('🔄 Data changed, updating UI')
          setTeamMembers(uniqueTeamData)
          setActivities(activityData.slice(0, 20))
        } else {
          console.log('✅ No changes detected, skipping update')
        }

        // If no data found, load mock data
        if (uniqueTeamData.length === 0 && activityData.length === 0) {
          loadMockData()
        }
      } catch (error) {
        console.error('Failed to fetch live data:', error)
        loadMockData()
      } finally {
        setLoading(false)
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

    // Initial fetch
    if (!isWatching) {
      setActivities([])
      setTeamMembers([])
      return
    }

    fetchData()

    // Set up auto-refresh every 10 seconds
    const refreshInterval = setInterval(() => {
      console.log('⏰ Auto-refreshing user activity data...')
      fetchData()
    }, 10000) // 10 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(refreshInterval)
    }
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
                        <span className="text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded font-mono">
                          🔀 {member.currentBranch}
                        </span>
                      )}
                    </div>
                    {member.lastCommitMessage && (
                      <div className="text-gray-700 text-xs truncate mt-1">
                        💬 {member.lastCommitMessage}
                      </div>
                    )}
                    {member.currentFile && (
                      <div className="text-gray-500 text-xs truncate mt-1">
                        📄 {member.currentFile}
                      </div>
                    )}
                    {!member.lastCommitMessage && !member.currentFile && (
                      <div className="text-gray-600 text-xs truncate mt-1">
                        {member.workingOn || 'Active'}
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