// Live Activity Monitor - Real-time developer activity tracking
// Monitors file changes, git operations, and developer presence

import * as chokidar from 'chokidar'
import { join, relative, extname } from 'path'
import { RepoConfig, Activity } from '../../shared/types'
import { GitState } from './GitState'
import { DatabaseSync } from './DatabaseSync'

export interface LiveSession {
  id: string
  userId: string
  projectId: string
  repositoryId?: string
  localPath: string
  sessionStart: Date
  lastActivity: Date
  isActive: boolean
  currentBranch?: string
  currentHead?: string
  workingDirectoryStatus?: string
  aheadCount: number
  behindCount: number
  focusFile?: string
  editorInfo?: any
}

export interface LiveActivity {
  id: string
  sessionId: string
  userId: string
  projectId: string
  repositoryId?: string
  activityType: string
  activityData: any
  branchName?: string
  commitHash?: string
  filePath?: string
  occurredAt: Date
}

export interface FileChange {
  filePath: string
  fileType: string
  changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED'
  linesAdded: number
  linesRemoved: number
  charactersAdded: number
  charactersRemoved: number
  firstChangeAt: Date
  lastChangeAt: Date
}

export interface TeamAwareness {
  projectId: string
  userId: string
  status: string
  currentBranch?: string
  currentFile?: string
  lastCommitMessage?: string
  repositoryPath?: string
  workingOn?: string
  lastSeen: Date
  isOnline: boolean
}

export class LiveActivityMonitor {
  private sessions: Map<string, LiveSession> = new Map()
  private fileWatchers: Map<string, chokidar.FSWatcher> = new Map()
  private fileChanges: Map<string, Map<string, FileChange>> = new Map() // sessionId -> filePath -> FileChange
  private databaseSync: DatabaseSync
  private currentUserId: string
  private heartbeatInterval?: NodeJS.Timeout
  private syncInterval?: NodeJS.Timeout

  private static readonly HEARTBEAT_INTERVAL = 30000 // 30 seconds
  private static readonly SYNC_INTERVAL = 60000 // 1 minute
  private static readonly SESSION_TIMEOUT = 600000 // 10 minutes

  constructor(databaseSync: DatabaseSync, currentUserId: string) {
    this.databaseSync = databaseSync
    this.currentUserId = currentUserId
    this.startHeartbeat()
    this.startPeriodicSync()
  }

  /**
   * Start monitoring a repository for live activity
   */
  async startMonitoring(repoConfig: RepoConfig): Promise<string> {
    try {
      // Create or resume session
      const sessionId = await this.createSession(repoConfig)
      
      // Start file system watching
      await this.startFileWatching(sessionId, repoConfig)
      
      // Update team awareness
      await this.updateTeamAwareness(repoConfig.projectId, {
        status: 'active',
        repositoryPath: repoConfig.path,
        workingOn: 'Starting development session'
      })

      console.log(`✅ Started live activity monitoring for ${repoConfig.path}`)
      return sessionId

    } catch (error) {
      console.error(`Failed to start live activity monitoring for ${repoConfig.path}:`, error)
      throw error
    }
  }

  /**
   * Stop monitoring a repository
   */
  async stopMonitoring(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId)
      if (!session) return

      // Stop file watching
      const watcher = this.fileWatchers.get(sessionId)
      if (watcher) {
        await watcher.close()
        this.fileWatchers.delete(sessionId)
      }

      // Mark session as inactive
      session.isActive = false
      session.lastActivity = new Date()

      // Sync final state to database
      await this.syncSessionToDatabase(session)

      // Clean up local state
      this.sessions.delete(sessionId)
      this.fileChanges.delete(sessionId)

