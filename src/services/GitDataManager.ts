/**
 * GitDataManager - Global Singleton Service
 *
 * This service maintains a PERSISTENT in-memory cache of git data that survives
 * component unmounts, tab switches, and page navigations.
 *
 * The cache is organized by projectId, so switching between tabs or components
 * that use the same project will instantly show cached data.
 */

console.log('🔥 [MODULE] GitDataManager.ts is being imported!')

import { gitCacheRefreshService } from './GitCacheRefreshService'

export interface GitCommit {
  sha: string
  message: string
  date: string
  branch?: string
  author: {
    name: string
    email: string
  }
  stats?: {
    additions: number
    deletions: number
    files: number
  }
  repository?: string
  localPath?: string
}

export interface GitBranch {
  name: string
  path: string
  branch: string
  head: string
  dirty: boolean
  ahead: number
  behind: number
  localBranches: string[]
  remoteBranches: string[]
  remoteUrls: Record<string, string>
  lastChecked?: string
  user?: any
  history?: any
  fromCache?: boolean
}

export interface GitUser {
  userId: string
  userName: string
  userEmail: string
  localPath: string
  currentBranch: string
  status: string
  commitsToday: number
}

export interface UncommittedChange {
  id: string
  filePath: string
  changeType: 'MODIFIED' | 'ADDED' | 'DELETED' | 'RENAMED' | 'UNTRACKED'
  status: string
  repository: string
  localPath: string
}

export interface ProjectGitData {
  branches: GitBranch[]
  commits: GitCommit[]
  users: GitUser[]
  uncommittedChanges: UncommittedChange[]
  lastUpdated: Date
  loading: boolean
  error: string | null
}

type DataChangeListener = (projectId: string, data: ProjectGitData) => void

class GitDataManagerService {
  private static instance: GitDataManagerService

  // In-memory cache organized by projectId
  private cache: Map<string, ProjectGitData> = new Map()

  // Active refresh intervals by projectId
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map()

  // Track if we're currently fetching for a project
  private fetchingProjects: Set<string> = new Set()

  // Listeners for data changes
  private listeners: Map<string, Set<DataChangeListener>> = new Map()

  private constructor() {
    console.log('🚀 [GitDataManager] Singleton instance created')
  }

  public static getInstance(): GitDataManagerService {
    if (!GitDataManagerService.instance) {
      GitDataManagerService.instance = new GitDataManagerService()
    }
    return GitDataManagerService.instance
  }

  /**
   * Get cached data for a project (instant)
   */
  public getCachedData(projectId: string): ProjectGitData | null {
    const cached = this.cache.get(projectId)
    if (cached) {
      console.log(`💾 [GitDataManager] Cache HIT for project ${projectId}`)
      return cached
    }
    console.log(`❌ [GitDataManager] Cache MISS for project ${projectId}`)
    return null
  }

  /**
   * Subscribe to data changes for a project
   */
  public subscribe(projectId: string, listener: DataChangeListener): () => void {
    if (!this.listeners.has(projectId)) {
      this.listeners.set(projectId, new Set())
    }
    this.listeners.get(projectId)!.add(listener)

    console.log(`📡 [GitDataManager] Listener subscribed for project ${projectId}`)

    // Return unsubscribe function
    return () => {
      const projectListeners = this.listeners.get(projectId)
      if (projectListeners) {
        projectListeners.delete(listener)
        console.log(`📡 [GitDataManager] Listener unsubscribed for project ${projectId}`)
      }
    }
  }

  /**
   * Notify all listeners of data changes
   */
  private notifyListeners(projectId: string, data: ProjectGitData) {
    const projectListeners = this.listeners.get(projectId)
    if (projectListeners && projectListeners.size > 0) {
      console.log(`📢 [GitDataManager] Notifying ${projectListeners.size} listeners for project ${projectId}`)
      projectListeners.forEach(listener => {
        try {
          listener(projectId, data)
        } catch (error) {
          console.error('Error in listener:', error)
        }
      })
    }
  }

