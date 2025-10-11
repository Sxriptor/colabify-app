// Safe Git command execution utility

import { spawn } from 'child_process'
import { GitCommandResult } from '../../shared/types'

export class GitExecutor {
  private static readonly DEFAULT_TIMEOUT = 30000 // 30 seconds
  private static readonly GIT_COMMAND = 'git'

  /**
   * Execute a Git command safely without shell interpolation
   * @param args Git command arguments
   * @param cwd Working directory for the command
   * @param timeout Command timeout in milliseconds
   * @returns Promise resolving to command output
   */
  static async exec(
    args: string[], 
    cwd: string, 
    timeout: number = GitExecutor.DEFAULT_TIMEOUT
  ): Promise<GitCommandResult> {
    return new Promise((resolve, reject) => {
      // Validate arguments to prevent injection
      if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string')) {
        reject(new Error('Invalid Git command arguments'))
        return
      }

      // Validate working directory
      if (!cwd || typeof cwd !== 'string') {
        reject(new Error('Invalid working directory'))
        return
      }

      let stdout = ''
      let stderr = ''

      // Spawn Git process without shell
      const gitProcess = spawn(GitExecutor.GIT_COMMAND, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false, // Critical: no shell to prevent injection
        windowsHide: true
      })

      // Set up timeout
      const timeoutId = setTimeout(() => {
        gitProcess.kill('SIGTERM')
        reject(new Error(`Git command timed out after ${timeout}ms`))
      }, timeout)

      // Collect stdout
      gitProcess.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      // Collect stderr
      gitProcess.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      // Handle process completion
      gitProcess.on('close', (code) => {
        clearTimeout(timeoutId)
        
        if (code === 0) {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
        } else {
          const error = new Error(`Git command failed with code ${code}: ${stderr || 'Unknown error'}`)
          ;(error as any).code = code
          ;(error as any).stderr = stderr
          ;(error as any).command = `git ${args.join(' ')}`
          reject(error)
        }
      })

      // Handle process errors
      gitProcess.on('error', (error) => {
        clearTimeout(timeoutId)
        const enhancedError = new Error(`Failed to execute Git command: ${error.message}`)
        ;(enhancedError as any).originalError = error
        ;(enhancedError as any).command = `git ${args.join(' ')}`
        reject(enhancedError)
      })
    })
  }

  /**
   * Check if a directory is a Git repository
   * @param cwd Directory to check
   * @returns Promise resolving to true if it's a Git repo
   */
  static async isGitRepository(cwd: string): Promise<boolean> {
    try {
      await GitExecutor.exec(['rev-parse', '--git-dir'], cwd, 5000)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the root directory of a Git repository
   * @param cwd Directory within the Git repo
   * @returns Promise resolving to the repo root path
   */
  static async getRepositoryRoot(cwd: string): Promise<string> {
    const result = await GitExecutor.exec(['rev-parse', '--show-toplevel'], cwd)
    return result.stdout.trim()
  }
}