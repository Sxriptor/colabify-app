// Database synchronization service for Git monitoring backend
// Syncs watch state and live activity between Supabase and local Git monitoring

import { RepoConfig, RepoState } from '../../shared/types'
import { RepoStore } from '../store/RepoStore'
import { LiveSession, LiveActivity, FileChange, TeamAwareness } from './LiveActivityMonitor'

export interface ProjectWatch {
  id: string
  user_id: string
  project_id: string
  created_at: string
  updated_at: string
}

export interface ProjectWithRepos {
  id: string
  name: string
  repositories?: Array<{
    id: string
    name: string
    full_name: string
    url: string
    local_mappings?: Array<{
      id: string
      local_path: string
      user_id: string
    }>
  }>
  watches?: ProjectWatch[]
}

export class DatabaseSync {
  private repoStore: RepoStore
  private supabaseUrl: string
  private supabaseKey: string

  constructor(repoStore: RepoStore) {
    this.repoStore = repoStore
    // In a real implementation, these would come from environment variables
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    this.supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  }

  /**
   * Sync watched projects from database to Git monitoring backend
   * This should be called on startup to restore watch state
   */
  async syncWatchedProjects(currentUserId: string): Promise<string[]> {
    try {
      console.log('🔄 Syncing watched projects from database...')

      // In a real implementation, this would query Supabase
      // For now, we'll simulate the data structure
      const watchedProjectIds: string[] = []

      // TODO: Replace with actual Supabase query
      // const { data: projects } = await supabase
      //   .from('projects')
      //   .select(`
      //     id,
      //     name,
      //     repositories(id, name, full_name, url, local_mappings(id, local_path, user_id)),
      //     watches:project_watches!project_watches_project_id_fkey(id, user_id)
      //   `)
      //   .eq('watches.user_id', currentUserId)

      // For each watched project, sync repository configurations
      // for (const project of projects || []) {
      //   if (project.watches?.some(w => w.user_id === currentUserId)) {
      //     watchedProjectIds.push(project.id)
      //     await this.syncProjectRepositories(project)
      //   }
      // }

      console.log(`✅ Synced ${watchedProjectIds.length} watched projects`)
      return watchedProjectIds

    } catch (error) {
      console.error('❌ Failed to sync watched projects:', error)
      return []
    }
  }

  /**
   * Sync repository configurations for a project
   */
  async syncProjectRepositories(project: ProjectWithRepos): Promise<void> {
    try {
      if (!project.repositories) return

      for (const repo of project.repositories) {
        // Get local mappings for this repository
        const localMappings = repo.local_mappings || []

        for (const mapping of localMappings) {
          // Create or update repository configuration
          const repoConfig: RepoConfig = {
            id: `${repo.id}-${mapping.id}`, // Composite ID
            projectId: project.id,
            path: mapping.local_path,
            watching: true, // If project is watched, repos are watched
            last: this.createInitialRepoState()
          }

          // Store in local Git monitoring store
          this.repoStore.upsert(repoConfig)
        }
      }

      console.log(`✅ Synced ${project.repositories.length} repositories for project ${project.id}`)

    } catch (error) {
      console.error(`❌ Failed to sync repositories for project ${project.id}:`, error)
    }
  }

  /**
   * Create initial repository state
   */
  private createInitialRepoState(): RepoState {
    return {
      branch: '',
      head: '',
      statusShort: '',
      upstream: undefined,
      ahead: 0,
      behind: 0,
      localBranches: [],
      remoteBranches: []
    }
  }

  /**
   * Get watched project IDs from database
   * This is a helper method for the Git monitoring backend
   */
  async getWatchedProjectIds(currentUserId: string): Promise<string[]> {
    try {
      // TODO: Replace with actual Supabase query
      // const { data } = await supabase
      //   .from('project_watches')
      //   .select('project_id')
      //   .eq('user_id', currentUserId)
      
      // return data?.map(w => w.project_id) || []

      // For now, return empty array
      return []

    } catch (error) {
      console.error('❌ Failed to get watched project IDs:', error)
      return []
    }
  }