  /**
   * Update cache and notify listeners
   */
  private updateCache(projectId: string, data: Partial<ProjectGitData>) {
    const existing = this.cache.get(projectId) || {
      branches: [],
      commits: [],
      users: [],
      uncommittedChanges: [],
      lastUpdated: new Date(),
      loading: false,
      error: null
    }

    const updated: ProjectGitData = {
      ...existing,
      ...data,
      lastUpdated: new Date()
    }

    this.cache.set(projectId, updated)
    this.notifyListeners(projectId, updated)

    console.log(`✅ [GitDataManager] Cache updated for project ${projectId}`)
  }

  /**
   * Load data from database cache (instant)
   */
  public async loadFromDatabaseCache(projectId: string, userId?: string): Promise<boolean> {
    try {
      console.log(`⚡ [GitDataManager] Loading from database cache for project ${projectId}`)

      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Get project repositories with cached git data
      const query = supabase
        .from('repositories')
        .select(`
          id,
          name,
          full_name,
          local_mappings:repository_local_mappings(
            id,
            local_path,
            user_id,
            git_data_cache,
            git_data_last_updated,
            git_current_branch,
            is_git_repository
          )
        `)
        .eq('project_id', projectId)

      if (userId) {
        query.eq('local_mappings.user_id', userId)
      }

      const { data: repositories, error: repoError } = await query

      if (repoError) {
        console.error('❌ [GitDataManager] Database error:', repoError)
        return false
      }

      if (!repositories || repositories.length === 0) {
        console.log('📦 [GitDataManager] No repositories found for this project')
        return false
      }

      console.log(`📦 [GitDataManager] Found ${repositories.length} repositories`)

      // Build unified data from cache
      const allBranches: GitBranch[] = []
      const allCommits: GitCommit[] = []
      const allUsers: GitUser[] = []

      let cacheFound = false

      for (const repo of repositories) {
        const mappings = repo.local_mappings || []
        console.log(`   ├─ Repo: ${repo.name} - ${mappings.length} local mappings`)

        for (const mapping of mappings) {
          console.log(`   │  ├─ Mapping: ${mapping.local_path}`)
          console.log(`   │  ├─ Has cache: ${!!mapping.git_data_cache}`)
          console.log(`   │  ├─ Cache commits: ${mapping.git_data_cache?.commits?.length || 0}`)

          if (!mapping.git_data_cache) {
            console.log(`   │  └─ ⚠️ No git_data_cache - needs initial scan`)
            continue
          }

          if (!mapping.git_data_cache.commits || mapping.git_data_cache.commits.length === 0) {
            console.log(`   │  └─ ⚠️ git_data_cache exists but has no commits`)
            continue
          }

          cacheFound = true
          const cachedData = mapping.git_data_cache

          // Add branch info
          allBranches.push({
            name: repo.name,
            path: mapping.local_path,
            branch: mapping.git_current_branch || cachedData.currentBranch || 'main',
            head: cachedData.commits[0]?.sha || 'cached',
            dirty: false,
            ahead: 0,
            behind: 0,
            localBranches: cachedData.branches?.filter((b: any) => b.isLocal).map((b: any) => b.name) || [],
            remoteBranches: cachedData.branches?.filter((b: any) => b.isRemote).map((b: any) => b.name) || [],
            remoteUrls: cachedData.remotes || {},
            lastChecked: mapping.git_data_last_updated,
            history: cachedData,
            fromCache: true
          })

          // Add commits with repository and local path tags
          if (cachedData.commits) {
            const taggedCommits = cachedData.commits.map((commit: any) => ({
              ...commit,
              repository: repo.name,
              localPath: mapping.local_path
            }))
            allCommits.push(...taggedCommits)
          }

          // Add users from contributors
          if (cachedData.summary?.contributors) {
            for (const contributor of cachedData.summary.contributors) {
              allUsers.push({
                userId: contributor.email || contributor.name,
                userName: contributor.name,
                userEmail: contributor.email,
                localPath: mapping.local_path,
                currentBranch: mapping.git_current_branch || 'main',
                status: 'cached',
                commitsToday: 0
              })
            }
          }
        }
      }

      if (cacheFound) {
        console.log(`✅ [GitDataManager] Loaded ${allBranches.length} repos, ${allCommits.length} commits from DB cache`)

        this.updateCache(projectId, {
          branches: allBranches,
          commits: allCommits,
          users: allUsers,
          uncommittedChanges: [],
          loading: false,
          error: null
        })

        return true
      }

      return false
    } catch (error) {
      console.error('❌ [GitDataManager] Error loading cache:', error)
      return false
    }
  }

