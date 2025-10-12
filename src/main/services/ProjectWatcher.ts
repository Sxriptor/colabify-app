// Project-level Git monitoring coordinator with live activity tracking

import { RepoConfig, Activity } from '../../shared/types'
import { GitWatcher } from './GitWatcher'
import { GitState } from './GitState'
import { ActivityDetector } from './ActivityDetector'
import { RepoStore } from '../store/RepoStore'
import { LiveActivityMonitor } from './LiveActivityMonitor'

export class ProjectWatcher {
  private projectId: string
  private gitWatcher: GitWatcher
  private repoStore: RepoStore
  private repositories: Map<string, RepoConfig> = new Map()
  private remotePollingInterval?: NodeJS.Timeout
  private isWatching: boolean = false
  private eventEmitter: (activity: Activity) => void

  private static readonly REMOTE_POLLING_INTERVAL = 120000 // 120 seconds

  constructor(
    projectId: string, 
    gitWatcher: GitWatcher, 
    repoStore: RepoStore,
    eventEmitter: (activity: Activity) => void
  ) {
    this.projectId = projectId
    this.gitWatcher = gitWatcher
    this.repoStore = repoStore
    this.eventEmitter = eventEmitter
  }

  /**
   * Start monitoring all repositories in a project
   * @param repoConfigs Repository configurations for the project
   */
  async start(repoConfigs: RepoConfig[]): Promise<void> {
    if (this.isWatching) {
      console.warn(`ProjectWatcher for ${this.projectId} is already watching`)
      return
    }

    try {
      // Store repository configurations
      this.repositories.clear()
      for (const repoCfg of repoConfigs) {
        this.repositories.set(repoCfg.id, { ...repoCfg })
      }

      // Start GitWatchers for each repository
      for (const repoCfg of repoConfigs) {
        if (repoCfg.watching) {
          await this.gitWatcher.start(repoCfg, this.eventEmitter)
        }
      }

      // Start remote polling if any repositories have remote URLs
      this.startRemotePolling()

      this.isWatching = true
      console.log(`✅ Started ProjectWatcher for project ${this.projectId} with ${repoConfigs.length} repositories`)

      // Emit watching started event
      this.eventEmitter({
        projectId: this.projectId,
        repoId: '',
        type: 'ERROR', // Using ERROR type for system events temporarily
        details: { message: 'Project watching started' },
        at: new Date().toISOString()
      })

    } catch (error) {
      console.error(`Failed to start ProjectWatcher for ${this.projectId}:`, error)
      throw error
    }
  }

  /**
   * Stop monitoring all repositories in a project
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      return
    }

    try {
      // Stop remote polling
      this.stopRemotePolling()

      // Stop all GitWatchers
      for (const repoId of this.repositories.keys()) {
        await this.gitWatcher.stop(repoId)
      }

      this.isWatching = false
      console.log(`✅ Stopped ProjectWatcher for project ${this.projectId}`)

      // Emit watching stopped event
      this.eventEmitter({
        projectId: this.projectId,
        repoId: '',
        type: 'ERROR', // Using ERROR type for system events temporarily
        details: { message: 'Project watching stopped' },
        at: new Date().toISOString()
      })

    } catch (error) {
      console.error(`Error stopping ProjectWatcher for ${this.projectId}:`, error)
    }
  }

  /**
   * Add a repository to project monitoring
   * @param repoCfg Repository configuration
   */
  async addRepository(repoCfg: RepoConfig): Promise<void> {
    try {
      // Store the repository configuration
      this.repositories.set(repoCfg.id, { ...repoCfg })

      // Start watching if the project is currently being watched and repo is enabled
      if (this.isWatching && repoCfg.watching) {
        await this.gitWatcher.start(repoCfg, this.eventEmitter)
      }

      console.log(`✅ Added repository ${repoCfg.id} to ProjectWatcher ${this.projectId}`)
    } catch (error) {
      console.error(`Failed to add repository ${repoCfg.id} to ProjectWatcher:`, error)
      throw error
    }
  }

  /**
   * Remove a repository from project monitoring
   * @param repoId Repository ID
   */
  async removeRepository(repoId: string): Promise<void> {
    try {
      // Stop watching the repository
      await this.gitWatcher.stop(repoId)

      // Remove from our tracking
      this.repositories.delete(repoId)

      console.log(`✅ Removed repository ${repoId} from ProjectWatcher ${this.projectId}`)
    } catch (error) {
      console.error(`Error removing repository ${repoId} from ProjectWatcher:`, error)
    }
  }

