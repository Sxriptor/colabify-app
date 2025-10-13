// Git Cache Refresh Service - Periodically refreshes stale Git repository data
// This service runs in the background to keep Git data cache up to date

import { GitScanningService, GitScanOptions } from './GitScanningService'

export interface RefreshOptions {
  staleThresholdHours?: number
  maxRepositoriesPerBatch?: number
  refreshIntervalMinutes?: number
  enableAutoRefresh?: boolean
}

export interface RefreshStats {
  totalRepositories: number
  staleRepositories: number
  refreshedRepositories: number
  failedRepositories: number
  lastRefreshTime: Date
  nextRefreshTime: Date | null
}

export class GitCacheRefreshService {
  private gitScanningService: GitScanningService
  private refreshInterval: NodeJS.Timeout | null = null
  private isRefreshing = false
  private stats: RefreshStats = {
    totalRepositories: 0,
    staleRepositories: 0,
    refreshedRepositories: 0,
    failedRepositories: 0,
    lastRefreshTime: new Date(),
    nextRefreshTime: null
  }

  constructor() {
    this.gitScanningService = new GitScanningService()
  }

  /**
   * Start automatic refresh service
   */
  startAutoRefresh(options: RefreshOptions = {}) {
    const {
      refreshIntervalMinutes = 60, // Default: refresh every hour
      enableAutoRefresh = true
    } = options

    if (!enableAutoRefresh) {
      console.log('🔄 Auto-refresh is disabled')
      return
    }

    if (this.refreshInterval) {
      console.log('🔄 Auto-refresh is already running')
      return
    }

    console.log(`🔄 Starting auto-refresh service (interval: ${refreshIntervalMinutes} minutes)`)
    
    const intervalMs = refreshIntervalMinutes * 60 * 1000
    this.refreshInterval = setInterval(() => {
      this.refreshStaleRepositories(options)
    }, intervalMs)

    // Set next refresh time
    this.stats.nextRefreshTime = new Date(Date.now() + intervalMs)

    // Run initial refresh after a short delay
    setTimeout(() => {
      this.refreshStaleRepositories(options)
    }, 5000) // 5 second delay
  }

  /**
   * Stop automatic refresh service
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
      this.stats.nextRefreshTime = null
      console.log('🛑 Auto-refresh service stopped')
    }
  }

  /**
   * Manually refresh stale repositories
   */
  async refreshStaleRepositories(options: RefreshOptions = {}): Promise<RefreshStats> {
    if (this.isRefreshing) {
      console.log('🔄 Refresh already in progress, skipping...')
      return this.stats
    }

    const {
      staleThresholdHours = 24, // Default: consider data stale after 24 hours
      maxRepositoriesPerBatch = 5 // Default: refresh max 5 repositories per batch
    } = options

    this.isRefreshing = true
    console.log(`🔄 Starting stale repository refresh (threshold: ${staleThresholdHours}h, batch size: ${maxRepositoriesPerBatch})`)

    try {
      // Import Supabase client dynamically to avoid SSR issues
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Get stale repositories using the database function
      const { data: staleRepos, error } = await supabase
        .rpc('get_stale_git_repositories', { hours_threshold: staleThresholdHours })

      if (error) {
        console.error('❌ Failed to get stale repositories:', error)
        return this.stats
      }

      if (!staleRepos || staleRepos.length === 0) {
        console.log('✅ No stale repositories found')
        this.stats.staleRepositories = 0
        this.stats.lastRefreshTime = new Date()
        return this.stats
      }

      console.log(`📊 Found ${staleRepos.length} stale repositories`)
      this.stats.staleRepositories = staleRepos.length

      // Limit batch size to avoid overwhelming the system
      const repositoriesToRefresh = staleRepos.slice(0, maxRepositoriesPerBatch)
      
      if (repositoriesToRefresh.length < staleRepos.length) {
        console.log(`🔄 Refreshing ${repositoriesToRefresh.length} of ${staleRepos.length} stale repositories (batch limit)`)
      }

      // Convert to the format expected by GitScanningService
      const mappings = repositoriesToRefresh.map(repo => ({
        id: repo.id,
        local_path: repo.local_path,
        project_id: repo.project_id,
        user_id: '' // Not needed for refresh
      }))

      // Refresh the repositories
      const scanResult = await this.gitScanningService.scanRepositories(mappings, supabase, {
        maxCommits: 2000,
        includeBranches: true,
        includeRemotes: true,
        includeStats: true,
        forceRefresh: true
      })

      // Update stats
      this.stats.refreshedRepositories = scanResult.successful
      this.stats.failedRepositories = scanResult.failed
      this.stats.lastRefreshTime = new Date()

      console.log(`✅ Refresh complete: ${scanResult.successful} successful, ${scanResult.failed} failed`)

      // If we have more stale repositories, schedule next batch
      if (staleRepos.length > maxRepositoriesPerBatch) {
        console.log(`📅 ${staleRepos.length - maxRepositoriesPerBatch} repositories remaining, will refresh in next cycle`)
      }

      return this.stats

    } catch (error) {
      console.error('❌ Error during stale repository refresh:', error)
      return this.stats
    } finally {
      this.isRefreshing = false
    }
  }