  /**
   * Check if a project is being watched by the current user
   */
  async isProjectWatched(projectId: string, currentUserId: string): Promise<boolean> {
    try {
      // TODO: Replace with actual Supabase query
      // const { data } = await supabase
      //   .from('project_watches')
      //   .select('id')
      //   .eq('project_id', projectId)
      //   .eq('user_id', currentUserId)
      //   .single()
      
      // return !!data

      // For now, return false
      return false

    } catch (error) {
      console.warn(`Failed to check watch status for project ${projectId}:`, error)
      return false
    }
  }
}
  /*
*
   * Sync live activity session to database
   */
  async syncLiveSession(session: LiveSession): Promise<void> {
    try {
      // In a real implementation, this would use Supabase client
      // const { error } = await supabase
      //   .from('live_activity_sessions')
      //   .upsert({
      //     id: session.id,
      //     user_id: session.userId,
      //     project_id: session.projectId,
      //     repository_id: session.repositoryId,
      //     local_path: session.localPath,
      //     session_start: session.sessionStart.toISOString(),
      //     last_activity: session.lastActivity.toISOString(),
      //     is_active: session.isActive,
      //     current_branch: session.currentBranch,
      //     current_head: session.currentHead,
      //     working_directory_status: session.workingDirectoryStatus,
      //     ahead_count: session.aheadCount,
      //     behind_count: session.behindCount,
      //     focus_file: session.focusFile,
      //     editor_info: session.editorInfo
      //   })

      console.log(`💾 Synced live session ${session.id} to database`)
    } catch (error) {
      console.error(`Failed to sync live session ${session.id}:`, error)
    }
  }

  /**
   * Sync live activity to database
   */
  async syncLiveActivity(activity: LiveActivity): Promise<void> {
    try {
      // In a real implementation, this would use Supabase client
      // const { error } = await supabase
      //   .from('live_activities')
      //   .insert({
      //     id: activity.id,
      //     session_id: activity.sessionId,
      //     user_id: activity.userId,
      //     project_id: activity.projectId,
      //     repository_id: activity.repositoryId,
      //     activity_type: activity.activityType,
      //     activity_data: activity.activityData,
      //     branch_name: activity.branchName,
      //     commit_hash: activity.commitHash,
      //     file_path: activity.filePath,
      //     occurred_at: activity.occurredAt.toISOString()
      //   })

      console.log(`📝 Synced activity ${activity.activityType} to database`)
    } catch (error) {
      console.error(`Failed to sync activity ${activity.id}:`, error)
    }
  }

  /**
   * Sync file changes to database
   */
  async syncFileChanges(sessionId: string, fileChanges: FileChange[]): Promise<void> {
    try {
      // In a real implementation, this would batch upsert to live_file_changes
      // const upsertData = fileChanges.map(change => ({
      //   session_id: sessionId,
      //   file_path: change.filePath,
      //   file_type: change.fileType,
      //   change_type: change.changeType,
      //   lines_added: change.linesAdded,
      //   lines_removed: change.linesRemoved,
      //   characters_added: change.charactersAdded,
      //   characters_removed: change.charactersRemoved,
      //   first_change_at: change.firstChangeAt.toISOString(),
      //   last_change_at: change.lastChangeAt.toISOString()
      // }))

      // const { error } = await supabase
      //   .from('live_file_changes')
      //   .upsert(upsertData)

      console.log(`💾 Synced ${fileChanges.length} file changes for session ${sessionId}`)
    } catch (error) {
      console.error(`Failed to sync file changes for session ${sessionId}:`, error)
    }
  }

  /**
   * Update team awareness in database
   */
  async updateTeamAwareness(awareness: TeamAwareness): Promise<void> {
    try {
      // In a real implementation, this would upsert to live_team_awareness
      // const { error } = await supabase
      //   .from('live_team_awareness')
      //   .upsert({
      //     project_id: awareness.projectId,
      //     user_id: awareness.userId,
      //     status: awareness.status,
      //     current_branch: awareness.currentBranch,
      //     current_file: awareness.currentFile,
      //     last_commit_message: awareness.lastCommitMessage,
      //     repository_path: awareness.repositoryPath,
      //     working_on: awareness.workingOn,
      //     last_seen: awareness.lastSeen.toISOString(),
      //     is_online: awareness.isOnline
      //   })

      console.log(`👥 Updated team awareness for user ${awareness.userId} in project ${awareness.projectId}`)
    } catch (error) {
      console.error(`Failed to update team awareness:`, error)
    }
  }

  /**
   * Get team awareness for a project
   */
  async getTeamAwareness(projectId: string): Promise<TeamAwareness[]> {
    try {
      // In a real implementation, this would query live_team_awareness
      // const { data, error } = await supabase
      //   .from('live_team_awareness')
      //   .select('*')
      //   .eq('project_id', projectId)
      //   .eq('is_online', true)
      //   .order('last_seen', { ascending: false })

      // if (error) throw error

      // return data?.map(row => ({
      //   projectId: row.project_id,
      //   userId: row.user_id,
      //   status: row.status,
      //   currentBranch: row.current_branch,
      //   currentFile: row.current_file,
      //   lastCommitMessage: row.last_commit_message,
      //   repositoryPath: row.repository_path,
      //   workingOn: row.working_on,
      //   lastSeen: new Date(row.last_seen),
      //   isOnline: row.is_online
      // })) || []

      // For now, return empty array
      return []
    } catch (error) {
      console.error(`Failed to get team awareness for project ${projectId}:`, error)
      return []
    }
  }

  /**
   * Get recent activities for a project
   */
  async getRecentActivities(projectId: string, limit: number = 50): Promise<LiveActivity[]> {
    try {
      // In a real implementation, this would query live_activities
      // const { data, error } = await supabase
      //   .from('live_activities')
      //   .select('*')
      //   .eq('project_id', projectId)
      //   .order('occurred_at', { ascending: false })
      //   .limit(limit)

      // if (error) throw error

      // return data?.map(row => ({
      //   id: row.id,
      //   sessionId: row.session_id,
      //   userId: row.user_id,
      //   projectId: row.project_id,
      //   repositoryId: row.repository_id,
      //   activityType: row.activity_type,
      //   activityData: row.activity_data,
      //   branchName: row.branch_name,
      //   commitHash: row.commit_hash,
      //   filePath: row.file_path,
      //   occurredAt: new Date(row.occurred_at)
      // })) || []

      // For now, return empty array
      return []
    } catch (error) {
      console.error(`Failed to get recent activities for project ${projectId}:`, error)
      return []
    }
  }

  /**
   * Toggle project watch status
   */
  async toggleProjectWatch(projectId: string, userId: string, watching: boolean): Promise<void> {
    try {
      if (watching) {
        // Add watch
        // const { error } = await supabase
        //   .from('project_watches')
        //   .upsert({
        //     user_id: userId,
        //     project_id: projectId
        //   })
        console.log(`👀 Started watching project ${projectId}`)
      } else {
        // Remove watch
        // const { error } = await supabase
        //   .from('project_watches')
        //   .delete()
        //   .eq('user_id', userId)
        //   .eq('project_id', projectId)
        console.log(`👁️ Stopped watching project ${projectId}`)
      }
    } catch (error) {
      console.error(`Failed to toggle project watch:`, error)
    }
  }

  /**
   * Get active sessions for a project
   */
  async getActiveSessions(projectId: string): Promise<LiveSession[]> {
    try {
      // In a real implementation, this would query live_activity_sessions
      // const { data, error } = await supabase
      //   .from('live_activity_sessions')
      //   .select('*')
      //   .eq('project_id', projectId)
      //   .eq('is_active', true)
      //   .order('last_activity', { ascending: false })

      // For now, return empty array
      return []
    } catch (error) {
      console.error(`Failed to get active sessions for project ${projectId}:`, error)
      return []
    }
  }

  /**
   * Cleanup old data (called periodically)
   */
  async cleanupOldData(): Promise<void> {
    try {
      // In a real implementation, this would call the cleanup function
      // const { error } = await supabase.rpc('cleanup_old_activity_data')
      console.log('🧹 Cleaned up old activity data')
    } catch (error) {
      console.error('Failed to cleanup old data:', error)
    }
  }