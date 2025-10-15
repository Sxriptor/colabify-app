import { GitHubBranch, GitHubCommit } from '../types'
import { StatusCard } from '../shared/StatusCard'
import { BackendStatus } from '../shared/BackendStatus'
import { LocalBranchList } from '../local/LocalBranchList'
import { RecentActivity } from '../local/RecentActivity'
import { CommitBubbles } from '../local/CommitBubbles'
import { BranchTimeline } from '../local/BranchTimeline'
import { ContributorGraph } from '../local/ContributorGraph'
import { ContributionCalendar } from '../local/ContributionCalendar'
import { LocalActivityLog } from '../local/LocalActivityLog'

interface RemoteRepositoryViewProps {
  branches: GitHubBranch[]
  commits: GitHubCommit[]
  project: any
}

export function RemoteRepositoryView({ branches, commits, project }: RemoteRepositoryViewProps) {
  // Parse repository info from URL
  const repoUrl = project?.repositories?.[0]?.url || ''
  let owner = 'unknown'
  let repoName = 'unknown'

  if (repoUrl) {
    try {
      const urlParts = repoUrl
        .replace('https://github.com/', '')
        .replace('http://github.com/', '')
        .replace('.git', '')
        .split('/')

      if (urlParts.length >= 2) {
        owner = urlParts[0]
        repoName = urlParts[1]
      }
    } catch (error) {
      console.warn('Failed to parse repository URL:', repoUrl)
    }
  }

  const avatarUrl = `https://github.com/${owner}.png`

  // Find default branch (usually main or master)
  const defaultBranch = branches.find(b => b.isDefault || b.name === 'main' || b.name === 'master') || branches[0]

  if (branches.length === 0) {
    return (
      <div className="text-center py-12 border border-gray-800 bg-black">
        <div className="text-gray-600 font-mono text-4xl mb-4">[ NO.DATA.AVAILABLE ]</div>
        <div className="text-gray-400 font-mono text-sm">NO.REMOTE.REPOSITORY.DATA.FOUND</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border border-gray-800 bg-black">
        <div className="border-b border-gray-800 p-4">
          <div className="flex items-center space-x-3">
            <img
              src={avatarUrl}
              alt={owner}
              className="w-6 h-6 rounded-sm"
              onError={(e) => {
                e.currentTarget.src = '/default-avatar.png'
              }}
            />
            <div>
              <h3 className="text-white font-mono text-sm">{repoName.toUpperCase()}</h3>
              <p className="text-gray-400 font-mono text-xs">
                {repoUrl} • Reading from GitHub API
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Branch & Status */}
          <div className="grid grid-cols-3 gap-6">
            <StatusCard
              label="DEFAULT.BRANCH"
              value={defaultBranch?.name || 'main'}
              subtext={defaultBranch?.commit?.sha?.substring(0, 8) || 'unknown'}
            />
            <StatusCard
              label="TOTAL.BRANCHES"
              value={branches.length.toString()}
              subtext={`${branches.filter(b => b.protected).length} protected`}
            />
            <StatusCard
              label="RECENT.COMMITS"
              value={commits.length.toString()}
              subtext="From GitHub API"
            />
          </div>

          <LocalBranchList activeRepo={defaultBranch} branches={branches} />
          <RecentActivity commits={commits} />
        </div>
      </div>

      <BackendStatus dataSource="github" />

      {/* D3.js Circle Pack Visualization */}
      <div className="space-y-6">
        <CommitBubbles commits={commits} />
        <BranchTimeline commits={commits} branches={branches} />
        <ContributorGraph commits={commits} />
      </div>

      {/* GitHub-style Contribution Calendar */}
      <ContributionCalendar commits={commits} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <LocalActivityLog commits={commits} />
      </div>
    </div>
  )
}
