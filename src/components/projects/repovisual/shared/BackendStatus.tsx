import { DataSource } from '../types'

interface BackendStatusProps {
  dataSource: DataSource
}

export function BackendStatus({ dataSource }: BackendStatusProps) {
  return (
    <div className="border border-gray-800 bg-black mb-6">
      <div className="border-b border-gray-800 p-4">
        <h3 className="text-white font-mono text-sm">BACKEND.CONNECTION.STATUS</h3>
      </div>
      <div className="p-4 font-mono text-xs">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-gray-400 mb-1">DATA.SOURCE</div>
            <div className={`font-bold ${dataSource === 'backend' ? 'text-green-400' :
              dataSource === 'github' ? 'text-blue-400' : 'text-yellow-400'
              }`}>
              {dataSource === 'backend' ? 'GIT.MONITORING.BACKEND' :
                dataSource === 'github' ? 'GITHUB.API' : 'MOCK.DATA.FALLBACK'}
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">CONNECTION.STATUS</div>
            <div className={`font-bold ${dataSource === 'backend' ? 'text-green-400' : 'text-yellow-400'
              }`}>
              {dataSource === 'backend' ? 'CONNECTED' : 'FALLBACK.MODE'}
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">LAST.UPDATE</div>
            <div className="text-white font-bold">
              {new Date().toLocaleTimeString().toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
