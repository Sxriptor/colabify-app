// IPC handlers for Git monitoring communication

import { ipcMain, BrowserWindow } from 'electron'
import { ProjectWatcherManager } from '../services/ProjectWatcherManager'
import { RepoStore } from '../store/RepoStore'
import { GitExecutor } from '../util/gitExec'
import { GitState } from '../services/GitState'
import { RepoConfig, RepoState, Activity, GitEventPayload } from '../../shared/types'
import { randomUUID } from 'crypto'

export class GitIPC {
  private projectWatcherManager: ProjectWatcherManager
  private repoStore: RepoStore
  private mainWindow?: BrowserWindow

  constructor(projectWatcherManager: ProjectWatcherManager, repoStore: RepoStore) {
    this.projectWatcherManager = projectWatcherManager
    this.repoStore = repoStore
    
    // Set up event emitter for the ProjectWatcherManager
    this.projectWatcherManager.setEventEmitter(this.emitActivity.bind(this))
  }

  /**
   * Set the main window for sending events to renderer
   * @param mainWindow The main BrowserWindow instance
   */
  setMainWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
  }

  /**
   * Register all IPC handlers for Git monitoring
   */
  registerHandlers(): void {
    console.log('🔧 Registering Git monitoring IPC handlers...')
    
    ipcMain.handle('git:watchProject', this.handleWatchProject.bind(this))
    ipcMain.handle('git:listProjectRepos', this.handleListProjectRepos.bind(this))
    ipcMain.handle('git:getRepoState', this.handleGetRepoState.bind(this))
    ipcMain.handle('git:connectRepoToProject', this.handleConnectRepoToProject.bind(this))
    
    console.log('✅ Git monitoring IPC handlers registered')
  }

  /**
   * Handle git:watchProject IPC call
   */
  private async handleWatchProject(event: any, projectId: string, on: boolean): Promise<void> {
    try {
      console.log(`🔍 Git IPC: ${on ? 'Starting' : 'Stopping'} watch for project ${projectId}`)
      
      if (on) {
        await this.projectWatcherManager.startWatching(projectId)
        this.emitSystemEvent('watchingOn', projectId)
      } else {
        await this.projectWatcherManager.stopWatching(projectId)
        this.emitSystemEvent('watchingOff', projectId)
      }
      
      console.log(`✅ Git IPC: Successfully ${on ? 'started' : 'stopped'} watching project ${projectId}`)
    } catch (error) {
      console.error(`❌ Git IPC: Failed to ${on ? 'start' : 'stop'} watching project ${projectId}:`, error)
      
      this.emitError(projectId, undefined, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Handle git:listProjectRepos IPC call
   */
  private async handleListProjectRepos(event: any, projectId: string): Promise<RepoConfig[]> {
    try {
      console.log(`🔍 Git IPC: Listing repositories for project ${projectId}`)
      
      const repos = this.repoStore.listByProject(projectId)
      
      console.log(`✅ Git IPC: Found ${repos.length} repositories for project ${projectId}`)
      return repos
    } catch (error) {
      console.error(`❌ Git IPC: Failed to list repositories for project ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Handle git:getRepoState IPC call
   */
  private async handleGetRepoState(event: any, repoId: string): Promise<RepoState | null> {
    try {
      console.log(`🔍 Git IPC: Getting state for repository ${repoId}`)
      
      const repoConfig = this.repoStore.get(repoId)
      if (!repoConfig) {
        console.warn(`Repository ${repoId} not found`)
        return null
      }

      // Get current state from the repository
      const currentState = await GitState.readRepoState(repoConfig.path)
      
      // Update stored state
      this.repoStore.saveLast(repoId, currentState)
      
      console.log(`✅ Git IPC: Retrieved state for repository ${repoId}`)
      return currentState
    } catch (error) {
      console.error(`❌ Git IPC: Failed to get state for repository ${repoId}:`, error)
      
      // Return stored state as fallback
      const repoConfig = this.repoStore.get(repoId)
      return repoConfig ? repoConfig.last : null
    }
  }

  /**
   * Handle git:connectRepoToProject IPC call
   */
  private async handleConnectRepoToProject(event: any, projectId: string, path: string): Promise<RepoConfig> {
    try {
      console.log(`🔍 Git IPC: Connecting repository at ${path} to project ${projectId}`)
      
      // Validate that the path is a Git repository
      const isGitRepo = await GitExecutor.isGitRepository(path)
      if (!isGitRepo) {
        throw new Error(`Path is not a Git repository: ${path}`)
      }

      // Get the repository root path
      const repoRoot = await GitExecutor.getRepositoryRoot(path)
      
      // Read initial repository state
      const initialState = await GitState.readRepoState(repoRoot)
      
      // Create repository configuration
      const repoConfig: RepoConfig = {
        id: randomUUID(),
        projectId,
        path: repoRoot,
        watching: true, // Default to watching when connected
        last: initialState
      }

      // Store the repository configuration
      this.repoStore.upsert(repoConfig)
      
      // Add to project watcher if project is being watched
      if (this.projectWatcherManager.isWatching(projectId)) {
        await this.projectWatcherManager.addRepository(repoConfig)
      }
      
      console.log(`✅ Git IPC: Connected repository ${repoConfig.id} to project ${projectId}`)
      return repoConfig
    } catch (error) {
      console.error(`❌ Git IPC: Failed to connect repository to project ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Emit activity event to renderer process
   */
  private emitActivity(activity: Activity): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('Cannot emit activity: main window not available')
      return
    }

    const payload: GitEventPayload = {
      evt: 'activity',
      projectId: activity.projectId,
      repoId: activity.repoId,
      type: activity.type,
      details: activity.details,
      at: activity.at
    }

    this.mainWindow.webContents.send('git:event', payload)
    console.log(`📤 Emitted ${activity.type} activity for project ${activity.projectId}`)
  }

  /**
   * Emit system event to renderer process
   */
  private emitSystemEvent(evt: 'watchingOn' | 'watchingOff', projectId: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('Cannot emit system event: main window not available')
      return
    }

    const payload: GitEventPayload = {
      evt,
      projectId
    }

    this.mainWindow.webContents.send('git:event', payload)
    console.log(`📤 Emitted ${evt} event for project ${projectId}`)
  }

  /**
   * Emit error event to renderer process
   */
  private emitError(projectId: string, repoId: string | undefined, error: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('Cannot emit error: main window not available')
      return
    }

    const payload: GitEventPayload = {
      evt: 'error',
      projectId,
      repoId,
      error
    }

    this.mainWindow.webContents.send('git:event', payload)
    console.log(`📤 Emitted error event for project ${projectId}: ${error}`)
  }

  /**
   * Get statistics about the Git monitoring system
   */
  async getStatistics(): Promise<any> {
    return this.projectWatcherManager.getStatistics()
  }

  /**
   * Cleanup IPC handlers
   */
  cleanup(): void {
    console.log('🧹 Cleaning up Git monitoring IPC handlers...')
    
    ipcMain.removeHandler('git:watchProject')
    ipcMain.removeHandler('git:listProjectRepos')
    ipcMain.removeHandler('git:getRepoState')
    ipcMain.removeHandler('git:connectRepoToProject')
    
    console.log('✅ Git monitoring IPC handlers cleaned up')
  }
}