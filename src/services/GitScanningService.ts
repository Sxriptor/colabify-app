// Git Scanning Service - Handles scanning and caching of Git repository data
// This service can be used both during local folder addition and for periodic updates

export interface GitScanOptions {
  maxCommits?: number
  includeBranches?: boolean
  includeRemotes?: boolean
  includeStats?: boolean
  forceRefresh?: boolean
}

export interface GitScanResult {
  successful: number
  failed: number
  skipped: number
  totalCommits: number
  totalBranches: number
  totalContributors: number
  errors: Array<{
    path: string
    error: string
  }>
}

export interface RepositoryMapping {
  id: string
  local_path: string
  project_id: string
  user_id: string
}

export class GitScanningService {
  private electronAPI: any

  constructor() {
    this.electronAPI = (window as any).electronAPI
  }

  /**
   * Scan and cache Git data for multiple repository mappings
   */
  async scanRepositories(
    mappings: RepositoryMapping[], 
    supabase: any,
    options: GitScanOptions = {}
  ): Promise<GitScanResult> {
    const {
      maxCommits = 2000,
      includeBranches = true,
      includeRemotes = true,
      includeStats = true,
      forceRefresh = false
    } = options

    console.log(`📚 Starting Git data scanning for ${mappings.length} repositories...`)
    
    const result: GitScanResult = {
      successful: 0,
      failed: 0,
      skipped: 0,
      totalCommits: 0,
      totalBranches: 0,
      totalContributors: 0,
      errors: []
    }

    // Check if Git API is available
    if (!this.electronAPI?.git?.readCompleteHistory) {
      console.error('⚠️ Git API not available in Electron context')
      result.failed = mappings.length
      result.errors = mappings.map(m => ({
        path: m.local_path,
        error: 'Git API not available'
      }))
      return result
    }

    // Process repositories in parallel (but limit concurrency to avoid overwhelming the system)
    const concurrency = 3
    const chunks = this.chunkArray(mappings, concurrency)

    for (const chunk of chunks) {
      const promises = chunk.map(mapping => this.scanSingleRepository(mapping, supabase, {
        maxCommits,
        includeBranches,
        includeRemotes,
        includeStats,
        forceRefresh
      }))

      const chunkResults = await Promise.allSettled(promises)
      
      chunkResults.forEach((chunkResult, index) => {
        const mapping = chunk[index]
        
        if (chunkResult.status === 'fulfilled') {
          const scanResult = chunkResult.value
          if (scanResult.success) {
            result.successful++
            result.totalCommits += scanResult.commitCount || 0
            result.totalBranches += scanResult.branchCount || 0
            result.totalContributors += scanResult.contributorCount || 0
          } else {
            result.failed++
            result.errors.push({
              path: mapping.local_path,
              error: scanResult.error || 'Unknown error'
            })
          }
        } else {
          result.failed++
          result.errors.push({
            path: mapping.local_path,
            error: chunkResult.reason?.message || 'Scan failed'
          })
        }
      })
    }

    console.log(`📊 Git scanning complete:`, result)
    return result
  }

