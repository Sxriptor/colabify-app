// Main Git Monitoring Backend Service
// Coordinates project watching, live activity monitoring, and database sync

import { RepoConfig, Activity } from '../../shared/types'
import { ProjectWatcher } from './ProjectWatcher'
import { GitWatcher } from './GitWatcher'
import { LiveActivityMonitor } from './LiveActivityMonitor'
import { DatabaseSync } from './DatabaseSync'
import { RepoStore } from '../store/RepoStore'
import { GitState } from './GitState'

export interface GitMonitoringConfig {
  userId: string
  supabaseUrl?: string
  supabaseKey?: string
  enableLiveActivity?: boolean
  syncInterval?: number
}

export class GitMonitoringBackend {
  private config: GitMonitoringConfig
  private projectWatchers: Map<string, ProjectWatcher> = new Map()
  private gitWatcher: GitWatcher
  private liveActivityMonitor: LiveActivityMonitor
  private databaseSync: DatabaseSync
  private repoStore: RepoStore
  private isRunning: boolean = false
  private syncInterval?: NodeJS.Timeout

  private static readonly DEFAULT_SYNC_INTERVAL = 60000 // 1 minute

  constructor(config: GitMonitoringConfig) {
    this.config = {
      enableLiveActivity: true,
      syncInterval: GitMonitoringBackend.DEFAULT_SYNC_INTERVAL,
      ...config
    }

    // Initialize core services
    this.repoStore = new RepoStore()
    this.gitWatcher = new GitWatcher()
    this.databaseSync = new DatabaseSync(this.repoStore)
    this.liveActivityMonitor = new LiveActivityMonitor(this.databaseSync, config.userId)
  }

