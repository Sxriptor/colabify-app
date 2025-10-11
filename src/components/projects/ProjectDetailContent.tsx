'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { InviteModal } from './InviteModal'
import { MemberManagement } from './MemberManagement'
import { ConnectRepositoryModal } from './ConnectRepositoryModal'
import { AddLocalFolderModal } from './AddLocalFolderModal'

interface ProjectDetailContentProps {
  projectId: string
}

export function ProjectDetailContent({ projectId }: ProjectDetailContentProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showConnectRepoModal, setShowConnectRepoModal] = useState(false)
  const [showAddFolderModal, setShowAddFolderModal] = useState(false)
  const [selectedRepository, setSelectedRepository] = useState<any>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      // Import dynamically to avoid SSR issues
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:users!projects_owner_id_fkey(id, name, email, avatar_url),
          repositories(
            id, 
            name, 
            full_name, 
            url,
            local_mappings:repository_local_mappings(
              id,
              local_path,
              user:users(id, name, email)
            )
          ),
          members:project_members(
            id,
            role,
            status,
            user:users(id, name, email, avatar_url)
          ),
          invitations:project_invitations!project_invitations_project_id_fkey(
            id,
            email,
            status,
            created_at,
            expires_at
          )
        `)
        .eq('id', projectId)
        .single()

      if (error) throw error
      setProject(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleInviteSuccess = async () => {
    // Trigger refresh in MemberManagement component
    // Add small delay to ensure database has committed the changes
    await new Promise(resolve => setTimeout(resolve, 500))
    setRefreshTrigger(prev => prev + 1)
  }

  const handleRepositoryConnected = async () => {
    // Refresh project data to show new repository
    await fetchProject()
  }

  const handleAddLocalFolder = (repository: any) => {
    setSelectedRepository(repository)
    setShowAddFolderModal(true)
  }

  const handleLocalFolderAdded = async () => {
    // Refresh project data to show new local mappings
    await fetchProject()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const isOwner = project?.owner_id === user?.id
  const activeMemberCount = project?.members?.filter((m: any) => m.status === 'active').length || 0

  // Debug logging
  console.log('Debug - Project owner_id:', project?.owner_id)
  console.log('Debug - User id:', user?.id)
  console.log('Debug - Is owner:', isOwner)
  console.log('Debug - Show invite modal state:', showInviteModal)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">DevPulse</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.user_metadata?.name || user?.email}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Project Header */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      project.visibility === 'public' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {project.visibility}
                    </span>
                    {isOwner && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Owner
                      </span>
                    )}
                  </div>
                  
                  {project.description && (
                    <p className="text-gray-600 mb-4">{project.description}</p>
                  )}

                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>{activeMemberCount} member{activeMemberCount !== 1 ? 's' : ''}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>{project.repositories?.length || 0} repositor{project.repositories?.length !== 1 ? 'ies' : 'y'}</span>
                    </div>

                    <div>
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>


              </div>
            </div>
          </div>

          {/* Project Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Repositories */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Repositories</h2>
                    {isOwner && (
                      <button 
                        onClick={() => setShowConnectRepoModal(true)}
                        className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium"
                      >
                        {project.repositories?.length > 0 ? 'Change Repository' : 'Connect Repository'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  {project.repositories?.length > 0 ? (
                    <div className="space-y-4">
                      {project.repositories.map((repo: any) => (
                        <div key={repo.id} className="border border-gray-200 rounded-md">
                          <div className="flex items-center justify-between p-3 border-b border-gray-100">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{repo.name}</h3>
                              <p className="text-sm text-gray-500">{repo.full_name}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleAddLocalFolder(repo)}
                                className="text-sm text-gray-800 hover:text-gray-900 font-medium"
                              >
                                Add Local Folder
                              </button>
                              <a
                                href={repo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-800 hover:text-gray-900 text-sm"
                              >
                                View on GitHub
                              </a>
                            </div>
                          </div>
                          
                          {/* Local folder mappings */}
                          {repo.local_mappings && repo.local_mappings.length > 0 && (
                            <div className="p-3 bg-gray-50">
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Local Folders:</h4>
                              <div className="space-y-1">
                                {repo.local_mappings.map((mapping: any) => (
                                  <div key={mapping.id} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 font-mono truncate flex-1" title={mapping.local_path}>
                                      {mapping.local_path}
                                    </span>
                                    <span className="text-gray-500 ml-2">
                                      ({mapping.user.name || mapping.user.email})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No repositories</h3>
                      <p className="mt-1 text-sm text-gray-500">Connect your first GitHub repository to start receiving notifications.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Feed */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
                </div>
                <div className="p-6">
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No activity yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Activity will appear here once you connect repositories.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Team Members */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Team Members</h2>
                    {isOwner && (
                      <button 
                        onClick={() => setShowInviteModal(true)}
                        className="text-gray-800 hover:text-gray-900 text-sm font-medium"
                      >
                        Invite
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  <MemberManagement projectId={projectId} canManage={isOwner} refreshTrigger={refreshTrigger} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        projectId={projectId}
        onInviteSuccess={handleInviteSuccess}
      />

      <ConnectRepositoryModal
        isOpen={showConnectRepoModal}
        onClose={() => setShowConnectRepoModal(false)}
        projectId={projectId}
        onSuccess={handleRepositoryConnected}
        hasExistingRepositories={project?.repositories?.length > 0}
      />

      {selectedRepository && (
        <AddLocalFolderModal
          isOpen={showAddFolderModal}
          onClose={() => {
            setShowAddFolderModal(false)
            setSelectedRepository(null)
          }}
          repositoryId={selectedRepository.id}
          projectId={projectId}
          repositoryName={selectedRepository.name}
          onSuccess={handleLocalFolderAdded}
        />
      )}
    </div>
  )
}