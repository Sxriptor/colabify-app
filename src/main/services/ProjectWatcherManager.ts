// Manager for all project watchers

import { RepoStore } from '../store/RepoStore'
import { ProjectWatcher } from './ProjectWatcher'
import { GitWatcher } from './GitWatcher'
import { Activity, RepoConfig } from '../../shared/types'

export class ProjectWatcherManager {
  private repoStore: RepoStore
  private projectWatchers: Map<string, ProjectWatcher> = new Map()
  private gitWatcher: GitWatcher
  private eventEmitter?: (activity: Activity) => void

  constructor(repoStore: RepoStore) {
    this.repoStore = repoStore
    this.gitWatcher = new GitWatcher()
  }

  /**
   * Set the event emitter for activity events
   * @param emitter Function to emit activity events
   */
  setEventEmitter(emitter: (activity: Activity) => void): void {
    this.eventEmitter = emitter
  }

  /**
   * Restore watching state for projects that were previously being watched
   */
  async restoreWatchingProjects(): Promise<void> {
    try {
      // Get all repository configurations
      const allRepos = this.repoStore.getAll()
      
      // Group repositories by project
      const projectRepos = new Map<string, RepoConfig[]>()
      for (const repo of allRepos) {
        if (!projectRepos.has(repo.projectId)) {
          projectRepos.set(repo.projectId, [])
        }
        projectRepos.get(repo.projectId)!.push(repo)
      }

      // Start watching for projects that have watching enabled
      for (const [projectId, repos] of projectRepos) {
        const hasWatchingRepos = repos.some(repo => repo.watching)
        if (hasWatchingRepos) {
          await this.startWatching(projectId)
        }
      }

      console.log(`✅ Restored watching for ${this.projectWatchers.size} projects`)
    } catch (error) {
      console.error('Failed to restore watching projects:', error)
      throw error
    }
  }

  /**
   * Start watching a project
   * @param projectId Project ID to start watching
   */
  async startWatching(projectId: string): Promise<void> {
    if (this.projectWatchers.has(projectId)) {
      console.warn(`Project ${projectId} is already being watched`)
      return
    }

    if (!this.eventEmitter) {
      throw new Error('Event emitter not set. Call setEventEmitter() first.')
    }

    try {
      // Get repository configurations for this project
      const repoConfigs = this.repoStore.listByProject(projectId)
      
      if (repoConfigs.length === 0) {
        console.warn(`No repositories found for project ${projectId}`)
        return
      }

      // Create and start ProjectWatcher
      const projectWatcher = new ProjectWatcher(
        projectId,
        this.gitWatcher,
        this.repoStore,
        this.eventEmitter
      )

      await projectWatcher.start(repoConfigs)
      this.projectWatchers.set(projectId, projectWatcher)

      console.log(`✅ Started watching project ${projectId}`)
    } catch (error) {
      console.error(`Failed to start watching project ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Stop watching a project
   * @param projectId Project ID to stop watching
   */
  async stopWatching(projectId: string): Promise<void> {
    const projectWatcher = this.projectWatchers.get(projectId)
    if (!projectWatcher) {
      console.warn(`Project ${projectId} is not being watched`)
      return
    }

    try {
      await projectWatcher.stop()
      this.projectWatchers.delete(projectId)
      
      console.log(`✅ Stopped watching project ${projectId}`)
    } catch (error) {
      console.error(`Error stopping project watcher for ${projectId}:`, error)
    }
  }

  /**
   * Stop all project watchers
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.projectWatchers.keys())
      .map(projectId => this.stopWatching(projectId))
    
    await Promise.all(stopPromises)
    
    // Also stop the shared GitWatcher
    await this.gitWatcher.stopAll()
    
    console.log('✅ Stopped all project watchers')
  }

  /**
   * Check if a project is being watched
   * @param projectId Project ID to check
   * @returns True if project is being watched
   */
  isWatching(projectId: string): boolean {
    const projectWatcher = this.projectWatchers.get(projectId)
    return projectWatcher ? projectWatcher.getIsWatching() : false
  }

  /**
   * Add a repository to a project's monitoring
   * @param repoCfg Repository configuration
   */
  async addRepository(repoCfg: RepoConfig): Promise<void> {
    const projectWatcher = this.projectWatchers.get(repoCfg.projectId)
    if (projectWatcher) {
      await projectWatcher.addRepository(repoCfg)
    }
    
    // Always update the store
    this.repoStore.upsert(repoCfg)
  }

  /**
   * Remove a repository from monitoring
   * @param repoId Repository ID
   * @param projectId Project ID
   */
  async removeRepository(repoId: string, projectId: string): Promise<void> {
    const projectWatcher = this.projectWatchers.get(projectId)
    if (projectWatcher) {
      await projectWatcher.removeRepository(repoId)
    }
    
    // Remove from store
    this.repoStore.remove(repoId)
  }

  /**
   * Update a repository configuration
   * @param repoCfg Updated repository configuration
   */
  async updateRepository(repoCfg: RepoConfig): Promise<void> {
    const projectWatcher = this.projectWatchers.get(repoCfg.projectId)
    if (projectWatcher) {
      await projectWatcher.updateRepository(repoCfg)
    }
    
    // Always update the store
    this.repoStore.upsert(repoCfg)
  }

  /**
   * Get current repository state
   * @param repoId Repository ID
   * @returns Current repository state or null
   */
  async getCurrentRepoState(repoId: string): Promise<any> {
    // Find which project this repository belongs to
    const repoConfig = this.repoStore.get(repoId)
    if (!repoConfig) {
      return null
    }

    const projectWatcher = this.projectWatchers.get(repoConfig.projectId)
    if (!projectWatcher) {
      return null
    }

    return await this.gitWatcher.getCurrentState(repoId)
  }

  /**
   * Get all watched projects
   * @returns Array of project IDs that are being watched
   */
  getWatchedProjects(): string[] {
    return Array.from(this.projectWatchers.keys())
  }

  /**
   * Get project watcher statistics
   * @returns Statistics about active watchers
   */
  getStatistics(): { 
    watchedProjects: number
    totalRepositories: number
    activeWatchers: number 
  } {
    const watchedProjects = this.projectWatchers.size
    const totalRepositories = this.repoStore.size()
    const activeWatchers = this.gitWatcher.getWatcherCount()

    return {
      watchedProjects,
      totalRepositories,
      activeWatchers
    }
  }
}