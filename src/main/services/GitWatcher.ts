// Git repository file system watcher

import * as chokidar from 'chokidar'
import { join } from 'path'
import { RepoConfig, Activity, RepoState } from '../../shared/types'
import { GitState } from './GitState'
import { ActivityDetector } from './ActivityDetector'
import { GitExecutor } from '../util/gitExec'

interface WatcherInfo {
  repoId: string
  repoCfg: RepoConfig
  watcher: chokidar.FSWatcher
  emit: (activity: Activity) => void
  debounceTimer?: NodeJS.Timeout
  isProcessing: boolean
}

export class GitWatcher {
  private static readonly DEBOUNCE_DELAY = 400 // 400ms debounce
  private watchers: Map<string, WatcherInfo> = new Map()

  /**
   * Start monitoring a repository for Git changes
   * @param repoCfg Repository configuration
   * @param emit Function to emit activity events
   */
  async start(repoCfg: RepoConfig, emit: (activity: Activity) => void): Promise<void> {
    try {
      // Stop existing watcher if any
      if (this.watchers.has(repoCfg.id)) {
        await this.stop(repoCfg.id)
      }

      // Validate that the path is a Git repository
      const isGitRepo = await GitExecutor.isGitRepository(repoCfg.path)
      if (!isGitRepo) {
        console.warn(`Path is not a Git repository: ${repoCfg.path}`)
        emit({
          projectId: repoCfg.projectId,
          repoId: repoCfg.id,
          type: 'ERROR',
          details: { message: 'Path is not a Git repository', command: 'validation' },
          at: new Date().toISOString()
        })
        return
      }

      // Set up file system watcher for Git-specific files
      const gitDir = join(repoCfg.path, '.git')
      const watchPaths = [
        join(gitDir, 'HEAD'),           // Branch changes
        join(gitDir, 'index'),          // Staging area changes
        join(gitDir, 'refs', '**'),     // Reference updates
      ]

      const watcher = chokidar.watch(watchPaths, {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        depth: 10, // Limit depth for refs/**
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      })

      const watcherInfo: WatcherInfo = {
        repoId: repoCfg.id,
        repoCfg: { ...repoCfg },
        watcher,
        emit,
        isProcessing: false
      }

      // Set up event handlers
      watcher.on('change', (path) => this.handleFileChange(watcherInfo, path))
      watcher.on('add', (path) => this.handleFileChange(watcherInfo, path))
      watcher.on('unlink', (path) => this.handleFileChange(watcherInfo, path))

      watcher.on('error', (err: unknown) => {
        console.error(`GitWatcher error for ${repoCfg.id}:`, err)
        const error = err instanceof Error ? err : new Error(String(err))
        emit({
          projectId: repoCfg.projectId,
          repoId: repoCfg.id,
          type: 'ERROR',
          details: { message: error.message, command: 'file-watching' },
          at: new Date().toISOString()
        })
      })

      this.watchers.set(repoCfg.id, watcherInfo)
      console.log(`✅ Started GitWatcher for repository: ${repoCfg.path}`)

    } catch (error) {
      console.error(`Failed to start GitWatcher for ${repoCfg.id}:`, error)
      emit({
        projectId: repoCfg.projectId,
        repoId: repoCfg.id,
        type: 'ERROR',
        details: { 
          message: error instanceof Error ? error.message : 'Unknown error', 
          command: 'start-watcher' 
        },
        at: new Date().toISOString()
      })
    }
  }

  /**
   * Stop monitoring a repository
   * @param repoId Repository ID to stop watching
   */
  async stop(repoId: string): Promise<void> {
    const watcherInfo = this.watchers.get(repoId)
    if (!watcherInfo) {
      return
    }

    try {
      // Clear any pending debounce timer
      if (watcherInfo.debounceTimer) {
        clearTimeout(watcherInfo.debounceTimer)
      }

      // Close the file watcher
      await watcherInfo.watcher.close()
      
      // Remove from our tracking
      this.watchers.delete(repoId)
      
      console.log(`✅ Stopped GitWatcher for repository: ${repoId}`)
    } catch (error) {
      console.error(`Error stopping GitWatcher for ${repoId}:`, error)
    }
  }

  /**
   * Check if a repository is being watched
   * @param repoId Repository ID to check
   * @returns True if repository is being watched
   */
  isWatching(repoId: string): boolean {
    return this.watchers.has(repoId)
  }

  /**
   * Stop all watchers
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.watchers.keys()).map(repoId => this.stop(repoId))
    await Promise.all(stopPromises)
  }

  /**
   * Get the number of active watchers
   */
  getWatcherCount(): number {
    return this.watchers.size
  }

  /**
   * Handle file system changes with debouncing
   */
  private handleFileChange(watcherInfo: WatcherInfo, changedPath: string): void {
    // Clear existing timer
    if (watcherInfo.debounceTimer) {
      clearTimeout(watcherInfo.debounceTimer)
    }

    // Set up new debounced processing
    watcherInfo.debounceTimer = setTimeout(() => {
      this.processRepositoryChanges(watcherInfo, changedPath)
    }, GitWatcher.DEBOUNCE_DELAY)
  }

  /**
   * Process repository changes and detect activities
   */
  private async processRepositoryChanges(watcherInfo: WatcherInfo, changedPath: string): Promise<void> {
    // Prevent concurrent processing
    if (watcherInfo.isProcessing) {
      return
    }

    watcherInfo.isProcessing = true

    try {
      const { repoCfg, emit } = watcherInfo

      // Read current repository state
      const currentState = await GitState.readRepoState(repoCfg.path)

      // Get previous state from configuration
      const previousState = repoCfg.last

      // Detect activities by comparing states
      const activities = await ActivityDetector.detectActivities(
        previousState,
        currentState,
        repoCfg.projectId,
        repoCfg.id,
        repoCfg.path
      )

      // Emit detected activities
      for (const activity of activities) {
        emit(activity)
      }

      // Update the last known state in the configuration
      repoCfg.last = ActivityDetector.cloneRepoState(currentState)

      console.log(`🔍 GitWatcher processed changes for ${repoCfg.id}: ${activities.length} activities detected`)

    } catch (error) {
      console.error(`Error processing repository changes for ${watcherInfo.repoId}:`, error)
      
      // Emit error activity
      watcherInfo.emit({
        projectId: watcherInfo.repoCfg.projectId,
        repoId: watcherInfo.repoId,
        type: 'ERROR',
        details: { 
          message: (error as Error).message, 
          command: 'process-changes',
          changedPath 
        },
        at: new Date().toISOString()
      })
    } finally {
      watcherInfo.isProcessing = false
    }
  }

  /**
   * Update repository configuration for an existing watcher
   * @param repoCfg Updated repository configuration
   */
  updateConfig(repoCfg: RepoConfig): void {
    const watcherInfo = this.watchers.get(repoCfg.id)
    if (watcherInfo) {
      watcherInfo.repoCfg = { ...repoCfg }
    }
  }

  /**
   * Get current repository state for a watched repository
   * @param repoId Repository ID
   * @returns Current repository state or null if not watching
   */
  async getCurrentState(repoId: string): Promise<RepoState | null> {
    const watcherInfo = this.watchers.get(repoId)
    if (!watcherInfo) {
      return null
    }

    try {
      return await GitState.readRepoState(watcherInfo.repoCfg.path)
    } catch (error) {
      console.error(`Failed to get current state for ${repoId}:`, error)
      return null
    }
  }
}