// React hook for Git scanning and cache management
// Provides easy access to Git scanning functionality from React components

import { useState, useEffect, useCallback } from 'react'
import { GitScanningService, GitScanResult } from '@/services/GitScanningService'
import { GitCacheRefreshService, RefreshStats } from '@/services/GitCacheRefreshService'
import { gitCacheRefreshService } from '@/services/GitCacheRefreshService'

export interface UseGitScanningOptions {
  enableAutoRefresh?: boolean
  refreshIntervalMinutes?: number
  staleThresholdHours?: number
}

export interface GitScanningState {
  isScanning: boolean
  isRefreshing: boolean
  lastScanResult: GitScanResult | null
  refreshStats: RefreshStats | null
  error: string | null
}

export function useGitScanning(options: UseGitScanningOptions = {}) {
  const [state, setState] = useState<GitScanningState>({
    isScanning: false,
    isRefreshing: false,
    lastScanResult: null,
    refreshStats: null,
    error: null
  })

  const [gitScanningService] = useState(() => new GitScanningService())

  // Initialize auto-refresh on mount
  useEffect(() => {
    const {
      enableAutoRefresh = false,
      refreshIntervalMinutes = 60,
      staleThresholdHours = 24
    } = options

    if (enableAutoRefresh) {
      gitCacheRefreshService.startAutoRefresh({
        enableAutoRefresh: true,
        refreshIntervalMinutes,
        staleThresholdHours
      })
    }

    // Update refresh stats
    const updateStats = () => {
      setState(prev => ({
        ...prev,
        refreshStats: gitCacheRefreshService.getStats(),
        isRefreshing: gitCacheRefreshService.isRefreshInProgress()
      }))
    }

    updateStats()
    const statsInterval = setInterval(updateStats, 5000) // Update every 5 seconds

    return () => {
      clearInterval(statsInterval)
      if (enableAutoRefresh) {
        gitCacheRefreshService.stopAutoRefresh()
      }
    }
  }, [options.enableAutoRefresh, options.refreshIntervalMinutes, options.staleThresholdHours])

  /**
   * Scan repositories and cache Git data
   */
  const scanRepositories = useCallback(async (
    mappings: Array<{
      id: string
      local_path: string
      project_id: string
      user_id: string
    }>,
    supabase: any,
    scanOptions: {
      maxCommits?: number
      includeBranches?: boolean
      includeRemotes?: boolean
      includeStats?: boolean
      forceRefresh?: boolean
    } = {}
  ): Promise<GitScanResult | null> => {
    setState(prev => ({ ...prev, isScanning: true, error: null }))

    try {
      const result = await gitScanningService.scanRepositories(mappings, supabase, scanOptions)
      
      setState(prev => ({
        ...prev,
        isScanning: false,
        lastScanResult: result
      }))

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        isScanning: false,
        error: errorMessage
      }))
      return null
    }
  }, [gitScanningService])

  /**
   * Refresh stale repositories
   */
  const refreshStaleRepositories = useCallback(async (refreshOptions: {
    staleThresholdHours?: number
    maxRepositoriesPerBatch?: number
  } = {}): Promise<RefreshStats | null> => {
    setState(prev => ({ ...prev, error: null }))

    try {
      const stats = await gitCacheRefreshService.refreshStaleRepositories(refreshOptions)
      
      setState(prev => ({
        ...prev,
        refreshStats: stats
      }))

      return stats
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      return null
    }
  }, [])

  /**
   * Refresh repositories for a specific project
   */
  const refreshProjectRepositories = useCallback(async (
    projectId: string,
    scanOptions: {
      maxCommits?: number
      includeBranches?: boolean
      includeRemotes?: boolean
      includeStats?: boolean
    } = {}
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, error: null }))

    try {
      const success = await gitCacheRefreshService.refreshProjectRepositories(projectId, scanOptions)
      
      // Update refresh stats after project refresh
      setState(prev => ({
        ...prev,
        refreshStats: gitCacheRefreshService.getStats()
      }))

      return success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      return false
    }
  }, [])

  /**
   * Get project scan statistics
   */
  const getProjectScanStats = useCallback(async (projectId: string, supabase: any) => {
    try {
      return await gitScanningService.getProjectScanStats(projectId, supabase)
    } catch (error) {
      console.error('Failed to get project scan stats:', error)
      return null
    }
  }, [gitScanningService])

  /**
   * Get project cache health
   */
  const getProjectCacheHealth = useCallback(async (projectId: string) => {
    try {
      return await gitCacheRefreshService.getProjectCacheHealth(projectId)
    } catch (error) {
      console.error('Failed to get project cache health:', error)
      return null
    }
  }, [])

  /**
   * Start auto-refresh manually
   */
  const startAutoRefresh = useCallback((refreshOptions: {
    refreshIntervalMinutes?: number
    staleThresholdHours?: number
    maxRepositoriesPerBatch?: number
  } = {}) => {
    gitCacheRefreshService.startAutoRefresh({
      enableAutoRefresh: true,
      ...refreshOptions
    })

    setState(prev => ({
      ...prev,
      refreshStats: gitCacheRefreshService.getStats()
    }))
  }, [])

  /**
   * Stop auto-refresh manually
   */
  const stopAutoRefresh = useCallback(() => {
    gitCacheRefreshService.stopAutoRefresh()
    
    setState(prev => ({
      ...prev,
      refreshStats: gitCacheRefreshService.getStats()
    }))
  }, [])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  /**
   * Reset scan results
   */
  const resetScanResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastScanResult: null,
      error: null
    }))
  }, [])

  return {
    // State
    ...state,
    isAutoRefreshRunning: gitCacheRefreshService.isAutoRefreshRunning(),

    // Actions
    scanRepositories,
    refreshStaleRepositories,
    refreshProjectRepositories,
    getProjectScanStats,
    getProjectCacheHealth,
    startAutoRefresh,
    stopAutoRefresh,
    clearError,
    resetScanResults
  }
}

/**
 * Hook for simple Git scanning without auto-refresh
 */
export function useSimpleGitScanning() {
  return useGitScanning({ enableAutoRefresh: false })
}

/**
 * Hook for Git scanning with auto-refresh enabled
 */
export function useAutoRefreshGitScanning(options: {
  refreshIntervalMinutes?: number
  staleThresholdHours?: number
} = {}) {
  return useGitScanning({
    enableAutoRefresh: true,
    ...options
  })
}