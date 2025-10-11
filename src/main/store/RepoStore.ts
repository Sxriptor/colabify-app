// JSON-based repository configuration and state storage

import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { RepoConfig, RepoState } from '../../shared/types'

interface RepoStoreData {
  repositories: Record<string, RepoConfig>
  version: string
}

export class RepoStore {
  private static readonly STORE_FILE = 'repos.json'
  private static readonly STORE_VERSION = '1.0.0'
  
  private repositories: Map<string, RepoConfig> = new Map()
  private storePath: string
  private loaded: boolean = false

  constructor() {
    this.storePath = join(app.getPath('userData'), RepoStore.STORE_FILE)
  }

  /**
   * Load repository configurations from JSON file
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.storePath, 'utf-8')
      const parsed: RepoStoreData = JSON.parse(data)
      
      // Validate store version
      if (parsed.version !== RepoStore.STORE_VERSION) {
        console.warn(`Store version mismatch. Expected ${RepoStore.STORE_VERSION}, got ${parsed.version}`)
      }

      // Load repositories into memory
      this.repositories.clear()
      for (const [id, config] of Object.entries(parsed.repositories || {})) {
        this.repositories.set(id, config)
      }

      this.loaded = true
      console.log(`✅ Loaded ${this.repositories.size} repository configurations`)
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist, start with empty store
        console.log('📁 Repository store file not found, starting with empty store')
        this.loaded = true
      } else {
        console.error('❌ Failed to load repository store:', error)
        throw error
      }
    }
  }

  /**
   * Save repository configurations to JSON file
   */
  async save(): Promise<void> {
    try {
      const data: RepoStoreData = {
        version: RepoStore.STORE_VERSION,
        repositories: Object.fromEntries(this.repositories)
      }

      await fs.writeFile(this.storePath, JSON.stringify(data, null, 2), 'utf-8')
      console.log(`✅ Saved ${this.repositories.size} repository configurations`)
    } catch (error) {
      console.error('❌ Failed to save repository store:', error)
      throw error
    }
  }

  /**
   * Get all repository configurations for a project
   * @param projectId Project ID to filter by
   * @returns Array of repository configurations
   */
  listByProject(projectId: string): RepoConfig[] {
    this.ensureLoaded()
    
    const configs: RepoConfig[] = []
    for (const config of this.repositories.values()) {
      if (config.projectId === projectId) {
        configs.push({ ...config }) // Return copy to prevent mutations
      }
    }
    
    return configs
  }

  /**
   * Create or update a repository configuration
   * @param repoCfg Repository configuration to upsert
   */
  upsert(repoCfg: RepoConfig): void {
    this.ensureLoaded()
    
    // Validate required fields
    if (!repoCfg.id || !repoCfg.projectId || !repoCfg.path) {
      throw new Error('Repository configuration missing required fields')
    }

    this.repositories.set(repoCfg.id, { ...repoCfg })
    
    // Auto-save after modifications (async, don't wait)
    this.save().catch(error => {
      console.error('Failed to auto-save repository store:', error)
    })
  }

  /**
   * Get a specific repository configuration
   * @param repoId Repository ID
   * @returns Repository configuration or null if not found
   */
  get(repoId: string): RepoConfig | null {
    this.ensureLoaded()
    
    const config = this.repositories.get(repoId)
    return config ? { ...config } : null // Return copy to prevent mutations
  }

  /**
   * Update the last known state for a repository
   * @param repoId Repository ID
   * @param state New repository state
   */
  saveLast(repoId: string, state: RepoState): void {
    this.ensureLoaded()
    
    const config = this.repositories.get(repoId)
    if (!config) {
      console.warn(`Attempted to save state for unknown repository: ${repoId}`)
      return
    }

    // Update the last known state
    config.last = { ...state }
    this.repositories.set(repoId, config)
    
    // Auto-save after modifications (async, don't wait)
    this.save().catch(error => {
      console.error('Failed to auto-save repository store after state update:', error)
    })
  }

  /**
   * Remove a repository configuration
   * @param repoId Repository ID to remove
   * @returns True if repository was removed, false if not found
   */
  remove(repoId: string): boolean {
    this.ensureLoaded()
    
    const existed = this.repositories.delete(repoId)
    
    if (existed) {
      // Auto-save after modifications (async, don't wait)
      this.save().catch(error => {
        console.error('Failed to auto-save repository store after removal:', error)
      })
    }
    
    return existed
  }

  /**
   * Get all repository configurations
   * @returns Array of all repository configurations
   */
  getAll(): RepoConfig[] {
    this.ensureLoaded()
    
    return Array.from(this.repositories.values()).map(config => ({ ...config }))
  }

  /**
   * Get all repositories that are currently being watched
   * @returns Array of watched repository configurations
   */
  getWatched(): RepoConfig[] {
    this.ensureLoaded()
    
    return this.getAll().filter(config => config.watching)
  }

  /**
   * Clear all repository configurations (for testing/reset)
   */
  clear(): void {
    this.repositories.clear()
    
    // Auto-save after modifications (async, don't wait)
    this.save().catch(error => {
      console.error('Failed to auto-save repository store after clear:', error)
    })
  }

  /**
   * Get the number of stored repositories
   */
  size(): number {
    this.ensureLoaded()
    return this.repositories.size
  }

  /**
   * Check if the store has been loaded
   */
  isLoaded(): boolean {
    return this.loaded
  }

  /**
   * Ensure the store has been loaded before operations
   */
  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error('Repository store not loaded. Call load() first.')
    }
  }
}