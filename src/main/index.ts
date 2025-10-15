// Main entry point for Git monitoring backend
// This integrates with electron/main.js

import { BrowserWindow } from 'electron'
import { GitIPC } from './ipc/GitIPC'
import { ProjectWatcherManager } from './services/ProjectWatcherManager'
import { RepoStore } from './store/RepoStore'
import { setupNotificationIPC, cleanupNotificationIPC } from './ipc/NotificationIPC'

export class GitMonitoringBackend {
  private projectWatcherManager: ProjectWatcherManager
  private repoStore: RepoStore
  private gitIPC: GitIPC
  private initialized: boolean = false

  constructor() {
    this.repoStore = new RepoStore()
    this.projectWatcherManager = new ProjectWatcherManager(this.repoStore)
    this.gitIPC = new GitIPC(this.projectWatcherManager, this.repoStore)
  }

  /**
   * Initialize the Git monitoring backend
   * Should be called from electron/main.js after app is ready
   * @param mainWindow The main BrowserWindow for sending events
   */
  async initialize(mainWindow?: BrowserWindow): Promise<void> {
    if (this.initialized) {
      console.warn('Git monitoring backend already initialized')
      return
    }

    try {
      console.log('🚀 Initializing Git monitoring backend...')

      // Set main window for event emission
      if (mainWindow) {
        this.gitIPC.setMainWindow(mainWindow)
      }

      // Load existing repository configurations
      await this.repoStore.load()
      
      // Register IPC handlers
      this.gitIPC.registerHandlers()
      
      // Setup notification IPC handlers
      setupNotificationIPC()
      
      // Restore watching state for projects that were previously being watched
      await this.projectWatcherManager.restoreWatchingProjects()
      
      this.initialized = true
      console.log('✅ Git monitoring backend initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Git monitoring backend:', error)
      throw error
    }
  }

  /**
   * Update the main window reference (for when window is recreated)
   * @param mainWindow The new main BrowserWindow
   */
  setMainWindow(mainWindow: BrowserWindow): void {
    this.gitIPC.setMainWindow(mainWindow)
  }

  /**
   * Cleanup resources when app is shutting down
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return
    }

    try {
      console.log('🧹 Cleaning up Git monitoring backend...')
      
      // Stop all watchers
      await this.projectWatcherManager.stopAll()
      
      // Save repository configurations
      await this.repoStore.save()
      
      // Cleanup IPC handlers
      this.gitIPC.cleanup()
      
      // Cleanup notification IPC handlers
      cleanupNotificationIPC()
      
      this.initialized = false
      console.log('✅ Git monitoring backend cleaned up successfully')
    } catch (error) {
      console.error('❌ Error during Git monitoring backend cleanup:', error)
    }
  }

  /**
   * Check if the backend is initialized
   */
  isInitialized(): boolean {
    return this.initialized
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

  /**
   * Get the RepoStore instance for external access
   */
  getRepoStore(): RepoStore {
    return this.repoStore
  }

  /**
   * Get statistics about the Git monitoring system
   */
  async getStatistics(): Promise<any> {
    return this.gitIPC.getStatistics()
  }
}

// Export singleton instance
export const gitMonitoringBackend = new GitMonitoringBackend()

// Export individual components for direct access if needed
// Export individual components for direct access if needed
export { GitIPC } from './ipc/GitIPC'
export { ProjectWatcherManager } from './services/ProjectWatcherManager'
export { ProjectWatcher } from './services/ProjectWatcher'
export { GitWatcher } from './services/GitWatcher'
export { GitState } from './services/GitState'
export { RepoStore } from './store/RepoStore'
export { GitExecutor } from './util/gitExec'
export { ActivityDetector } from './services/ActivityDetector'