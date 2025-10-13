import { GitHubCommit } from '../types'
import { formatTimeAgo } from '../utils'

interface LocalActivityLogProps {
  commits: GitHubCommit[]
}

export function LocalActivityLog({ commits }: LocalActivityLogProps) {
  return (
    <div className="border border-gray-800 bg-black">
      <div className="border-b border-gray-800 p-4 bg-gray-900">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-mono text-sm">ACTIVITY.LOG</h3>
        </div>
      </div>
      <div className="p-4 h-80 overflow-y-auto">
        <div className="font-mono text-xs space-y-2">
          {commits.slice(0, 8).map((commit, index) => (
            <div key={commit.sha} className="text-gray-300">
              <div className="flex items-start space-x-2">
                <span className="text-gray-600">[{formatTimeAgo(commit.commit.author.date).replace(' ago', '').toUpperCase()}]</span>
                <span className="text-white">COMMIT</span>
                <span className="text-gray-400">{commit.sha.substring(0, 7)}</span>
              </div>
              <div className="ml-4 text-gray-400 mt-1">
                └─ {commit.commit.message.substring(0, 60)}
                {commit.commit.message.length > 60 && '...'}
              </div>
              <div className="ml-4 text-gray-600 text-xs">
                BY: {commit.commit.author.name.toUpperCase()}
                {commit.stats && (
                  <span className="ml-4">
                    +{commit.stats.additions} -{commit.stats.deletions}
                  </span>
                )}
              </div>
              {index < commits.length - 1 && <div className="text-gray-800 ml-2">│</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