  /**
   * Refresh git data in background
   */
  public async refreshGitData(projectId: string, userId?: string, silent = true): Promise<void> {
    // Prevent concurrent refreshes for same project
    if (this.fetchingProjects.has(projectId)) {
      console.log(`⚠️ [GitDataManager] Already refreshing project ${projectId}, skipping...`)
      return
    }

    this.fetchingProjects.add(projectId)

    if (!silent) {
      this.updateCache(projectId, { loading: true })
    }

    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.git?.readDirectGitState) {
        console.log('⚠️ [GitDataManager] Not in Electron environment or Git API unavailable')
        return
      }

      console.log(`🔄 [GitDataManager] Background refresh starting for project ${projectId}...`)

      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Get repositories with local mappings
      const query = supabase
        .from('repositories')
        .select(`
          id,
          name,
          full_name,
          local_mappings:repository_local_mappings(
            id,
            local_path,
            user_id,
            git_data_cache,
            git_data_last_updated
          )
        `)
        .eq('project_id', projectId)

      if (userId) {
        query.eq('local_mappings.user_id', userId)
      }

      const { data: repositories, error: repoError } = await query

      if (repoError || !repositories) {
        console.error('❌ [GitDataManager] Failed to fetch repositories:', repoError)
        return
      }

      const allBranches: GitBranch[] = []
      const allCommits: GitCommit[] = []
      const allUsers: GitUser[] = []
      const allUncommittedChanges: UncommittedChange[] = []

