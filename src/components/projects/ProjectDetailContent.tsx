'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { InviteModal } from './InviteModal'
import { MemberManagement } from './MemberManagement'
import { ConnectRepositoryModal } from './ConnectRepositoryModal'
import { AddLocalFolderModal } from './AddLocalFolderModal'
import { RecentActivityTabs } from './RecentActivityTabs'

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
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null)

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
          ),
          watches:project_watches!project_watches_project_id_fkey(
            id,
            user_id
          )
        `)
        .eq('id', projectId)
        .single()

      if (error) throw error
      console.log('Project data loaded:', data)

      // Transform data to handle Supabase array responses for relations
      if (data) {
        const transformedData = {
          ...data,
          owner: Array.isArray(data.owner) ? data.owner[0] : data.owner,
          repositories: (data.repositories || []).map((repo: any) => ({
            ...repo,
            local_mappings: (repo.local_mappings || []).map((mapping: any) => ({
              ...mapping,
              user: Array.isArray(mapping.user) ? mapping.user[0] : mapping.user
            }))
          })),
          members: (data.members || []).map((member: any) => ({
            ...member,
            user: Array.isArray(member.user) ? member.user[0] : member.user
          }))
        }
        setProject(transformedData)
      } else {
        setProject(data)
      }
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

  const handleRemoveLocalMapping = async (mappingId: string, localPath: string) => {
    // Prevent multiple clicks
    if (deletingMappingId) {
      return
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to remove this local path mapping?\n\n` +
      `Path: ${localPath}\n\n` +
      `This will also clear any cached Git data for this repository.`
    )

    if (!confirmed) {
      return
    }

    setDeletingMappingId(mappingId)

    try {
      // Use the same client approach as fetchProject
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      
      let supabase
      try {
        supabase = await createElectronClient()
      } catch (clientError) {
        console.error('Failed to create Electron client:', clientError)
        alert('Authentication error. Please try refreshing the page.')
        return
      }

      // Direct deletion - let RLS policies handle security
      const { error } = await supabase
        .from('repository_local_mappings')
        .delete()
        .eq('id', mappingId)

      if (error) {
        console.error('Error removing local mapping:', error)
        
        // If JWT expired, suggest refresh
        if (error.message?.includes('JWT expired') || error.code === 'PGRST303') {
          alert('Your session has expired. Please refresh the page and try again.')
        } else {
          alert(`Failed to remove local path mapping: ${error.message}`)
        }
        return
      }

      // Refresh project data to reflect the removal
      await fetchProject()
      
    } catch (err) {
      console.error('Error removing local mapping:', err)
      
      // Check if it's an authentication error
      if (err instanceof Error && (err.message.includes('JWT') || err.message.includes('401'))) {
        alert('Your session has expired. Please refresh the page and try again.')
      } else {
        alert('Failed to remove local path mapping')
      }
    } finally {
      setDeletingMappingId(null)
    }
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
              <h1 className="text-xl font-semibold text-gray-900">Colabify</h1>
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.visibility === 'public'
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
                              {repo.local_mappings.map((mapping: any) => {
                                const user = Array.isArray(mapping.user) ? mapping.user[0] : mapping.user
                                return (
                                <div key={mapping.id} className="flex items-center justify-between text-sm group">
                                  <span className="text-gray-600 font-mono truncate flex-1" title={mapping.local_path}>
                                    {mapping.local_path}
                                  </span>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-gray-500">
                                      ({user.name || user.email})
                                    </span>
                                    <button
                                      onClick={() => handleRemoveLocalMapping(mapping.id, mapping.local_path)}
                                      disabled={deletingMappingId === mapping.id}
                                      className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded ${
                                        deletingMappingId === mapping.id 
                                          ? 'text-gray-300 cursor-not-allowed' 
                                          : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                                      }`}
                                      title={deletingMappingId === mapping.id ? "Removing..." : "Remove local path mapping and clear cached data"}
                                    >
                                      {deletingMappingId === mapping.id ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </div>
                                )
                              })}
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

            {/* Activity Feed with Tabs */}
            <RecentActivityTabs project={project} />
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

      {
        selectedRepository && (
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
        )
      }
    </div >
  )
}