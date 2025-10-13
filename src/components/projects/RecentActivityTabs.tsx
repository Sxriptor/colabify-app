'use client'

import { useState } from 'react'
import { LiveActivityPanel } from './LiveActivityPanel'
import { LocalChangesPanel } from './LocalChangesPanel'
import { useGitMonitoring } from '@/hooks/useGitMonitoring'
import { useAuth } from '@/lib/auth/context'

interface RecentActivityTabsProps {
  project: any
}

type ActivityTab = 'user' | 'local' | 'remote'

export function RecentActivityTabs({ project }: RecentActivityTabsProps) {
  const [activeTab, setActiveTab] = useState<ActivityTab>('user')
  const { user } = useAuth()
  const { status, isElectron } = useGitMonitoring()
  
  // Check if project is being watched (from database or Electron backend)
  const isWatchingInDatabase = project?.watches?.some((watch: any) => watch.user_id === user?.id) || false
  const isWatchingInBackend = isElectron ? status.watchedProjects.includes(project.id) : false
  const isWatching = isWatchingInDatabase || isWatchingInBackend

  const tabs = [
    { id: 'user', label: 'User Activity', icon: '👥' },
    { id: 'local', label: 'Local Changes', icon: '💻' },
    { id: 'remote', label: 'Remote Updates', icon: '🌐' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'user':
        return (
          <LiveActivityPanel
            project={project}
          />
        )
      
      case 'local':
        return (
          <LocalChangesPanel
            project={project}
          />
        )
      
      case 'remote':
        return (
          <div className="p-6">
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Remote Repository Updates</h3>
              <p className="text-sm text-gray-500 mb-4">
                Monitor GitHub activity, pull requests, and remote branch changes
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
                <h4 className="font-medium text-gray-900 mb-2">Coming Soon:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• GitHub webhook events</li>
                  <li>• Pull request activity</li>
                  <li>• Remote branch updates</li>
                  <li>• Issue and discussion activity</li>
                </ul>
              </div>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Tab Header */}
      <div className="border-b border-gray-200">
        <div className="px-6 py-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActivityTab)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'border-gray-800 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'user' && isWatching && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {renderTabContent()}
      </div>
    </div>
  )
}