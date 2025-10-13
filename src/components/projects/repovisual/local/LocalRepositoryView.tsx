import { GitHubBranch, GitHubCommit, LocalUserLocation, DataSource } from '../types'
import { getLocalRepositoryInfo } from '../utils'
import { StatusCard } from '../shared/StatusCard'
import { BackendStatus } from '../shared/BackendStatus'

import { LocalBranchList } from './LocalBranchList'
import { RecentActivity } from './RecentActivity'
import { LocalActivityLog } from './LocalActivityLog'
import { TeamStatus } from './TeamStatus'
import { CommitBubbles } from './CommitBubbles'
import { BranchTimeline } from './BranchTimeline'
import { ContributorGraph } from './ContributorGraph'
import { ContributionCalendar } from './ContributionCalendar'

interface LocalRepositoryViewProps {
  branches: GitHubBranch[]
  commits: GitHubCommit[]
  localUsers: LocalUserLocation[]
  activeLocalRepo: string
  dataSource: DataSource
  project: any
}

export function LocalRepositoryView({
  branches,
  commits,
  localUsers,
  activeLocalRepo,
  dataSource,
  project
}: LocalRepositoryViewProps) {
  const activeIndex = activeLocalRepo ? parseInt(activeLocalRepo.split('-')[1]) : 0
  const activeRepo = branches[activeIndex]

  if (!activeRepo) {
    return (
      <div className="text-center py-12 border border-gray-800 bg-black">
        <div className="text-gray-600 font-mono text-4xl mb-4">[ NO.DATA.AVAILABLE ]</div>
        <div className="text-gray-400 font-mono text-sm">NO.LOCAL.REPOSITORY.DATA.FOUND</div>
      </div>
    )
  }

  const repoInfo = getLocalRepositoryInfo(activeRepo, project)

  return (
    <div className="space-y-6">
      <div className="border border-gray-800 bg-black">
        <div className="border-b border-gray-800 p-4">
          <div className="flex items-center space-x-3">
            <img
              src={repoInfo.avatarUrl}
              alt={repoInfo.owner}
              className="w-6 h-6 rounded-sm"
            />
            <div>
              <h3 className="text-white font-mono text-sm">{repoInfo.name.toUpperCase()}</h3>
              <p className="text-gray-400 font-mono text-xs">
                {repoInfo.fullPath} • Reading from .git folder
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Branch & Status */}
          <div className="grid grid-cols-3 gap-6">
            <StatusCard
              label="CURRENT.BRANCH"
              value={activeRepo?.branch || activeRepo?.name || 'main'}
              subtext={activeRepo?.head?.substring(0, 8) || activeRepo?.commit?.sha?.substring(0, 8) || 'unknown'}
            />
            <StatusCard
              label="WORKING.DIRECTORY"
              value={activeRepo?.dirty ? 'DIRTY' : 'CLEAN'}
              subtext={activeRepo?.dirty ? 'Uncommitted changes' : 'No changes'}
            />
            <StatusCard
              label="SYNC.STATUS"
              value={`↑${activeRepo?.ahead || 0} ↓${activeRepo?.behind || 0}`}
              subtext="Ahead / Behind origin"
            />
          </div>

          <LocalBranchList activeRepo={activeRepo} />
          <RecentActivity commits={commits} />
        </div>
      </div>

      <BackendStatus dataSource={dataSource} />

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
        <TeamStatus localUsers={localUsers} />
      </div>
    </div>
  )
}
