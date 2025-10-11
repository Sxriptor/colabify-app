// Main entry point for Git monitoring backend
// This will be integrated with electron/main.js

import { GitIPC } from './ipc/GitIPC'
import { ProjectWatcherManager } from './services/ProjectWatcherManager'
import { RepoStore } from './store/RepoStore'

export class GitMonitoringBackend {
  private projectWatcherManager: ProjectWatcherManager
  private repoStore: RepoStore
  private gitIPC: GitIPC

  constructor() {
    this.repoStore = new RepoStore()
    this.projectWatcherManager = new ProjectWatcherManager(this.repoStore)
    this.gitIPC = new GitIPC(this.projectWatcherManager, this.repoStore)
  }

  /**
   * Initialize the Git monitoring backend
   * Should be called from electron/main.js after app is ready
   */
  async initialize(): Promise<void> {
    try {
      // Load existing repository configurations
      await this.repoStore.load()
      
      // Register IPC handlers
      this.gitIPC.registerHandlers()
      
      // Restore watching state for projects that were previously being watched
      await this.projectWatcherManager.restoreWatchingProjects()
      
      console.log('✅ Git monitoring backend initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Git monitoring backend:', error)
      throw error
    }
  }

  /**
   * Cleanup resources when app is shutting down
   */
  async cleanup(): Promise<void> {
    try {
      await this.projectWatcherManager.stopAll()
      await this.repoStore.save()
      console.log('✅ Git monitoring backend cleaned up successfully')
    } catch (error) {
      console.error('❌ Error during Git monitoring backend cleanup:', error)
    }
  }

  /**
   * Get the GitIPC instance for external access
   */
  getGitIPC(): GitIPC {
    return this.gitIPC
  }

  /**
   * Get the ProjectWatcherManager instance for external access
   */
  getProjectWatcherManager(): ProjectWatcherManager {
    return this.projectWatcherManager
  }
}

// Export singleton instance
export const gitMonitoringBackend = new GitMonitoringBackend()

// Export individual components for direct access if needed
export { GitIPC } from './ipc/GitIPC'
export { ProjectWatcherManager } from './services/ProjectWatcherManager'
export { ProjectWatcher } from './services/ProjectWatcher'
export { GitWatcher } from './services/GitWatcher'
export { GitState } from './services/GitState'
export { RepoStore } from './store/RepoStore'
export { GitExecutor } from './util/gitExec'