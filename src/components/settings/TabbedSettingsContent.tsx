'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { ProjectSettings } from './ProjectSettings'
import { AccountSettings } from './AccountSettings'

export function TabbedSettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  
  const projectId = searchParams.get('project')
  const [activeTab, setActiveTab] = useState<'project' | 'account'>('project')

  useEffect(() => {
    // If no project ID is provided, default to account settings
    if (!projectId) {
      setActiveTab('account')
    } else {
      setActiveTab('project')
    }
  }, [projectId])

  const handleTabChange = (tab: 'project' | 'account') => {
    setActiveTab(tab)
    
    // Update URL to reflect the current tab
    const newSearchParams = new URLSearchParams(searchParams.toString())
    if (tab === 'account' && projectId) {
      // Keep project ID in URL but show account tab
      // This allows switching back to project settings
    }
    
    // Don't need to update URL for tab changes, just local state
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(projectId ? `/projects/${projectId}` : '/dashboard')}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.user_metadata?.name || user?.email}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Tab Navigation */}
          {projectId && (
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => handleTabChange('project')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'project'
                        ? 'border-gray-800 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Project Settings
                  </button>
                  <button
                    onClick={() => handleTabChange('account')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'account'
                        ? 'border-gray-800 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Account Settings
                  </button>
                </nav>
              </div>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'project' && projectId ? (
            <ProjectSettings projectId={projectId} />
          ) : (
            <AccountSettings />
          )}
        </div>
      </main>
    </div>
  )
}