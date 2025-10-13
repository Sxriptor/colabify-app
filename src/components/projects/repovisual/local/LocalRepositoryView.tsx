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
  const isPlaceholder = activeRepo.isPlaceholder || false
  const notFoundOnPC = activeRepo.notFoundOnPC || false
  const hasError = activeRepo.hasError || false
  const usingCachedData = activeRepo.usingCachedData || false
  const noCachedData = activeRepo.noCachedData || false

  // Show placeholder UI for repositories not available on this PC
  if (isPlaceholder) {
    return (
      <div className="space-y-6">
        <div className="border border-yellow-800/50 bg-gradient-to-br from-yellow-900/20 to-orange-900/20">
          <div className="border-b border-yellow-800/50 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 rounded-sm bg-yellow-600/30 flex items-center justify-center">
                <span className="text-yellow-400 text-xs">⚠</span>
              </div>
              <div>
                <h3 className="text-white font-mono text-sm">{repoInfo.name.toUpperCase()}</h3>
                <p className="text-yellow-400 font-mono text-xs">
                  {notFoundOnPC ? 'Repository not found on this PC' :
                    hasError ? `Error: ${activeRepo.errorMessage || 'Could not read Git data'}` :
                      'Repository not accessible'}
                </p>
                <p className="text-gray-500 font-mono text-xs mt-1">
                  Path: {repoInfo.fullPath}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="text-center py-8">
              <div className="text-yellow-400 text-4xl mb-4">📂</div>
              <div className="text-yellow-300 font-mono text-lg mb-2">
                {notFoundOnPC ? 'REPOSITORY.NOT.ON.THIS.PC' : 'REPOSITORY.NOT.ACCESSIBLE'}
              </div>
              <div className="text-gray-400 font-mono text-sm max-w-md mx-auto">
                {notFoundOnPC
                  ? 'This repository is configured in your project but the local path was not found on this computer. It may be on a different machine or the path may have changed.'
                  : hasError
                    ? 'There was an error reading Git data from this repository. The path exists but Git operations failed.'
                    : 'This repository could not be accessed for visualization.'
                }
              </div>
              {notFoundOnPC && (
                <div className="mt-4 text-xs text-gray-500 font-mono">
                  Expected path: {repoInfo.fullPath}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

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
