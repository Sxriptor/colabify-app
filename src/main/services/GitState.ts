// Git state reading service with lightweight operations

import { GitExecutor } from '../util/gitExec'
import { RepoState, GitCommitMeta, UpstreamInfo } from '../../shared/types'

export class GitState {
  /**
   * Get the current branch name
   * @param cwd Repository working directory
   * @returns Current branch name or "DETACHED" if in detached HEAD state
   */
  static async getBranch(cwd: string): Promise<string> {
    try {
      const result = await GitExecutor.exec(['symbolic-ref', '-q', '--short', 'HEAD'], cwd)
      return result.stdout.trim()
    } catch {
      // Fallback for detached HEAD state
      return 'DETACHED'
    }
  }

  /**
   * Get the current HEAD commit hash
   * @param cwd Repository working directory
   * @returns Current commit SHA
   */
  static async getHead(cwd: string): Promise<string> {
    const result = await GitExecutor.exec(['rev-parse', 'HEAD'], cwd)
    return result.stdout.trim()
  }

  /**
   * Get the short status of the working tree
   * @param cwd Repository working directory
   * @returns Git status --short output
   */
  static async getStatusShort(cwd: string): Promise<string> {
    try {
      const result = await GitExecutor.exec(['status', '--short'], cwd)
      return result.stdout.trim()
    } catch (error) {
      console.warn('Failed to get Git status:', error)
      return ''
    }
  }

  /**
   * Get upstream tracking information and ahead/behind counts
   * @param cwd Repository working directory
   * @returns Upstream information with ahead/behind counts
   */
  static async getUpstreamAheadBehind(cwd: string): Promise<UpstreamInfo> {
    try {
      const result = await GitExecutor.exec(['branch', '-vv', '--no-color'], cwd)
      const lines = result.stdout.split('\n')
      
      // Find the current branch line (starts with *)
      const currentBranchLine = lines.find(line => line.startsWith('*'))
      if (!currentBranchLine) {
        return { ahead: 0, behind: 0 }
      }

      // Parse upstream info from branch -vv output
      // Format: * main abc1234 [origin/main: ahead 2, behind 1] Commit message
      const upstreamMatch = currentBranchLine.match(/\[([^:\]]+)(?:: ([^\]]+))?\]/)
      if (!upstreamMatch) {
        return { ahead: 0, behind: 0 }
      }

      const upstream = upstreamMatch[1]
      const statusText = upstreamMatch[2] || ''
      
      let ahead = 0
      let behind = 0

      // Parse ahead/behind counts
      const aheadMatch = statusText.match(/ahead (\d+)/)
      const behindMatch = statusText.match(/behind (\d+)/)
      
      if (aheadMatch) ahead = parseInt(aheadMatch[1], 10)
      if (behindMatch) behind = parseInt(behindMatch[1], 10)