  /**
   * Refresh specific repositories by project ID
   */
  async refreshProjectRepositories(projectId: string, options: GitScanOptions = {}): Promise<boolean> {
    try {
      console.log(`🔄 Refreshing repositories for project ${projectId}`)

      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Get all repositories for the project
      const { data: repositories, error } = await supabase
        .from('repository_local_mappings')
        .select('id, local_path, project_id, user_id')
        .eq('project_id', projectId)
        .eq('is_git_repository', true)

      if (error) {
        console.error('❌ Failed to get project repositories:', error)
        return false
      }

      if (!repositories || repositories.length === 0) {
        console.log(`ℹ️ No repositories found for project ${projectId}`)
        return true
      }

      console.log(`📊 Refreshing ${repositories.length} repositories for project ${projectId}`)

      const scanResult = await this.gitScanningService.scanRepositories(repositories, supabase, {
        maxCommits: 2000,
        includeBranches: true,
        includeRemotes: true,
        includeStats: true,
        forceRefresh: true,
        ...options
      })

      console.log(`✅ Project refresh complete: ${scanResult.successful} successful, ${scanResult.failed} failed`)
      return scanResult.failed === 0

    } catch (error) {
      console.error(`❌ Error refreshing project ${projectId} repositories:`, error)
      return false
    }
  }

  /**
   * Get refresh statistics
   */
  getStats(): RefreshStats {
    return { ...this.stats }
  }

  /**
   * Check if auto-refresh is running
   */
  isAutoRefreshRunning(): boolean {
    return this.refreshInterval !== null
  }

  /**
   * Check if refresh is currently in progress
   */
  isRefreshInProgress(): boolean {
    return this.isRefreshing
  }

  /**
   * Get repository cache health for a project
   */
  async getProjectCacheHealth(projectId: string): Promise<{
    totalRepositories: number
    healthyRepositories: number
    staleRepositories: number
    errorRepositories: number
    averageAge: number // in hours
    oldestCache: Date | null
    newestCache: Date | null
  } | null> {
    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data: repositories, error } = await supabase
        .from('repository_local_mappings')
        .select(`
          id,
          local_path,
          is_git_repository,
          git_data_last_updated,
          git_scan_error
        `)
        .eq('project_id', projectId)

      if (error) {
        console.error('❌ Failed to get project cache health:', error)
        return null
      }

      if (!repositories || repositories.length === 0) {
        return {
          totalRepositories: 0,
          healthyRepositories: 0,
          staleRepositories: 0,
          errorRepositories: 0,
          averageAge: 0,
          oldestCache: null,
          newestCache: null
        }
      }

      const now = new Date()
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      let totalAge = 0
      let validCacheCount = 0
      let oldestCache: Date | null = null
      let newestCache: Date | null = null

      const healthyRepositories = repositories.filter(repo => {
        if (!repo.is_git_repository || repo.git_scan_error) return false
        if (!repo.git_data_last_updated) return false

        const lastUpdated = new Date(repo.git_data_last_updated)
        const ageHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60)
        
        totalAge += ageHours
        validCacheCount++

        if (!oldestCache || lastUpdated < oldestCache) {
          oldestCache = lastUpdated
        }
        if (!newestCache || lastUpdated > newestCache) {
          newestCache = lastUpdated
        }

        return lastUpdated > twentyFourHoursAgo
      }).length

      const staleRepositories = repositories.filter(repo => {
        if (!repo.is_git_repository || repo.git_scan_error) return false
        if (!repo.git_data_last_updated) return true

        const lastUpdated = new Date(repo.git_data_last_updated)
        return lastUpdated <= twentyFourHoursAgo
      }).length

      const errorRepositories = repositories.filter(repo => 
        !repo.is_git_repository || repo.git_scan_error
      ).length

      return {
        totalRepositories: repositories.length,
        healthyRepositories,
        staleRepositories,
        errorRepositories,
        averageAge: validCacheCount > 0 ? totalAge / validCacheCount : 0,
        oldestCache,
        newestCache
      }

    } catch (error) {
      console.error('❌ Error getting project cache health:', error)
      return null
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopAutoRefresh()
    console.log('🧹 Git cache refresh service cleaned up')
  }
}

// Export singleton instance
export const gitCacheRefreshService = new GitCacheRefreshService()