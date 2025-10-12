import { GitHubBranch } from '../types'

interface RemoteBranchVisualizationProps {
  branches: GitHubBranch[]
}

export function RemoteBranchVisualization({ branches }: RemoteBranchVisualizationProps) {
  // ASCII-style branch visualization
  const renderBranchTree = () => {
    if (branches.length === 0) {
      return (
        <div className="text-center py-12 text-gray-600 font-mono">
          [ NO.REMOTE.BRANCHES.AVAILABLE ]
        </div>
      )
    }

    return (
      <div className="font-mono text-xs space-y-2">
        {branches.slice(0, 10).map((branch, index) => {
          const symbol = branch.isDefault ? '*' : branch.protected ? 'o' : '+'
          const color = branch.isDefault ? 'text-green-400' : branch.protected ? 'text-yellow-400' : 'text-blue-400'
          
          return (
            <div key={index} className="flex items-start space-x-3">
              <div className="text-gray-600">
                {index === 0 ? '┌─' : index === branches.length - 1 ? '└─' : '├─'}
              </div>
              <span className={`${color} font-bold`}>{symbol}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">{branch.name}</span>
                  <div className="flex items-center space-x-4 text-gray-400">
                    {branch.aheadBy !== undefined && branch.aheadBy > 0 && (
                      <span className="text-green-400">↑{branch.aheadBy}</span>
                    )}
                    {branch.behindBy !== undefined && branch.behindBy > 0 && (
                      <span className="text-red-400">↓{branch.behindBy}</span>
                    )}
                    {branch.protected && (
                      <span className="text-yellow-400 text-xs">PROTECTED</span>
                    )}
                  </div>
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {branch.commit.sha.substring(0, 8)} • {branch.commit.commit.message.substring(0, 50)}
                  {branch.commit.commit.message.length > 50 && '...'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="border border-gray-800 bg-black">
      <div className="border-b border-gray-800 p-4">
        <h4 className="text-white font-mono text-sm">BRANCH.TREE.VISUALIZATION</h4>
      </div>
      <div className="p-6">
        {renderBranchTree()}
      </div>
    </div>
  )
}
