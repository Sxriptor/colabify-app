'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRepositoryData } from './repovisual/hooks/useRepositoryData'
import { LocalRepositoryView } from './repovisual/local/LocalRepositoryView'
import { RemoteRepositoryView } from './repovisual/remote/RemoteRepositoryView'
import { ActiveTab, DataSource } from './repovisual/types'

interface RepoVisualizationModalProps {
  isOpen: boolean
  onClose: () => void
  project: any
}

export function RepoVisualizationModal({ isOpen, onClose, project }: RepoVisualizationModalProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<ActiveTab>('local')
  const [activeLocalRepo, setActiveLocalRepo] = useState<string>('')

  const {
    loading,
    branches,
    commits,
    localUsers,
    error,
    dataSource,
    githubConnected,
    githubDataSource,
    fetchRepositoryData
  } = useRepositoryData(isOpen, project)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-gray-800 rounded-none shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-black border-b border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1 text-white font-mono">REPOSITORY.VISUALIZATION</h2>
              <p className="text-gray-400 flex items-center space-x-2 font-mono text-sm">
                <span className={`w-2 h-2 rounded-none ${dataSource === 'backend' ? 'bg-green-400' :
                  dataSource === 'github' ? 'bg-blue-400' : 'bg-yellow-400'
                  } ${dataSource === 'backend' ? 'animate-pulse' : ''}`}></span>
                <span>{project?.name?.toUpperCase()}</span>
                <span>/</span>
                <span>{project?.repositories?.[0]?.name?.toUpperCase()}</span>
                <span>•</span>
                <span className="text-xs">
                  {dataSource === 'backend' ? 'LIVE.DATA' :
                    dataSource === 'github' ? 'GITHUB.API' : 'MOCK.DATA'}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-none border border-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '20px 20px'
            }}></div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="bg-black border-b border-gray-800">
          <nav className="flex px-6">
            {[
              { id: 'local', label: 'LOCAL.REPOSITORIES' },
              { id: 'remote', label: 'REMOTE.DATA' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`relative py-4 px-8 font-mono text-xs font-medium transition-all duration-200 ${activeTab === tab.id
                  ? 'text-white bg-gray-900 border-l border-r border-gray-700'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                  }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-white"></div>
                )}
              </button>
            ))}
          </nav>

          {/* Local Repository Sub-tabs */}
          {activeTab === 'local' && project.repositories?.[0]?.local_mappings?.length > 0 && (
            <div className="bg-gray-950 border-b border-gray-800">
              <nav className="flex px-6 overflow-x-auto">
                {project.repositories[0].local_mappings.map((mapping: any, index: number) => {
                  const repoId = `repo-${index}`;
                  const folderName = mapping.local_path.split('/').pop() || mapping.local_path.split('\\').pop() || 'Unknown';
                  const projectRemoteUrl = project.repositories?.[0]?.url || '';
                  let ownerName = 'local';
                  if (projectRemoteUrl) {
                    try {
                      const urlParts = projectRemoteUrl.replace('https://github.com/', '').replace('.git', '').split('/');
                      if (urlParts.length >= 2) {
                        ownerName = urlParts[0];
                      }
                    } catch (error) {
                      console.warn('Failed to parse project remote URL:', projectRemoteUrl);
                    }
                  }
                  const isActive = activeLocalRepo === repoId || (activeLocalRepo === '' && index === 0);

                  return (
                    <button
                      key={repoId}
                      onClick={() => setActiveLocalRepo(repoId)}
                      className={`relative py-3 px-4 font-mono text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center space-x-2 ${isActive
                        ? 'text-white bg-black border-l border-r border-gray-700'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                        }`}
                    >
                      <img
                        src={`https://github.com/${ownerName}.png`}
                        alt={ownerName}
                        className="w-4 h-4 rounded-sm"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="truncate max-w-32">
                        {folderName.toUpperCase()}
                      </span>
                      <span className="text-gray-500 text-xs">
                        @{ownerName.toLowerCase()}
                      </span>
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-white"></div>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-black p-8 overflow-y-auto max-h-[calc(95vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="border border-gray-600 rounded-none p-4">
                <div className="text-white font-mono text-sm">LOADING.REPOSITORY.DATA...</div>
                <div className="mt-2 w-32 h-1 bg-gray-800">
                  <div className="h-full bg-white animate-pulse w-1/3"></div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12 border border-gray-800 bg-gray-900">
              <div className="text-red-400 mb-4 font-mono">ERROR: {error}</div>
              <button
                onClick={fetchRepositoryData}
                className="bg-white text-black px-6 py-2 font-mono text-sm hover:bg-gray-200 transition-colors"
              >
                RETRY.CONNECTION
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'local' && (
                <LocalRepositoryView
                  branches={branches}
                  commits={commits}
                  localUsers={localUsers}
                  activeLocalRepo={activeLocalRepo}
                  dataSource={dataSource}
                  project={project}
                />
              )}

              {activeTab === 'remote' && (
                <RemoteRepositoryView
                  branches={branches}
                  project={project}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