      for (const repo of repositories) {
        const mappings = repo.local_mappings || []

        for (const mapping of mappings) {
          try {
            // Read current git state (lightweight operation)
            const gitState = await electronAPI.git.readDirectGitState(mapping.local_path)

            if (!gitState) {
              console.log(`⚠️ [GitDataManager] ${mapping.local_path} is not a Git repository`)
              continue
            }

            // Parse uncommitted changes
            const uncommittedChanges: UncommittedChange[] = []
            if (gitState.statusShort) {
              const statusLines = gitState.statusShort.split('\n').filter((line: string) => line.trim())
              statusLines.forEach((line: string, index: number) => {
                const match = line.match(/^([A-Z?]{1,2})\s+(.+)$/)
                if (match) {
                  const status = match[1]
                  const filePath = match[2]

                  let changeType: UncommittedChange['changeType'] = 'MODIFIED'
                  if (status.includes('A')) changeType = 'ADDED'
                  else if (status.includes('D')) changeType = 'DELETED'
                  else if (status.includes('R')) changeType = 'RENAMED'
                  else if (status.includes('?')) changeType = 'UNTRACKED'

                  uncommittedChanges.push({
                    id: `${mapping.id}-${index}`,
                    filePath,
                    changeType,
                    status,
                    repository: repo.name,
                    localPath: mapping.local_path
                  })
                }
              })
            }

            allUncommittedChanges.push(...uncommittedChanges)

            // Sync file changes to database if there are uncommitted chang
            if (uncommittedChanges.length > 0 && gitState.fileChanges) {
              try {
                await this.syncFileChangesToDatabase(
                  projectId,
                  userId || mapping.user_id,
                  repo.id,
                  gitState.fileChanges
                )
                console.log(`💾 [GitDataManager] Synced ${gitState.fileChanges.length} file changes for ${repo.name}`)
              } catch (syncError) {
                console.error(`❌ [GitDataManager] Failed to sync file changes:`, syncError)
              }
            }

            // Check if cache is stale (older than 1 hour) or has changes
            const cacheAge = mapping.git_data_last_updated
              ? Date.now() - new Date(mapping.git_data_last_updated).getTime()
              : Infinity
            const cacheStale = cacheAge > 60 * 60 * 1000 // 1 hour
            const hasUncommittedChanges = uncommittedChanges.length > 0

            // Use cached data if available and not stale
            if (mapping.git_data_cache && mapping.git_data_cache.commits && !cacheStale) {
              console.log(`✅ [GitDataManager] ${repo.name} cache is fresh, using cached data`)
              const cachedData = mapping.git_data_cache

              allBranches.push({
                name: repo.name,
                path: mapping.local_path,
                branch: gitState.branch || 'main',
                head: gitState.head || cachedData.commits[0]?.sha,
                dirty: gitState.dirty || hasUncommittedChanges,
                ahead: gitState.ahead || 0,
                behind: gitState.behind || 0,
                localBranches: cachedData.branches?.filter((b: any) => b.isLocal).map((b: any) => b.name) || [],
                remoteBranches: cachedData.branches?.filter((b: any) => b.isRemote).map((b: any) => b.name) || [],
                remoteUrls: cachedData.remotes || {},
                lastChecked: mapping.git_data_last_updated,
                history: cachedData,
                fromCache: true
              })

              if (cachedData.commits) {
                // Tag commits with the repository and local path
                const taggedCommits = cachedData.commits.map((commit: any) => ({
                  ...commit,
                  repository: repo.name,
                  localPath: mapping.local_path
                }))
                allCommits.push(...taggedCommits)
              }

              if (cachedData.summary?.contributors) {
                for (const contributor of cachedData.summary.contributors) {
                  allUsers.push({
                    userId: contributor.email || contributor.name,
                    userName: contributor.name,
                    userEmail: contributor.email,
                    localPath: mapping.local_path,
                    currentBranch: gitState.branch || 'main',
                    status: 'active',
                    commitsToday: 0
                  })
                }
              }
            } else {
              // Cache is stale or missing - trigger refresh but continue processing other repos
              console.log(`🔄 [GitDataManager] ${repo.name} cache needs refresh (stale: ${cacheStale}, changes: ${hasUncommittedChanges})`)

              // Schedule async refresh for this specific mapping
              // Don't await it - let it happen in the background
              gitCacheRefreshService.refreshProjectRepositories(projectId, {
                forceRefresh: true,
                maxCommits: 2000
              }).catch(error => {
                console.error(`❌ [GitDataManager] Background refresh failed for ${repo.name}:`, error)
              })
            }
          } catch (error) {
            console.error(`❌ [GitDataManager] Error refreshing ${mapping.local_path}:`, error)
          }
        }
      }

      // Update cache with refreshed data
      this.updateCache(projectId, {
        branches: allBranches,
        commits: allCommits,
        users: allUsers,
        uncommittedChanges: allUncommittedChanges,
        loading: false,
        error: null
      })