  /**
   * Update repository configuration
   * @param repoCfg Updated repository configuration
   */
  async updateRepository(repoCfg: RepoConfig): Promise<void> {
    const existingRepo = this.repositories.get(repoCfg.id)
    if (!existingRepo) {
      console.warn(`Repository ${repoCfg.id} not found in ProjectWatcher ${this.projectId}`)
      return
    }

    try {
      // Update stored configuration
      this.repositories.set(repoCfg.id, { ...repoCfg })

      // Update GitWatcher configuration
      this.gitWatcher.updateConfig(repoCfg)

      // Handle watching state changes
      if (this.isWatching) {
        if (repoCfg.watching && !this.gitWatcher.isWatching(repoCfg.id)) {
          // Start watching if not already watching
          await this.gitWatcher.start(repoCfg, this.eventEmitter)
        } else if (!repoCfg.watching && this.gitWatcher.isWatching(repoCfg.id)) {
          // Stop watching if currently watching
          await this.gitWatcher.stop(repoCfg.id)
        }
      }

      console.log(`✅ Updated repository ${repoCfg.id} in ProjectWatcher ${this.projectId}`)
    } catch (error) {
      console.error(`Failed to update repository ${repoCfg.id} in ProjectWatcher:`, error)
      throw error
    }
  }

  /**
   * Check if the project is being watched
   * @returns True if project is being watched
   */
  getIsWatching(): boolean {
    return this.isWatching
  }

  /**
   * Get all repository configurations for this project
   * @returns Array of repository configurations
   */
  getRepositories(): RepoConfig[] {
    return Array.from(this.repositories.values()).map(repo => ({ ...repo }))
  }

  /**
   * Get a specific repository configuration
   * @param repoId Repository ID
   * @returns Repository configuration or null if not found
   */
  getRepository(repoId: string): RepoConfig | null {
    const repo = this.repositories.get(repoId)
    return repo ? { ...repo } : null
  }

  /**
   * Start periodic remote polling for repositories with remote URLs
   */
  private startRemotePolling(): void {
    // Stop existing polling if any
    this.stopRemotePolling()

    // Check if any repositories have remote URLs
    const reposWithRemotes = Array.from(this.repositories.values())
      .filter(repo => repo.watching && this.hasRemoteUrl(repo))

    if (reposWithRemotes.length === 0) {
      console.log(`No repositories with remote URLs in project ${this.projectId}, skipping remote polling`)
      return
    }

    // Start polling interval
    this.remotePollingInterval = setInterval(() => {
      this.performRemotePolling()
    }, ProjectWatcher.REMOTE_POLLING_INTERVAL)

    console.log(`✅ Started remote polling for project ${this.projectId} (${reposWithRemotes.length} repositories)`)
  }

  /**
   * Stop remote polling
   */
  private stopRemotePolling(): void {
    if (this.remotePollingInterval) {
      clearInterval(this.remotePollingInterval)
      this.remotePollingInterval = undefined
    }
  }

  /**
   * Perform remote polling for all repositories
   */
  private async performRemotePolling(): Promise<void> {
    const reposWithRemotes = Array.from(this.repositories.values())
      .filter(repo => repo.watching && this.hasRemoteUrl(repo))

    for (const repoCfg of reposWithRemotes) {
      try {
        await this.pollRepository(repoCfg)
      } catch (error) {
        console.error(`Remote polling failed for repository ${repoCfg.id}:`, error)
        
        // Emit error event
        this.eventEmitter({
          projectId: this.projectId,
          repoId: repoCfg.id,
          type: 'ERROR',
          details: { 
            message: error instanceof Error ? error.message : 'Remote polling failed',
            command: 'remote-polling' 
          },
          at: new Date().toISOString()
        })
      }
    }
  }

  /**
   * Poll a single repository for remote updates
   */
  private async pollRepository(repoCfg: RepoConfig): Promise<void> {
    // Get state before fetch
    const stateBefore = await GitState.readRepoState(repoCfg.path)

    // Perform fetch
    await GitState.fetch(repoCfg.path)

    // Get state after fetch
    const stateAfter = await GitState.readRepoState(repoCfg.path)

    // Detect remote activities
    const activities = await ActivityDetector.detectRemoteActivities(
      stateBefore,
      stateAfter,
      this.projectId,
      repoCfg.id,
      repoCfg.path
    )

    // Emit detected activities
    for (const activity of activities) {
      this.eventEmitter(activity)
    }

    // Update stored state
    repoCfg.last = ActivityDetector.cloneRepoState(stateAfter)
    this.repoStore.saveLast(repoCfg.id, stateAfter)

    if (activities.length > 0) {
      console.log(`🔍 Remote polling detected ${activities.length} activities for repository ${repoCfg.id}`)
    }
  }

  /**
   * Check if a repository configuration has a remote URL
   */
  private hasRemoteUrl(repoCfg: RepoConfig): boolean {
    // For now, we'll assume repositories have remotes if they're Git repos
    // In a full implementation, this could check the actual Git remote configuration
    return true
  }
}