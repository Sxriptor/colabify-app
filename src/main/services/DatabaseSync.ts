// Database synchronization service for Git monitoring backend
// Syncs watch state between Supabase and local Git monitoring

import { RepoConfig, RepoState } from '../../shared/types'
import { RepoStore } from '../store/RepoStore'

export interface ProjectWatch {
  id: string
  user_id: string
  project_id: string
  created_at: string
  updated_at: string
}

export interface ProjectWithRepos {
  id: string
  name: string
  repositories?: Array<{
    id: string
    name: string
    full_name: string
    url: string
    local_mappings?: Array<{
      id: string
      local_path: string
      user_id: string
    }>
  }>
  watches?: ProjectWatch[]
}

export class DatabaseSync {
  private repoStore: RepoStore

  constructor(repoStore: RepoStore) {
    this.repoStore = repoStore
  }

  /**
   * Sync watched projects from database to Git monitoring backend
   * This should be called on startup to restore watch state
   */
  async syncWatchedProjects(currentUserId: string): Promise<string[]> {
    try {
      console.log('🔄 Syncing watched projects from database...')

      // In a real implementation, this would query Supabase
      // For now, we'll simulate the data structure
      const watchedProjectIds: string[] = []

      // TODO: Replace with actual Supabase query
      // const { data: projects } = await supabase
      //   .from('projects')
      //   .select(`
      //     id,
      //     name,
      //     repositories(id, name, full_name, url, local_mappings(id, local_path, user_id)),
      //     watches:project_watches!project_watches_project_id_fkey(id, user_id)
      //   `)
      //   .eq('watches.user_id', currentUserId)

      // For each watched project, sync repository configurations
      // for (const project of projects || []) {
      //   if (project.watches?.some(w => w.user_id === currentUserId)) {
      //     watchedProjectIds.push(project.id)
      //     await this.syncProjectRepositories(project)
      //   }
      // }

      console.log(`✅ Synced ${watchedProjectIds.length} watched projects`)
      return watchedProjectIds

    } catch (error) {
      console.error('❌ Failed to sync watched projects:', error)
      return []
    }
  }

  /**
   * Sync repository configurations for a project
   */
  async syncProjectRepositories(project: ProjectWithRepos): Promise<void> {
    try {
      if (!project.repositories) return

      for (const repo of project.repositories) {
        // Get local mappings for this repository
        const localMappings = repo.local_mappings || []

        for (const mapping of localMappings) {
          // Create or update repository configuration
          const repoConfig: RepoConfig = {
            id: `${repo.id}-${mapping.id}`, // Composite ID
            projectId: project.id,
            path: mapping.local_path,
            watching: true, // If project is watched, repos are watched
            last: this.createInitialRepoState()
          }

          // Store in local Git monitoring store
          this.repoStore.upsert(repoConfig)
        }
      }

      console.log(`✅ Synced ${project.repositories.length} repositories for project ${project.id}`)

    } catch (error) {
      console.error(`❌ Failed to sync repositories for project ${project.id}:`, error)
    }
  }

  /**
   * Create initial repository state
   */
  private createInitialRepoState(): RepoState {
    return {
      branch: '',
      head: '',
      statusShort: '',
      upstream: undefined,
      ahead: 0,
      behind: 0,
      localBranches: [],
      remoteBranches: []
    }
  }

  /**
   * Get watched project IDs from database
   * This is a helper method for the Git monitoring backend
   */
  async getWatchedProjectIds(currentUserId: string): Promise<string[]> {
    try {
      // TODO: Replace with actual Supabase query
      // const { data } = await supabase
      //   .from('project_watches')
      //   .select('project_id')
      //   .eq('user_id', currentUserId)
      
      // return data?.map(w => w.project_id) || []

      // For now, return empty array
      return []

    } catch (error) {
      console.error('❌ Failed to get watched project IDs:', error)
      return []
    }
  }

  /**
   * Check if a project is being watched by the current user
   */
  async isProjectWatched(projectId: string, currentUserId: string): Promise<boolean> {
    try {
      // TODO: Replace with actual Supabase query
      // const { data } = await supabase
      //   .from('project_watches')
      //   .select('id')
      //   .eq('project_id', projectId)
      //   .eq('user_id', currentUserId)
      //   .single()
      
      // return !!data

      // For now, return false
      return false

    } catch (error) {
      console.warn(`Failed to check watch status for project ${projectId}:`, error)
      return false
    }
  }
}