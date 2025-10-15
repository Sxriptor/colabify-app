import { GitHubBranch } from '../types'

interface LocalBranchListProps {
  activeRepo: GitHubBranch
  branches?: GitHubBranch[]
}

export function LocalBranchList({ activeRepo, branches }: LocalBranchListProps) {
  const localBranches = branches?.map(b => b.name) || activeRepo?.localBranches || [activeRepo?.branch || 'main']

  return (
    <div className="border border-gray-800">
      <div className="border-b border-gray-800 p-3">
        <h4 className="text-white font-mono text-xs">LOCAL.BRANCHES</h4>
      </div>
      <div className="p-4 space-y-2">
        {localBranches.slice(0, 6).map((branchName: string, index: number) => (
          <div key={index} className="flex items-center justify-between py-2 border-b border-gray-900 last:border-b-0">
            <div className="flex items-center space-x-3">
              <div className={`w-2 h-2 ${branchName === activeRepo?.branch ? 'bg-green-400' : 'bg-gray-600'}`}></div>
              <span className="text-white font-mono text-sm">{branchName}</span>
              {branchName === activeRepo?.branch && (
                <span className="text-green-400 font-mono text-xs">CURRENT</span>
              )}
            </div>
            <div className="text-gray-400 font-mono text-xs">
              {activeRepo?.head?.substring(0, 8) || 'unknown'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
