import { GitHubBranch } from '../types'
import { RemoteBranchVisualization } from './RemoteBranchVisualization'

interface RemoteRepositoryViewProps {
  branches: GitHubBranch[]
  project: any
}

export function RemoteRepositoryView({ branches, project }: RemoteRepositoryViewProps) {
  return (
    <div className="space-y-6">
      <div className="border border-gray-800 bg-black">
        <div className="border-b border-gray-800 p-4">
          <h3 className="text-white font-mono text-sm">REMOTE.REPOSITORY.DATA</h3>
          <p className="text-gray-400 font-mono text-xs mt-1">
            Data from GitHub API and remote Git information
          </p>
        </div>

        <div className="p-6 space-y-6">
          <RemoteBranchVisualization branches={branches} />
        </div>
      </div>

      <div className="border border-gray-800 bg-black p-4">
        <h4 className="text-white font-mono text-sm mb-3">LEGEND</h4>
        <div className="space-y-2 font-mono text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-white">*</span>
            <span className="text-gray-400">MAIN.BRANCH</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-white">+</span>
            <span className="text-gray-400">FEATURE.BRANCH</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-white">o</span>
            <span className="text-gray-400">RELEASE.BRANCH</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">│</span>
            <span className="text-gray-400">CONNECTION.LINE</span>
          </div>
        </div>
      </div>
    </div>
  )
}