      console.log(`✅ [GitDataManager] Refresh complete for project ${projectId}`)

    } catch (error) {
      console.error('❌ [GitDataManager] Error during refresh:', error)
      this.updateCache(projectId, {
        loading: false,
        error: error instanceof Error ? error.message : 'Refresh failed'
      })
    } finally {
      this.fetchingProjects.delete(projectId)
    }
  }

  /**
   * Start auto-refresh for a project
   */
  public startAutoRefresh(projectId: string, userId?: string, intervalMs = 5000): void {
    // Don't start if already running
    if (this.refreshIntervals.has(projectId)) {
      console.log(`🔄 [GitDataManager] Auto-refresh already running for project ${projectId}`)
      return
    }

    console.log(`🔄 [GitDataManager] Starting auto-refresh for project ${projectId} (${intervalMs}ms)`)

    const interval = setInterval(() => {
      this.refreshGitData(projectId, userId, true)
    }, intervalMs)

    this.refreshIntervals.set(projectId, interval)

    // Do initial refresh after short delay
    setTimeout(() => {
      this.refreshGitData(projectId, userId, true)
    }, 2000)
  }

  /**
   * Stop auto-refresh for a project
   */
  public stopAutoRefresh(projectId: string): void {
    const interval = this.refreshIntervals.get(projectId)
    if (interval) {
      clearInterval(interval)
      this.refreshIntervals.delete(projectId)
      console.log(`🛑 [GitDataManager] Auto-refresh stopped for project ${projectId}`)
    }
  }

  /**
   * Initialize data for a project (load cache then start refresh)
   */
  public async initializeProject(projectId: string, userId?: string, autoRefresh = true): Promise<void> {
    console.log(`🚀 [GitDataManager] Initializing project ${projectId}`)

    // Step 1: Try to load from cache first
    const hasCache = await this.loadFromDatabaseCache(projectId, userId)

    // Step 2: If no cache, do initial scan
    if (!hasCache) {
      console.log('📦 [GitDataManager] No cache found, doing initial scan...')
      await this.refreshGitData(projectId, userId, false)
    } else {
      // Step 3: Schedule background refresh
      console.log('⏱️ [GitDataManager] Cache loaded, scheduling background refresh...')
      setTimeout(() => {
        this.refreshGitData(projectId, userId, true)
      }, 2000)
    }

    // Step 4: Start auto-refresh if enabled
    if (autoRefresh) {
      this.startAutoRefresh(projectId, userId)
    }
  }

  /**
   * Clean up resources for a project
   */
  public cleanupProject(projectId: string): void {
    this.stopAutoRefresh(projectId)
    // Note: We keep the cache in memory for instant re-access
    console.log(`🧹 [GitDataManager] Cleaned up project ${projectId}`)
  }

  /**
   * Sync file changes to database directly via Supabase client
   */
  private async syncFileChangesToDatabase(
    projectId: string,
    userId: string,
    repositoryId: string,
    fileChanges: Array<{
      filePath: string
      changeType: string
      linesAdded: number
      linesRemoved: number
    }>
  ): Promise<void> {
    if (!fileChanges || fileChanges.length === 0) {
      return
    }

    try {
      // Get or create session for this project
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Get or create ONE session per project
      let sessionId: string | null = null

      const { data: existingSession } = await supabase
        .from('live_activity_sessions')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .limit(1)
        .single()

      if (existingSession) {
        sessionId = existingSession.id
      } else {
        // Create new session
        const { data: newSession, error: sessionError } = await supabase
          .from('live_activity_sessions')
          .insert({
            user_id: userId,
            project_id: projectId,
            repository_id: repositoryId,
            local_path: '',
            is_active: true
          })
          .select('id')
          .single()

        if (sessionError) {
          console.error('Failed to create session:', sessionError)
          return
        }

        sessionId = newSession?.id
      }

      if (!sessionId) {
        console.warn('No session ID available, skipping file changes sync')
        return
      }

      // Format file changes for database
      const formattedChanges = fileChanges.map(change => ({
        session_id: sessionId,
        user_id: userId,
        project_id: projectId,
        file_path: change.filePath,
        file_type: change.filePath.split('.').pop() || '',
        change_type: change.changeType,
        lines_added: change.linesAdded || 0,
        lines_removed: change.linesRemoved || 0,
        characters_added: 0,
        characters_removed: 0,
        first_change_at: new Date().toISOString(),
        last_change_at: new Date().toISOString()
      }))

      // Insert file changes directly
      const { error: insertError } = await supabase
        .from('live_file_changes')
        .upsert(formattedChanges, {
          onConflict: 'session_id,file_path',
          ignoreDuplicates: false
        })

      if (insertError) {
        console.error('❌ [GitDataManager] Failed to insert file changes:', insertError)
        return
      }

      console.log(`✅ [GitDataManager] Synced ${fileChanges.length} file changes directly to database`)
    } catch (error) {
      console.error('❌ [GitDataManager] Error syncing file changes:', error)
    }
  }

  /**
   * Clear all cache (for debugging)
   */
  public clearAllCache(): void {
    this.cache.clear()
    this.refreshIntervals.forEach(interval => clearInterval(interval))
    this.refreshIntervals.clear()
    console.log('🗑️ [GitDataManager] All cache cleared')
  }
}

// Export singleton instance (only in browser)
export const gitDataManager = typeof window !== 'undefined'
  ? GitDataManagerService.getInstance()
  : null as any as GitDataManagerService
