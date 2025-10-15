/**
 * Unified Git Data Hook - SINGLE SOURCE OF TRUTH with PERSISTENT CACHE
 *
 * ✨ INSTANT DATABASE CACHE LOADING ON APP OPEN ✨
 * ✨ CACHE PERSISTS ACROSS TAB SWITCHES ✨
 *
 * Flow:
 * 1. App opens → Load git_data_cache from database → INSTANT display (0ms)
 * 2. Tab switch → Load from singleton cache → INSTANT display (0ms)
 * 3. Background: Only refresh if cache stale (>1hr) or changes detected
 */

console.log('🔥 [MODULE] useUnifiedGitData.ts is being imported!')

import { useState, useEffect, useRef } from 'react'
import { gitDataManager } from '@/services/GitDataManager'
import type {
  ProjectGitData,
  GitBranch,
  GitCommit,
  GitUser,
  UncommittedChange
} from '@/services/GitDataManager'

export type { GitBranch, GitCommit, GitUser, UncommittedChange }

export interface UseUnifiedGitDataOptions {
  projectId: string
  userId?: string
  autoRefresh?: boolean
  refreshIntervalMs?: number
}

export function useUnifiedGitData(options: UseUnifiedGitDataOptions) {
  const { projectId, userId, autoRefresh = true, refreshIntervalMs = 5000 } = options

  const [branches, setBranches] = useState<GitBranch[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [users, setUsers] = useState<GitUser[]>([])
  const [uncommittedChanges, setUncommittedChanges] = useState<UncommittedChange[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [usingCache, setUsingCache] = useState(false)

  const initializedRef = useRef(false)

  /**
   * Update local state from ProjectGitData
   */
  const updateFromProjectData = (data: ProjectGitData) => {
    console.log(`📊 [useUnifiedGitData] Updating state for project ${projectId}`)
    console.log(`   ├─ Branches: ${data.branches.length}`)
    console.log(`   ├─ Commits: ${data.commits.length}`)
    console.log(`   └─ Loading: ${data.loading}`)

    setBranches(data.branches)
    setCommits(data.commits)
    setUsers(data.users)
    setUncommittedChanges(data.uncommittedChanges)
    setError(data.error)
    setLastUpdated(data.lastUpdated)

    // If we have data, show it (don't keep loading spinner)
    if (data.branches.length > 0 || data.commits.length > 0) {
      setLoading(false)
      const isFromCache = data.branches.some(b => b.fromCache)
      setUsingCache(isFromCache)
      setIsRefreshing(data.loading) // Background refresh
    } else {
      setLoading(data.loading)
    }
  }

  /**
   * Initialize on mount
   */
  useEffect(() => {
    if (!projectId) {
      console.warn(`⚠️ [useUnifiedGitData] No projectId provided`)
      return
    }

    if (!gitDataManager) {
      console.warn(`⚠️ [useUnifiedGitData] GitDataManager not available (SSR?)`)
      setLoading(false)
      return
    }

    if (initializedRef.current) {
      console.log(`⚠️ [useUnifiedGitData] Already initialized for ${projectId}, skipping`)
      return
    }

    console.log(`🚀 [useUnifiedGitData] Initializing for project ${projectId}`)
    initializedRef.current = true

    // STEP 1: Check singleton cache (instant for tab switches)
    const cachedData = gitDataManager.getCachedData(projectId)

    if (cachedData) {
      console.log(`💨 [useUnifiedGitData] INSTANT from singleton cache!`)
      console.log(`   ├─ ${cachedData.branches.length} branches`)
      console.log(`   ├─ ${cachedData.commits.length} commits`)
      console.log(`   └─ ${cachedData.lastUpdated.toISOString()}`)
      updateFromProjectData(cachedData)
    } else {
      // STEP 2: Initialize from database cache (instant for app open)
      console.log(`📦 [useUnifiedGitData] Loading from DATABASE cache...`)
      setLoading(true)

      gitDataManager.initializeProject(projectId, userId, autoRefresh)
        .then(() => {
          const data = gitDataManager.getCachedData(projectId)
          if (data) {
            console.log(`✅ [useUnifiedGitData] Loaded from database cache!`)
            console.log(`   ├─ ${data.branches.length} branches`)
            console.log(`   └─ ${data.commits.length} commits`)
            updateFromProjectData(data)
          } else {
            console.warn(`⚠️ [useUnifiedGitData] No data after initialization`)
            setLoading(false)
          }
        })
        .catch(error => {
          console.error(`❌ [useUnifiedGitData] Init failed:`, error)
          setLoading(false)
          setError(error instanceof Error ? error.message : 'Initialization failed')
        })
    }

    // STEP 3: Subscribe to live updates
    const unsubscribe = gitDataManager.subscribe(projectId, (_, data) => {
      console.log(`📡 [useUnifiedGitData] Update received from singleton`)
      updateFromProjectData(data)
    })

    // STEP 4: Start auto-refresh if requested
    if (autoRefresh) {
      gitDataManager.startAutoRefresh(projectId, userId, refreshIntervalMs)
    }

    // Cleanup
    return () => {
      console.log(`🧹 [useUnifiedGitData] Cleanup for ${projectId}`)
      unsubscribe()
      // Cache persists for other components/tabs
    }
  }, [projectId, userId, autoRefresh, refreshIntervalMs])

  const refresh = async () => {
    setIsRefreshing(true)
    await gitDataManager.refreshGitData(projectId, userId, false)
  }

  return {
    branches,
    commits,
    users,
    uncommittedChanges,
    loading,
    error,
    isRefreshing,
    lastUpdated,
    usingCache,
    refresh
  }
}
