// IPC handlers for Git monitoring backend
// Exposes Git monitoring functionality to the renderer process

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { GitMonitoringBackend, GitMonitoringConfig } from '../services/GitMonitoringBackend'

export class GitMonitoringIPC {
  private backend: GitMonitoringBackend | null = null

  constructor() {
    this.registerHandlers()
  }

  /**
   * Register all IPC handlers
   */
  private registerHandlers(): void {
    // Backend lifecycle
    ipcMain.handle('git-monitoring:start', this.handleStart.bind(this))
    ipcMain.handle('git-monitoring:stop', this.handleStop.bind(this))
    ipcMain.handle('git-monitoring:status', this.handleGetStatus.bind(this))

    // Project watching
    ipcMain.handle('git-monitoring:toggle-project-watch', this.handleToggleProjectWatch.bind(this))
    ipcMain.handle('git-monitoring:get-team-awareness', this.handleGetTeamAwareness.bind(this))
    ipcMain.handle('git-monitoring:get-recent-activities', this.handleGetRecentActivities.bind(this))

    // Live activity
    ipcMain.handle('git-monitoring:update-focus-file', this.handleUpdateFocusFile.bind(this))
  }

  /**
   * Start Git monitoring backend
   */
  private async handleStart(event: IpcMainInvokeEvent, config: GitMonitoringConfig): Promise<{ success: boolean, error?: string }> {
    try {
      if (this.backend) {
        await this.backend.stop()
      }

      this.backend = new GitMonitoringBackend(config)
      await this.backend.start()

      return { success: true }
    } catch (error) {
      console.error('Failed to start Git monitoring backend:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Stop Git monitoring backend
   */
  private async handleStop(event: IpcMainInvokeEvent): Promise<{ success: boolean, error?: string }> {
    try {
      if (this.backend) {
        await this.backend.stop()
        this.backend = null
      }

      return { success: true }
    } catch (error) {
      console.error('Failed to stop Git monitoring backend:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get backend status
   */
  private async handleGetStatus(event: IpcMainInvokeEvent): Promise<any> {
    try {
      if (!this.backend) {
        return {
          isRunning: false,
          watchedProjects: [],
          activeWatchers: 0,
          config: null
        }
      }

      return this.backend.getStatus()
    } catch (error) {
      console.error('Failed to get Git monitoring status:', error)
      return {
        isRunning: false,
        watchedProjects: [],
        activeWatchers: 0,
        config: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Toggle project watch status
   */
  private async handleToggleProjectWatch(
    event: IpcMainInvokeEvent, 
    projectId: string, 
    watching: boolean
  ): Promise<{ success: boolean, error?: string }> {
    try {
      if (!this.backend) {
        throw new Error('Git monitoring backend is not running')
      }

      await this.backend.toggleProjectWatch(projectId, watching)
      return { success: true }
    } catch (error) {
      console.error('Failed to toggle project watch:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get team awareness for a project
   */
  private async handleGetTeamAwareness(
    event: IpcMainInvokeEvent, 
    projectId: string
  ): Promise<{ success: boolean, data?: any[], error?: string }> {
    try {
      if (!this.backend) {
        throw new Error('Git monitoring backend is not running')
      }

      const data = await this.backend.getTeamAwareness(projectId)
      return { success: true, data }
    } catch (error) {
      console.error('Failed to get team awareness:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get recent activities for a project
   */
  private async handleGetRecentActivities(
    event: IpcMainInvokeEvent, 
    projectId: string, 
    limit?: number
  ): Promise<{ success: boolean, data?: any[], error?: string }> {
    try {
      if (!this.backend) {
        throw new Error('Git monitoring backend is not running')
      }

      const data = await this.backend.getRecentActivities(projectId, limit)
      return { success: true, data }
    } catch (error) {
      console.error('Failed to get recent activities:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Update focus file for live activity tracking
   */
  private async handleUpdateFocusFile(
    event: IpcMainInvokeEvent, 
    sessionId: string, 
    filePath: string
  ): Promise<{ success: boolean, error?: string }> {
    try {
      if (!this.backend) {
        throw new Error('Git monitoring backend is not running')
      }

      // In a real implementation, we'd need to access the LiveActivityMonitor
      // For now, just return success
      return { success: true }
    } catch (error) {
      console.error('Failed to update focus file:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Cleanup IPC handlers
   */
  cleanup(): void {
    ipcMain.removeAllListeners('git-monitoring:start')
    ipcMain.removeAllListeners('git-monitoring:stop')
    ipcMain.removeAllListeners('git-monitoring:status')
    ipcMain.removeAllListeners('git-monitoring:toggle-project-watch')
    ipcMain.removeAllListeners('git-monitoring:get-team-awareness')
    ipcMain.removeAllListeners('git-monitoring:get-recent-activities')
    ipcMain.removeAllListeners('git-monitoring:update-focus-file')
  }
}