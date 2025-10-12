import { LocalUserLocation } from '../types'
import { formatTimeAgo } from '../utils'

interface TeamStatusProps {
  localUsers: LocalUserLocation[]
}

export function TeamStatus({ localUsers }: TeamStatusProps) {
  return (
    <div className="border border-gray-800 bg-black">
      <div className="border-b border-gray-800 p-4 bg-gray-900">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-mono text-sm">TEAM.STATUS</h3>
          <div className="text-gray-400 font-mono text-xs">
            {localUsers.filter(u => u.status === 'online').length}/{localUsers.length} ONLINE
          </div>
        </div>
      </div>
      <div className="p-4 h-80 overflow-y-auto">
        <div className="font-mono text-xs space-y-3">
          {localUsers.map((userLoc, index) => (
            <div key={userLoc.userId} className="border-l-2 border-gray-700 pl-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 ${userLoc.status === 'online' ? 'bg-green-400' :
                    userLoc.status === 'away' ? 'bg-yellow-400' : 'bg-gray-600'
                    }`}></div>
                  <span className="text-white font-bold">{userLoc.userName.toUpperCase()}</span>
                </div>
                <span className="text-gray-400">{userLoc.status.toUpperCase()}</span>
              </div>

              <div className="text-gray-400 ml-4 space-y-1">
                <div>BRANCH: <span className="text-white">{userLoc.currentBranch}</span></div>
                <div>LAST: <span className="text-white">
                  {userLoc.lastActivity ? formatTimeAgo(userLoc.lastActivity).toUpperCase() : 'UNKNOWN'}
                </span></div>
                {userLoc.commitsToday && (
                  <div>TODAY: <span className="text-green-400">{userLoc.commitsToday} COMMITS</span></div>
                )}
              </div>

              <div className="mt-2 ml-4 text-gray-600 text-xs break-all">
                PATH: {userLoc.localPath}
              </div>

              {index < localUsers.length - 1 && (
                <div className="mt-2 text-gray-800">
                  ────────────────────────────────────
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
