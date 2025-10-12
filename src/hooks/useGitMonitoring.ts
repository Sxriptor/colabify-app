'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'

interface GitMonitoringStatus {
  isRunning: boolean
  watchedProjects: string[]
  activeWatchers: number
  config: any
  error?: string
}

interface TeamAwareness {
  userId: string
  userName: string
  status: string
  currentBranch?: string
  currentFile?: string
  lastCommitMessage?: string
  workingOn?: string
  lastSeen: Date
  isOnline: boolean
}

interface LiveActivity {
  id: string
  userId: string
  activityType: string
  activityData: any
  branchName?: string
  commitHash?: string
  filePath?: string
  occurredAt: Date
  userName?: string
}

export function useGitMonitoring() {
  const { user } = useAuth()
  const [status, setStatus] = useState<GitMonitoringStatus>({
    isRunning: false,
    watchedProjects: [],
    activeWatchers: 0,
    config: null
  })
  const [loading, setLoading] = useState(false)

  // Check if we're in Electron environment
  const isElectron = typeof window !== 'undefined' && window.electron

  /**
   * Start Git monitoring backend
   */
  const startMonitoring = useCallback(async () => {
    if (!isElectron || !user) return { success: false, error: 'Not in Electron environment or no user' }

    setLoading(true)
    try {
      const config = {
        userId: user.id,
        enableLiveActivity: true,
        syncInterval: 60000 // 1 minute
      }

      const result = await window.electron.invoke('git-monitoring:start', config)
      
      if (result.success) {
        await refreshStatus()
      }
      
      return result
    } catch (error) {
      console.error('Failed to start Git monitoring:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      setLoading(false)
    }
  }, [isElectron, user])

  /**
   * Stop Git monitoring backend
   */
  const stopMonitoring = useCallback(async () => {
    if (!isElectron) return { success: false, error: 'Not in Electron environment' }

    setLoading(true)
    try {
      const result = await window.electron.invoke('git-monitoring:stop')
      
      if (result.success) {
        await refreshStatus()
      }
      
      return result
    } catch (error) {
      console.error('Failed to stop Git monitoring:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      setLoading(false)
    }
  }, [isElectron])

  /**
   * Toggle project watch status
   */
  const toggleProjectWatch = useCallback(async (projectId: string, watching: boolean) => {
    if (!isElectron) return { success: false, error: 'Not in Electron environment' }

    try {
      const result = await window.electron.invoke('git-monitoring:toggle-project-watch', projectId, watching)
      
      if (result.success) {
        await refreshStatus()
      }
      
      return result
    } catch (error) {
      console.error('Failed to toggle project watch:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [isElectron])

  /**
   * Get team awareness for a project
   */
  const getTeamAwareness = useCallback(async (projectId: string): Promise<TeamAwareness[]> => {
    if (!isElectron) return []

    try {
      const result = await window.electron.invoke('git-monitoring:get-team-awareness', projectId)
      
      if (result.success && result.data) {
        return result.data.map((item: any) => ({
          ...item,
          lastSeen: new Date(item.lastSeen)
        }))
      }
      
      return []
    } catch (error) {
      console.error('Failed to get team awareness:', error)
      return []
    }
  }, [isElectron])

  /**
   * Get recent activities for a project
   */
  const getRecentActivities = useCallback(async (projectId: string, limit?: number): Promise<LiveActivity[]> => {
    if (!isElectron) return []

    try {
      const result = await window.electron.invoke('git-monitoring:get-recent-activities', projectId, limit)
      
      if (result.success && result.data) {
        return result.data.map((item: any) => ({
          ...item,
          occurredAt: new Date(item.occurredAt)
        }))
      }
      
      return []
    } catch (error) {
      console.error('Failed to get recent activities:', error)
      return []
    }
  }, [isElectron])

  /**
   * Update focus file for live activity tracking
   */
  const updateFocusFile = useCallback(async (sessionId: string, filePath: string) => {
    if (!isElectron) return { success: false, error: 'Not in Electron environment' }

    try {
      return await window.electron.invoke('git-monitoring:update-focus-file', sessionId, filePath)
    } catch (error) {
      console.error('Failed to update focus file:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [isElectron])

  /**
   * Refresh monitoring status
   */
  const refreshStatus = useCallback(async () => {
    if (!isElectron) return

    try {
      const newStatus = await window.electron.invoke('git-monitoring:status')
      setStatus(newStatus)
    } catch (error) {
      console.error('Failed to get Git monitoring status:', error)
      setStatus(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Unknown error' }))
    }
  }, [isElectron])

  /**
   * Check if a project is being watched
   */
  const isProjectWatched = useCallback((projectId: string): boolean => {
    return status.watchedProjects.includes(projectId)
  }, [status.watchedProjects])

  // Auto-refresh status periodically
  useEffect(() => {
    if (!isElectron) return

    refreshStatus()

    const interval = setInterval(refreshStatus, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [isElectron, refreshStatus])

  // Auto-start monitoring when user is available
  useEffect(() => {
    if (isElectron && user && !status.isRunning && !loading) {
      // Auto-start monitoring in Electron environment
      startMonitoring()
    }
  }, [isElectron, user, status.isRunning, loading, startMonitoring])

  return {
    // Status
    status,
    loading,
    isElectron,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    toggleProjectWatch,
    refreshStatus,
    
    // Data fetching
    getTeamAwareness,
    getRecentActivities,
    updateFocusFile,
    
    // Utilities
    isProjectWatched
  }
}