      return { upstream, ahead, behind }
    } catch (error) {
      console.warn('Failed to get upstream info:', error)
      return { ahead: 0, behind: 0 }
    }
  }

  /**
   * Get metadata for the last commit
   * @param cwd Repository working directory
   * @returns Last commit hash, author, and subject
   */
  static async getLastCommitMeta(cwd: string): Promise<GitCommitMeta> {
    try {
      // Use ASCII unit separator (0x1f) to separate fields
      const result = await GitExecutor.exec(['log', '-1', '--pretty=%H%x1f%an%x1f%s'], cwd)
      const parts = result.stdout.split('\x1f')
      
      return {
        hash: parts[0] || '',
        author: parts[1] || '',
        subject: parts[2] || ''
      }
    } catch (error) {
      console.warn('Failed to get last commit metadata:', error)
      return { hash: '', author: '', subject: '' }
    }
  }

  /**
   * Check if the current HEAD is a merge commit
   * @param cwd Repository working directory
   * @returns True if HEAD is a merge commit (has multiple parents)
   */
  static async isMergeHead(cwd: string): Promise<boolean> {
    try {
      const result = await GitExecutor.exec(['log', '-1', '--pretty=%P'], cwd)
      const parents = result.stdout.trim().split(' ').filter(p => p.length > 0)
      return parents.length >= 2
    } catch (error) {
      console.warn('Failed to check merge head:', error)
      return false
    }
  }

  /**
   * List all local branches
   * @param cwd Repository working directory
   * @returns Array of local branch names
   */
  static async listLocalBranches(cwd: string): Promise<string[]> {
    try {
      const result = await GitExecutor.exec([
        'for-each-ref', 
        'refs/heads', 
        '--format=%(refname:short)'
      ], cwd)
      
      return result.stdout
        .split('\n')
        .map(branch => branch.trim())
        .filter(branch => branch.length > 0)
    } catch (error) {
      console.warn('Failed to list local branches:', error)
      return []
    }
  }

  /**
   * List all remote branches
   * @param cwd Repository working directory
   * @returns Array of remote branch names (e.g., "origin/main")
   */
  static async listRemoteBranches(cwd: string): Promise<string[]> {
    try {
      const result = await GitExecutor.exec([
        'for-each-ref', 
        'refs/remotes', 
        '--format=%(refname:short)'
      ], cwd)
      
      return result.stdout
        .split('\n')
        .map(branch => branch.trim())
        .filter(branch => branch.length > 0)
    } catch (error) {
      console.warn('Failed to list remote branches:', error)
      return []
    }
  }

  /**
   * Read complete repository state
   * @param cwd Repository working directory
   * @returns Complete repository state object
   */
  static async readRepoState(cwd: string): Promise<RepoState> {
    try {
      // Execute all Git commands in parallel for efficiency
      const [
        branch,
        head,
        statusShort,
        upstreamInfo,
        localBranches,
        remoteBranches,
        remoteUrls
      ] = await Promise.all([
        GitState.getBranch(cwd),
        GitState.getHead(cwd),
        GitState.getStatusShort(cwd),
        GitState.getUpstreamAheadBehind(cwd),
        GitState.listLocalBranches(cwd),
        GitState.listRemoteBranches(cwd),
        GitState.getRemoteUrls(cwd)
      ])

      return {
        branch,
        head,
        statusShort,
        upstream: upstreamInfo.upstream,
        ahead: upstreamInfo.ahead,
        behind: upstreamInfo.behind,
        localBranches,
        remoteBranches,
        remoteUrls
      }
    } catch (error) {
      console.error('Failed to read repository state:', error)
      throw error
    }
  }

  /**
   * Perform a Git fetch operation
   * @param cwd Repository working directory
   * @returns Promise that resolves when fetch completes
   */
  static async fetch(cwd: string): Promise<void> {
    try {
      await GitExecutor.exec(['fetch', '--prune'], cwd, 60000) // 60 second timeout for fetch
    } catch (error) {
      console.warn('Git fetch failed:', error)
      throw error
    }
  }

  /**
   * Get remote URLs for the repository
   * @param cwd Repository working directory
   * @returns Object with remote names and their URLs
   */
  static async getRemoteUrls(cwd: string): Promise<Record<string, string>> {
    try {
      const result = await GitExecutor.exec(['remote', '-v'], cwd)
      const remotes: Record<string, string> = {}
      
      const lines = result.stdout.split('\n')
      for (const line of lines) {
        const match = line.match(/^(\w+)\s+(.+?)\s+\(fetch\)$/)
        if (match) {
          const [, remoteName, remoteUrl] = match
          remotes[remoteName] = remoteUrl
        }
      }
      
      return remotes
    } catch (error) {
      console.warn('Failed to get remote URLs:', error)
      return {}
    }
  }

  /**
   * Parse GitHub owner and repository name from a remote URL
   * @param remoteUrl Git remote URL
   * @returns Object with owner and repository name, or null if not a GitHub URL
   */
  static parseGitHubUrl(remoteUrl: string): { owner: string; repo: string } | null {
    try {
      // Handle different GitHub URL formats
      let cleanUrl = remoteUrl
      
      // SSH format: git@github.com:owner/repo.git
      if (cleanUrl.startsWith('git@github.com:')) {
        cleanUrl = cleanUrl.replace('git@github.com:', 'https://github.com/')
      }
      
      // HTTPS format: https://github.com/owner/repo.git
      if (cleanUrl.includes('github.com')) {
        const match = cleanUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/)?$/)
        if (match) {
          return {
            owner: match[1],
            repo: match[2]
          }
        }
      }
      
      return null
    } catch (error) {
      console.warn('Failed to parse GitHub URL:', remoteUrl, error)
      return null
    }
  }

  /**
   * Check recent reflog for push operations
   * @param cwd Repository working directory
   * @param sinceMinutes How many minutes back to check
   * @returns True if a push was detected in the reflog
   */
  static async detectRecentPush(cwd: string, sinceMinutes: number = 2): Promise<boolean> {
    try {
      const result = await GitExecutor.exec([
        'reflog', 
        '--date=iso', 
        `--since=${sinceMinutes} minutes ago`
      ], cwd)
      
      // Look for push-related entries in reflog
      return result.stdout.toLowerCase().includes('push')
    } catch (error) {
      console.warn('Failed to check reflog for push:', error)
      return false
    }
  }
}