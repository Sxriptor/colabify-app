import { GitHubCommit } from '../types'
import { formatTimeAgo } from '../utils'

interface RecentActivityProps {
  commits: GitHubCommit[]
}

export function RecentActivity({ commits }: RecentActivityProps) {
  return (
    <div className="border border-gray-800">
      <div className="border-b border-gray-800 p-3">
        <h4 className="text-white font-mono text-xs">RECENT.ACTIVITY</h4>
      </div>
      <div className="p-4 space-y-3">
        {commits.slice(0, 4).map((commit, index) => (
          <div key={index} className="flex items-start space-x-3 py-2 border-b border-gray-900 last:border-b-0">
            <div className="w-2 h-2 bg-white mt-2"></div>
            <div className="flex-1">
              <div className="text-white font-mono text-sm">{commit.commit.message}</div>
              <div className="text-gray-400 font-mono text-xs mt-1">
                {commit.commit.author.name} • {formatTimeAgo(commit.commit.author.date)}
              </div>
            </div>
            <div className="text-gray-500 font-mono text-xs">
              {commit.sha.substring(0, 8)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
