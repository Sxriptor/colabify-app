'use client'

import { useAuth } from '@/lib/auth/context'
import { useState, useEffect } from 'react'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { CreateProjectForm } from '@/components/projects/CreateProjectForm'

export function DashboardContent() {
  const { user, customUser, signOut } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      // Import dynamically to avoid SSR issues
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:users!projects_owner_id_fkey(id, name, email, avatar_url),
          repositories(id, name, full_name, url),
          members:project_members(
            id,
            role,
            status,
            user:users(id, name, email, avatar_url)
          ),
          watches:project_watches!project_watches_project_id_fkey(
            id,
            user_id
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleProjectCreated = (project: any) => {
    setProjects(prev => [project, ...prev])
    setShowCreateForm(false)
  }

  const handleWatchToggle = async (projectId: string, isWatching: boolean) => {
    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      if (isWatching) {
        // Remove watch
        const { error } = await supabase
          .from('project_watches')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', user?.id)

        if (error) throw error
      } else {
        // Add watch
        const { error } = await supabase
          .from('project_watches')
          .insert({
            project_id: projectId,
            user_id: user?.id
          })

        if (error) throw error
      }

      // Update local state
      setProjects(prev => prev.map(project => {
        if (project.id === projectId) {
          const currentUserId = user?.id
          if (isWatching) {
            // Remove the watch
            return {
              ...project,
              watches: project.watches?.filter((watch: any) => watch.user_id !== currentUserId) || []
            }
          } else {
            // Add the watch
            return {
              ...project,
              watches: [...(project.watches || []), { id: 'temp', user_id: currentUserId }]
            }
          }
        }
        return project
      }))
    } catch (err) {
      console.error('Error toggling watch:', err)
      // You might want to show a toast notification here
    }
  }



  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">COLABIFY</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {customUser?.name || customUser?.email || user?.email}
              </span>
              <button
                onClick={signOut}
                className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {showCreateForm ? (
            <div className="mb-8">
              <CreateProjectForm
                onSuccess={handleProjectCreated}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          ) : (
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Your Projects</h2>
                <p className="text-gray-600">Manage your GitHub repository notifications</p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
            </div>
          ) : error ? (
            <div className="rounded-md bg-gray-50 border border-gray-200 p-4">
              <div className="text-sm text-gray-800">{error}</div>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first project.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  Create Project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project: any) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  currentUserId={customUser?.id || user?.id || ''}
                  onWatchToggle={handleWatchToggle}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}