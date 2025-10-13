export interface GitHubBranch {
  name: string
  commit: {
    sha: string
    author: {
      login: string
      avatar_url: string
    }
    commit: {
      author: {
        name: string
        date: string
      }
      message: string
    }
  }
  protected: boolean
  aheadBy?: number
  behindBy?: number
  isDefault?: boolean
  // Local Git data properties (when fetched from backend)
  branch?: string
  head?: string
  dirty?: boolean
  ahead?: number
  behind?: number
  localBranches?: string[]
  remoteBranches?: string[]
  path?: string
  user?: any
  id?: string
  // Placeholder repository properties
  isPlaceholder?: boolean
  notFoundOnPC?: boolean
  hasError?: boolean
  gitReadError?: boolean
  errorMessage?: string
  usingCachedData?: boolean
  noCachedData?: boolean
}

export interface GitHubCommit {
  sha: string
  commit: {
    author: {
      name: string
      email: string
      date: string
    }
    message: string
  }
  author: {
    login: string
    avatar_url: string
  }
  stats?: {
    additions: number
    deletions: number
  }
}

export interface LocalUserLocation {
  userId: string
  userName: string
  userEmail: string
  localPath: string
  currentBranch?: string
  lastActivity?: string
  status: 'online' | 'away' | 'offline'
  commitsToday?: number
}

export interface BranchNode {
  id: string
  name: string
  x: number
  y: number
  color: string
  isDefault?: boolean
  protected?: boolean
  commits: GitHubCommit[]
  connections: string[]
}

export type DataSource = 'backend' | 'github' | 'mock'
export type GitHubDataSource = 'connected' | 'disconnected'
export type ActiveTab = 'remote' | 'local'
