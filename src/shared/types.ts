// Core types for Git monitoring backend

// Project and Repository Configuration
export interface Project {
  id: string
  name: string
  remoteUrl?: string
  repoFolders: string[]
  watching: boolean
}

export interface RepoConfig {
  id: string
  projectId: string
  path: string
  watching: boolean
  last: RepoState
}

// Repository State
export interface RepoState {
  branch: string           // Current branch name or "DETACHED"
  head: string            // Current commit SHA
  statusShort: string     // Git status --short output
  upstream?: string       // Upstream branch (e.g., "origin/main")
  ahead: number          // Commits ahead of upstream
  behind: number         // Commits behind upstream
  remoteBranches: string[] // List of remote branch names
  localBranches: string[]  // List of local branch names
  remoteUrls?: Record<string, string> // Remote URLs (e.g., {"origin": "https://github.com/user/repo.git"})
}

// Activity Events
export type ActivityType = 
  | 'BRANCH_CREATED' 
  | 'BRANCH_SWITCH' 
  | 'COMMIT' 
  | 'PUSH' 
  | 'MERGE' 
  | 'REMOTE_UPDATE' 
  | 'WORKTREE_CHANGE' 
  | 'ERROR'

export interface Activity {
  projectId: string
  repoId: string
  type: ActivityType
  details: any
  at: string
}

// Activity Details by Type
export interface ActivityDetails {
  // Branch events
  BRANCH_CREATED: { name: string, scope: 'local' | 'remote' }
  BRANCH_SWITCH: { from: string, to: string }
  
  // Commit events  
  COMMIT: { branch: string, head: string, author: string, subject: string }
  MERGE: { branch: string, head: string, parentsCount: number }
  
  // Remote events
  PUSH: { branch: string, head: string }
  REMOTE_UPDATE: { branch: string, ahead: number, behind: number }
  
  // Working tree events
  WORKTREE_CHANGE: { summary: string }
  
  // Error events
  ERROR: { message: string, command?: string }
}

// IPC Event Payloads
export interface GitEventPayload {
  evt: 'activity' | 'error' | 'watchingOn' | 'watchingOff'
  projectId: string
  repoId?: string
  [key: string]: any
}

// Git Command Result
export interface GitCommandResult {
  stdout: string
  stderr?: string
}

// Git Commit Metadata
export interface GitCommitMeta {
  hash: string
  author: string
  subject: string
}

// Upstream Information
export interface UpstreamInfo {
  upstream?: string
  ahead: number
  behind: number
}