  /**
   * Scan a single repository and update its cache
   */
  private async scanSingleRepository(
    mapping: RepositoryMapping,
    supabase: any,
    options: GitScanOptions
  ): Promise<{
    success: boolean
    error?: string
    commitCount?: number
    branchCount?: number
    contributorCount?: number
  }> {
    try {
      console.log(`📚 Scanning: ${mapping.local_path}`)

      // Check if we should skip based on existing cache (unless force refresh)
      if (!options.forceRefresh) {
        const existingData = await this.getExistingCacheData(mapping.id, supabase)
        if (existingData && this.isCacheRecent(existingData.git_data_last_updated)) {
          console.log(`⏭️ Skipping ${mapping.local_path} - cache is recent`)
          return { success: true, commitCount: 0, branchCount: 0, contributorCount: 0 }
        }
      }

      // Validate that this is actually a Git repository
      const gitState = await this.electronAPI.git.readDirectGitState(mapping.local_path)
      if (!gitState) {
        console.warn(`⚠️ ${mapping.local_path} is not a valid Git repository`)
        await this.markAsNonGitRepository(mapping.id, supabase)
        return { success: false, error: 'Not a Git repository' }
      }

      console.log(`🔍 Validated Git repository at ${mapping.local_path} (branch: ${gitState.branch})`)

      // Read complete Git history
      const history = await this.electronAPI.git.readCompleteHistory(mapping.local_path, {
        maxCommits: options.maxCommits,
        includeBranches: options.includeBranches,
        includeRemotes: options.includeRemotes,
        includeStats: options.includeStats
      })

      if (!history || !history.commits || history.commits.length === 0) {
        console.warn(`⚠️ No Git history found for ${mapping.local_path}`)
        await this.markAsEmptyRepository(mapping.id, supabase, gitState)
        return { success: false, error: 'No Git history found' }
      }

      // Process and cache the data
      const cacheData = this.processCacheData(history, gitState, mapping.local_path)
      await this.updateRepositoryCache(mapping.id, supabase, cacheData, history, gitState)

      console.log(`✅ Successfully cached ${history.commits.length} commits for ${mapping.local_path}`)
      
      return {
        success: true,
        commitCount: history.commits.length,
        branchCount: history.branches?.length || 0,
        contributorCount: cacheData.summary.totalContributors
      }

    } catch (error) {
      console.error(`❌ Error scanning ${mapping.local_path}:`, error)
      await this.markScanError(mapping.id, supabase, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Process raw Git history into cache data structure
   */
  private processCacheData(history: any, gitState: any, repositoryPath: string) {
    const contributors = new Set(history.commits.map((c: any) => c.author?.email).filter(Boolean))
    const totalAdditions = history.commits.reduce((sum: number, c: any) => sum + (c.stats?.additions || 0), 0)
    const totalDeletions = history.commits.reduce((sum: number, c: any) => sum + (c.stats?.deletions || 0), 0)
    const totalFiles = history.commits.reduce((sum: number, c: any) => sum + (c.stats?.files || 0), 0)

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentCommits = history.commits.filter((c: any) => 
      new Date(c.date) > thirtyDaysAgo
    )

    // Get contributor statistics
    const contributorStats = Array.from(contributors).map(email => {
      const contributorCommits = history.commits.filter((c: any) => c.author?.email === email)
      return {
        email,
        name: contributorCommits[0]?.author?.name || email,
        commitCount: contributorCommits.length,
        lastCommitDate: contributorCommits[0]?.date,
        totalAdditions: contributorCommits.reduce((sum: number, c: any) => sum + (c.stats?.additions || 0), 0),
        totalDeletions: contributorCommits.reduce((sum: number, c: any) => sum + (c.stats?.deletions || 0), 0)
      }
    }).sort((a, b) => b.commitCount - a.commitCount)

    return {
      ...history,
      cachedAt: new Date().toISOString(),
      repositoryPath,
      currentState: gitState,
      summary: {
        totalCommits: history.commits.length,
        totalBranches: history.branches?.length || 0,
        totalContributors: contributors.size,
        totalRemotes: Object.keys(history.remotes || {}).length,
        totalTags: history.tags?.length || 0,
        firstCommitDate: history.commits[history.commits.length - 1]?.date,
        lastCommitDate: history.commits[0]?.date,
        recentActivity: {
          commitsLast30Days: recentCommits.length,
          lastCommitDate: history.commits[0]?.date,
          activeBranch: gitState.branch,
          isActive: recentCommits.length > 0
        },
        codeMetrics: {
          totalAdditions,
          totalDeletions,
          totalFiles,
          netLines: totalAdditions - totalDeletions,
          averageCommitSize: history.commits.length > 0 ? Math.round((totalAdditions + totalDeletions) / history.commits.length) : 0
        },
        contributors: contributorStats.slice(0, 10), // Top 10 contributors
        activeBranches: history.branches?.filter((b: any) => b.isLocal && !b.isRemote) || [],
        repositoryHealth: {
          hasRemotes: Object.keys(history.remotes || {}).length > 0,
          hasMultipleBranches: (history.branches?.length || 0) > 1,
          hasRecentActivity: recentCommits.length > 0,
          isUpToDate: gitState.ahead === 0 && gitState.behind === 0
        }
      }
    }
  }

  /**
   * Update repository cache in database
   */
  private async updateRepositoryCache(
    mappingId: string,
    supabase: any,
    cacheData: any,
    history: any,
    gitState: any
  ) {
    const { error } = await supabase
      .from('repository_local_mappings')
      .update({
        git_data_cache: cacheData,
        git_data_last_updated: new Date().toISOString(),
        git_data_commit_count: history.commits.length,
        git_data_branch_count: history.branches?.length || 0,
        git_data_contributor_count: cacheData.summary.totalContributors,
        git_data_last_commit_sha: history.commits[0]?.sha,
        git_data_last_commit_date: history.commits[0]?.date,
        git_data_first_commit_date: history.commits[history.commits.length - 1]?.date,
        git_data_total_additions: cacheData.summary.codeMetrics.totalAdditions,
        git_data_total_deletions: cacheData.summary.codeMetrics.totalDeletions,
        is_git_repository: true,
        git_current_branch: gitState.branch,
        git_current_head: gitState.head,
        git_scan_error: null // Clear any previous errors
      })
      .eq('id', mappingId)

    if (error) {
      throw new Error(`Failed to update cache: ${error.message}`)
    }
  }

  /**
   * Mark repository as non-Git repository
   */
  private async markAsNonGitRepository(mappingId: string, supabase: any) {
    await supabase
      .from('repository_local_mappings')
      .update({
        is_git_repository: false,
        git_data_last_updated: new Date().toISOString(),
        git_scan_error: 'Not a Git repository'
      })
      .eq('id', mappingId)
  }

  /**
   * Mark repository as empty (valid Git repo but no history)
   */
  private async markAsEmptyRepository(mappingId: string, supabase: any, gitState: any) {
    await supabase
      .from('repository_local_mappings')
      .update({
        is_git_repository: true,
        git_data_last_updated: new Date().toISOString(),
        git_data_commit_count: 0,
        git_current_branch: gitState.branch,
        git_current_head: gitState.head,
        git_scan_error: 'No commit history found'
      })
      .eq('id', mappingId)
  }

  /**
   * Mark scan error
   */
  private async markScanError(mappingId: string, supabase: any, error: any) {
    try {
      await supabase
        .from('repository_local_mappings')
        .update({
          git_data_last_updated: new Date().toISOString(),
          git_scan_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', mappingId)
    } catch (updateError) {
      console.error(`Failed to update error status:`, updateError)
    }
  }

  /**
   * Get existing cache data for a repository
   */
  private async getExistingCacheData(mappingId: string, supabase: any) {
    try {
      const { data, error } = await supabase
        .from('repository_local_mappings')
        .select('git_data_last_updated, git_data_commit_count')
        .eq('id', mappingId)
        .single()

      if (error) return null
      return data
    } catch {
      return null
    }
  }

  /**
   * Check if cache is recent (within 6 hours)
   */
  private isCacheRecent(lastUpdated: string | null): boolean {
    if (!lastUpdated) return false
    
    const sixHoursAgo = new Date()
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6)
    
    return new Date(lastUpdated) > sixHoursAgo
  }

  /**
   * Split array into chunks for parallel processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Get scan statistics for a project
   */
  async getProjectScanStats(projectId: string, supabase: any) {
    try {
      const { data, error } = await supabase
        .from('repository_local_mappings')
        .select(`
          id,
          local_path,
          is_git_repository,
          git_data_commit_count,
          git_data_branch_count,
          git_data_contributor_count,
          git_data_last_updated,
          git_scan_error
        `)
        .eq('project_id', projectId)

      if (error) throw error

      const stats = {
        totalRepositories: data.length,
        gitRepositories: data.filter((r: any) => r.is_git_repository).length,
        totalCommits: data.reduce((sum: number, r: any) => sum + (r.git_data_commit_count || 0), 0),
        totalBranches: data.reduce((sum: number, r: any) => sum + (r.git_data_branch_count || 0), 0),
        totalContributors: data.reduce((sum: number, r: any) => sum + (r.git_data_contributor_count || 0), 0),
        repositoriesWithErrors: data.filter((r: any) => r.git_scan_error).length,
        lastScanDate: data.reduce((latest: Date | null, r: any) => {
          if (!r.git_data_last_updated) return latest
          const date = new Date(r.git_data_last_updated)
          return !latest || date > latest ? date : latest
        }, null as Date | null)
      }

      return stats
    } catch (error) {
      console.error('Failed to get project scan stats:', error)
      return null
    }
  }
}