  /**
   * Start the Git monitoring backend
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Git monitoring backend is already running')
      return
    }

    try {
      console.log('🚀 Starting Git monitoring backend...')

      // Sync watched projects from database
      const watchedProjectIds = await this.databaseSync.syncWatchedProjects(this.config.userId)

      // Start monitoring watched projects
      for (const projectId of watchedProjectIds) {
        await this.startProjectMonitoring(projectId)
      }

      // Start periodic sync
      this.startPeriodicSync()

      this.isRunning = true
      console.log(`✅ Git monitoring backend started successfully`)
      console.log(`📊 Monitoring ${watchedProjectIds.length} projects`)

    } catch (error) {
      console.error('❌ Failed to start Git monitoring backend:', error)
      throw error
    }
  }

  /**
   * Stop the Git monitoring backend
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      console.log('🛑 Stopping Git monitoring backend...')

      // Stop periodic sync
      if (this.syncInterval) {
        clearInterval(this.syncInterval)
        this.syncInterval = undefined
      }

      // Stop all project watchers
      const stopPromises = Array.from(this.projectWatchers.keys()).map(projectId =>
        this.stopProjectMonitoring(projectId)
      )
      await Promise.all(stopPromises)

      // Stop core services
      await this.gitWatcher.stopAll()
      await this.liveActivityMonitor.shutdown()

      this.isRunning = false
      console.log('✅ Git monitoring backend stopped successfully')

    } catch (error) {
      console.error('❌ Error stopping Git monitoring backend:', error)
    }
  }

  /**
   * Start monitoring a specific project
   */
  async startProjectMonitoring(projectId: string): Promise<void> {
    try {
      if (this.projectWatchers.has(projectId)) {
        console.warn(`Project ${projectId} is already being monitored`)
        return
      }

      // Check if project is watched by current user
      const isWatched = await this.databaseSync.isProjectWatched(projectId, this.config.userId)
      if (!isWatched) {
        console.log(`Project ${projectId} is not watched by user ${this.config.userId}`)
        return
      }

      // Get repository configurations for the project
      const repoConfigs = await this.getProjectRepositoryConfigs(projectId)
      if (repoConfigs.length === 0) {
        console.log(`No repository configurations found for project ${projectId}`)
        return
      }

      // Create project watcher
      const projectWatcher = new ProjectWatcher(
        projectId,
        this.gitWatcher,
        this.repoStore,
        (activity: Activity) => this.handleActivity(activity)
      )

      // Start project monitoring
      await projectWatcher.start(repoConfigs)

      // Start live activity monitoring for each repository
      if (this.config.enableLiveActivity) {
        for (const repoConfig of repoConfigs) {
          if (repoConfig.watching) {
            await this.liveActivityMonitor.startMonitoring(repoConfig)
          }
        }
      }

      this.projectWatchers.set(projectId, projectWatcher)
      console.log(`✅ Started monitoring project ${projectId}`)

    } catch (error) {
      console.error(`❌ Failed to start monitoring project ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Stop monitoring a specific project
   */
  async stopProjectMonitoring(projectId: string): Promise<void> {
    try {
      const projectWatcher = this.projectWatchers.get(projectId)
      if (!projectWatcher) {
        return
      }

      // Stop project watcher
      await projectWatcher.stop()

      // Stop live activity monitoring for project repositories
      if (this.config.enableLiveActivity) {
        // In a real implementation, we'd track session IDs per project
        // For now, we'll rely on the LiveActivityMonitor's internal cleanup
      }

      this.projectWatchers.delete(projectId)
      console.log(`✅ Stopped monitoring project ${projectId}`)

    } catch (error) {
      console.error(`❌ Error stopping monitoring for project ${projectId}:`, error)
    }
  }

  /**
   * Toggle project watch status
   */
  async toggleProjectWatch(projectId: string, watching: boolean): Promise<void> {
    try {
      // Update database
      await this.databaseSync.toggleProjectWatch(projectId, this.config.userId, watching)

      if (watching) {
        // Start monitoring
        await this.startProjectMonitoring(projectId)
      } else {
        // Stop monitoring
        await this.stopProjectMonitoring(projectId)
      }

      console.log(`✅ ${watching ? 'Started' : 'Stopped'} watching project ${projectId}`)

    } catch (error) {
      console.error(`❌ Failed to toggle watch for project ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Get live team awareness for a project
   */
  async getTeamAwareness(projectId: string) {
    try {
      return await this.databaseSync.getTeamAwareness(projectId)
    } catch (error) {
      console.error(`❌ Failed to get team awareness for project ${projectId}:`, error)
      return []
    }
  }

  /**
   * Get recent activities for a project
   */
  async getRecentActivities(projectId: string, limit: number = 50) {
    try {
      return await this.databaseSync.getRecentActivities(projectId, limit)
    } catch (error) {
      console.error(`❌ Failed to get recent activities for project ${projectId}:`, error)
      return []
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      watchedProjects: Array.from(this.projectWatchers.keys()),
      activeWatchers: this.gitWatcher.getWatcherCount(),
      config: {
        userId: this.config.userId,
        enableLiveActivity: this.config.enableLiveActivity,
        syncInterval: this.config.syncInterval
      }
    }
  }

  /**
   * Handle activity events from watchers
   */
  private async handleActivity(activity: Activity): Promise<void> {
    try {
      console.log(`📝 Activity detected: ${activity.type} in project ${activity.projectId}`)

      // Find active session for this repository
      const sessionId = await this.findActiveSession(activity.projectId, activity.repoId)
      
      if (sessionId && this.config.enableLiveActivity) {
        // Record git activity in live monitoring
        await this.liveActivityMonitor.recordGitActivity(sessionId, activity)
      }

      // Sync activity to database
      if (sessionId) {
        await this.databaseSync.syncLiveActivity({
          id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sessionId,
          userId: this.config.userId,
          projectId: activity.projectId,
          repositoryId: activity.repoId,
          activityType: activity.type,
          activityData: activity.details,
          branchName: activity.details.branch || activity.details.to,
          commitHash: activity.details.head || activity.details.sha,
          filePath: activity.details.filePath,
          occurredAt: new Date(activity.at)
        })

        // Detect and sync file changes for WORKTREE_CHANGE and COMMIT activities
        if (activity.type === 'WORKTREE_CHANGE' || activity.type === 'COMMIT') {
          await this.detectAndSyncFileChanges(activity, sessionId)
        }
      }

    } catch (error) {
      console.error('❌ Error handling activity:', error)
    }
  }

  /**
   * Detect and sync file changes from git activity
   */
  private async detectAndSyncFileChanges(activity: Activity, sessionId: string): Promise<void> {
    try {
      // Get repository configuration
      const repoConfig = this.repoStore.get(activity.repoId)
      if (!repoConfig) {
        console.warn(`Repository ${activity.repoId} not found in store`)
        return
      }

      // Get current repository state
      const currentState = await GitState.readRepoState(repoConfig.path)
      
      // Detect file changes using ActivityDetector
      const { ActivityDetector } = await import('./ActivityDetector')
      const fileChanges = await ActivityDetector.detectFileChanges(repoConfig.path, currentState)
      
      if (fileChanges.length > 0) {
        console.log(`📁 Detected ${fileChanges.length} file changes`)
        
        // Convert to FileChange format for database sync
        const fileChangeRecords = fileChanges.map(change => ({
          filePath: change.filePath,
          fileType: change.filePath.split('.').pop() || '',
          changeType: change.changeType,
          linesAdded: change.linesAdded,
          linesRemoved: change.linesRemoved,
          charactersAdded: 0, // Will be calculated by file watcher
          charactersRemoved: 0,
          firstChangeAt: new Date(),
          lastChangeAt: new Date()
        }))

        // Sync to database
        await this.databaseSync.syncFileChanges(
          sessionId,
          this.config.userId,
          activity.projectId,
          fileChangeRecords
        )
      }
    } catch (error) {
      console.error('Error detecting and syncing file changes:', error)
    }
  }

  /**
   * Find active session for a repository
   */
  private async findActiveSession(projectId: string, repoId: string): Promise<string | null> {
    // In a real implementation, this would query active sessions
    // For now, return a mock session ID
    return `session-${projectId}-${repoId}`
  }

  /**
   * Get repository configurations for a project
   */
  private async getProjectRepositoryConfigs(projectId: string): Promise<RepoConfig[]> {
    try {
      // In a real implementation, this would query the database for project repositories
      // and their local mappings for the current user
      
      // For now, return empty array as placeholder
      return []

    } catch (error) {
      console.error(`❌ Failed to get repository configs for project ${projectId}:`, error)
      return []
    }
  }

  /**
   * Start periodic sync with database
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(() => {
      this.performPeriodicSync()
    }, this.config.syncInterval!)
  }

  /**
   * Perform periodic sync operations
   */
  private async performPeriodicSync(): Promise<void> {
    try {
      // Cleanup old data
      await this.databaseSync.cleanupOldData()

      // Sync project watch states
      const watchedProjectIds = await this.databaseSync.getWatchedProjectIds(this.config.userId)
      
      // Start monitoring for newly watched projects
      for (const projectId of watchedProjectIds) {
        if (!this.projectWatchers.has(projectId)) {
          await this.startProjectMonitoring(projectId)
        }
      }

      // Stop monitoring for unwatched projects
      for (const projectId of this.projectWatchers.keys()) {
        if (!watchedProjectIds.includes(projectId)) {
          await this.stopProjectMonitoring(projectId)
        }
      }

    } catch (error) {
      console.error('❌ Error during periodic sync:', error)
    }
  }
}