      console.log(`✅ Stopped live activity monitoring for session ${sessionId}`)

    } catch (error) {
      console.error(`Error stopping live activity monitoring for session ${sessionId}:`, error)
    }
  }

  /**
   * Update current focus file (called by editor integration)
   */
  async updateFocusFile(sessionId: string, filePath: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.focusFile = filePath
    session.lastActivity = new Date()

    // Record activity
    await this.recordActivity(sessionId, 'FILE_FOCUS', {
      filePath,
      fileType: extname(filePath),
      timestamp: new Date().toISOString()
    })

    // Update team awareness
    await this.updateTeamAwareness(session.projectId, {
      currentFile: relative(session.localPath, filePath),
      workingOn: `Editing ${relative(session.localPath, filePath)}`
    })
  }

  /**
   * Record a git activity (called by GitWatcher)
   */
  async recordGitActivity(sessionId: string, activity: Activity): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.lastActivity = new Date()

    // Update session git state
    if (activity.type === 'BRANCH_SWITCH') {
      session.currentBranch = activity.details.to
    } else if (activity.type === 'COMMIT') {
      session.currentHead = activity.details.head
      session.lastActivity = new Date()
    }

    // Record the activity
    await this.recordActivity(sessionId, activity.type, activity.details, {
      branchName: session.currentBranch,
      commitHash: session.currentHead
    })

    // Update team awareness for significant activities
    if (['COMMIT', 'BRANCH_SWITCH', 'PUSH'].includes(activity.type)) {
      let workingOn = 'Coding'
      if (activity.type === 'COMMIT') {
        workingOn = `Committed: ${activity.details.subject?.substring(0, 50) || 'changes'}`
      } else if (activity.type === 'BRANCH_SWITCH') {
        workingOn = `Switched to ${activity.details.to}`
      } else if (activity.type === 'PUSH') {
        workingOn = `Pushed to ${activity.details.branch}`
      }

      await this.updateTeamAwareness(session.projectId, {
        currentBranch: session.currentBranch,
        lastCommitMessage: activity.type === 'COMMIT' ? activity.details.subject : undefined,
        workingOn
      })
    }
  }

  /**
   * Get live team awareness for a project
   */
  async getTeamAwareness(projectId: string): Promise<TeamAwareness[]> {
    // In a real implementation, this would query the database
    // For now, return mock data based on active sessions
    const teamAwareness: TeamAwareness[] = []

    for (const session of this.sessions.values()) {
      if (session.projectId === projectId && session.isActive) {
        teamAwareness.push({
          projectId,
          userId: session.userId,
          status: 'active',
          currentBranch: session.currentBranch,
          currentFile: session.focusFile ? relative(session.localPath, session.focusFile) : undefined,
          repositoryPath: session.localPath,
          workingOn: session.focusFile ? `Editing ${relative(session.localPath, session.focusFile)}` : 'Active',
          lastSeen: session.lastActivity,
          isOnline: true
        })
      }
    }

    return teamAwareness
  }

  /**
   * Get recent activities for a project
   */
  async getRecentActivities(projectId: string, limit: number = 50): Promise<LiveActivity[]> {
    // In a real implementation, this would query the database
    // For now, return empty array as placeholder
    return []
  }

  /**
   * Get active file changes for a session
   */
  getFileChanges(sessionId: string): FileChange[] {
    const changes = this.fileChanges.get(sessionId)
    return changes ? Array.from(changes.values()) : []
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Stop intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    // Stop all monitoring
    const stopPromises = Array.from(this.sessions.keys()).map(sessionId => 
      this.stopMonitoring(sessionId)
    )
    await Promise.all(stopPromises)

    console.log('✅ Live activity monitor shutdown complete')
  }

  /**
   * Create a new monitoring session
   */
  private async createSession(repoConfig: RepoConfig): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Get current git state
    const gitState = await GitState.readRepoState(repoConfig.path)

    const session: LiveSession = {
      id: sessionId,
      userId: this.currentUserId,
      projectId: repoConfig.projectId,
      localPath: repoConfig.path,
      sessionStart: new Date(),
      lastActivity: new Date(),
      isActive: true,
      currentBranch: gitState.branch,
      currentHead: gitState.head,
      workingDirectoryStatus: gitState.statusShort,
      aheadCount: gitState.ahead,
      behindCount: gitState.behind
    }

    this.sessions.set(sessionId, session)
    this.fileChanges.set(sessionId, new Map())

    // Sync to database
    await this.syncSessionToDatabase(session)

    return sessionId
  }

  /**
   * Start file system watching for a session
   */
  private async startFileWatching(sessionId: string, repoConfig: RepoConfig): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    // Watch all files in the repository (excluding .git)
    const watcher = chokidar.watch(repoConfig.path, {
      persistent: true,
      ignoreInitial: true,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.log'
      ],
      followSymlinks: false,
      depth: 10
    })

    watcher.on('change', (filePath) => this.handleFileChange(sessionId, filePath, 'MODIFIED'))
    watcher.on('add', (filePath) => this.handleFileChange(sessionId, filePath, 'ADDED'))
    watcher.on('unlink', (filePath) => this.handleFileChange(sessionId, filePath, 'DELETED'))

    watcher.on('error', (error) => {
      console.error(`File watcher error for session ${sessionId}:`, error)
    })

    this.fileWatchers.set(sessionId, watcher)
  }

  /**
   * Handle file system changes
   */
  private async handleFileChange(
    sessionId: string, 
    filePath: string, 
    changeType: 'MODIFIED' | 'ADDED' | 'DELETED'
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.lastActivity = new Date()

    // Get or create file change record
    const sessionChanges = this.fileChanges.get(sessionId)!
    const relativePath = relative(session.localPath, filePath)
    
    let fileChange = sessionChanges.get(relativePath)
    if (!fileChange) {
      fileChange = {
        filePath: relativePath,
        fileType: extname(filePath),
        changeType,
        linesAdded: 0,
        linesRemoved: 0,
        charactersAdded: 0,
        charactersRemoved: 0,
        firstChangeAt: new Date(),
        lastChangeAt: new Date()
      }
      sessionChanges.set(relativePath, fileChange)
    } else {
      fileChange.changeType = changeType
      fileChange.lastChangeAt = new Date()
    }

    // Record activity
    await this.recordActivity(sessionId, 'FILE_CHANGE', {
      filePath: relativePath,
      changeType,
      fileType: extname(filePath),
      timestamp: new Date().toISOString()
    })

    // Update team awareness if this is the focused file
    if (session.focusFile === filePath) {
      await this.updateTeamAwareness(session.projectId, {
        currentFile: relativePath,
        workingOn: `Editing ${relativePath}`
      })
    }
  }

  /**
   * Record an activity event
   */
  private async recordActivity(
    sessionId: string, 
    activityType: string, 
    activityData: any,
    gitContext?: { branchName?: string, commitHash?: string }
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const activity: LiveActivity = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      userId: session.userId,
      projectId: session.projectId,
      repositoryId: session.repositoryId,
      activityType,
      activityData,
      branchName: gitContext?.branchName || session.currentBranch,
      commitHash: gitContext?.commitHash || session.currentHead,
      filePath: activityData.filePath,
      occurredAt: new Date()
    }

    // In a real implementation, this would be queued for database insertion
    console.log(`📝 Recorded activity: ${activityType} for session ${sessionId}`)
  }

  /**
   * Update team awareness status
   */
  private async updateTeamAwareness(projectId: string, updates: Partial<TeamAwareness>): Promise<void> {
    // In a real implementation, this would update the database
    console.log(`👥 Updated team awareness for project ${projectId}:`, updates)
  }

  /**
   * Sync session state to database
   */
  private async syncSessionToDatabase(session: LiveSession): Promise<void> {
    // In a real implementation, this would upsert to live_activity_sessions table
    console.log(`💾 Synced session ${session.id} to database`)
  }

  /**
   * Start heartbeat to keep sessions alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat()
    }, LiveActivityMonitor.HEARTBEAT_INTERVAL)
  }

  /**
   * Perform heartbeat operations
   */
  private async performHeartbeat(): Promise<void> {
    const now = new Date()
    
    // Check for inactive sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime()
      
      if (timeSinceActivity > LiveActivityMonitor.SESSION_TIMEOUT) {
        console.log(`⏰ Session ${sessionId} timed out, marking as inactive`)
        await this.stopMonitoring(sessionId)
      }
    }

    // Update team awareness heartbeat
    for (const session of this.sessions.values()) {
      if (session.isActive) {
        await this.updateTeamAwareness(session.projectId, {
          lastSeen: now,
          isOnline: true
        })
      }
    }
  }

  /**
   * Start periodic sync to database
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      this.performPeriodicSync()
    }, LiveActivityMonitor.SYNC_INTERVAL)
  }

  /**
   * Perform periodic sync operations
   */
  private async performPeriodicSync(): Promise<void> {
    // Sync all active sessions
    for (const session of this.sessions.values()) {
      if (session.isActive) {
        await this.syncSessionToDatabase(session)
      }
    }

    // Sync file changes to database
    for (const [sessionId, changes] of this.fileChanges.entries()) {
      if (changes.size > 0) {
        const session = this.sessions.get(sessionId)
        if (session) {
          const fileChangesArray = Array.from(changes.values())
          await this.databaseSync.syncFileChanges(
            sessionId,
            session.userId,
            session.projectId,
            fileChangesArray
          )
          console.log(`💾 Synced ${changes.size} file changes for session ${sessionId} to database`)
        }
      }
    }
  }
}