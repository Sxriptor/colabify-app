'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'

interface ProjectSettingsProps {
  projectId: string
}

interface Project {
  id: string
  name: string
  description: string | null
  visibility: 'public' | 'private'
  owner_id: string
  created_at: string
  updated_at: string
}

export function ProjectSettings({ projectId }: ProjectSettingsProps) {
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'private' as 'public' | 'private'
  })

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) throw error

      setProject(data)
      setFormData({
        name: data.name || '',
        description: data.description || '',
        visibility: data.visibility || 'private'
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data, error } = await supabase
        .from('projects')
        .update({
          name: formData.name,
          description: formData.description || null,
          visibility: formData.visibility,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .select()
        .single()

      if (error) throw error

      setProject(data)
      setSuccessMessage('Project settings updated successfully!')

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const isOwner = project?.owner_id === user?.id

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Project not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Project Settings</h2>
        <p className="text-gray-600">Manage settings for "{project.name}"</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <div className="text-sm text-green-800">{successMessage}</div>
        </div>
      )}

      {!isOwner && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <div className="text-sm text-yellow-800">
            You can view project settings but only the project owner can make changes.
          </div>
        </div>
      )}

      {/* Project Information */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Project Information</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                type="text"
                id="project-name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={!isOwner}
                placeholder="Enter project name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="project-description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                disabled={!isOwner}
                placeholder="Enter project description (optional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label htmlFor="project-visibility" className="block text-sm font-medium text-gray-700 mb-2">
                Visibility
              </label>
              <select
                id="project-visibility"
                name="visibility"
                value={formData.visibility}
                onChange={handleInputChange}
                disabled={!isOwner}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.visibility === 'private' 
                  ? 'Only invited members can access this project'
                  : 'Anyone can view this project'
                }
              </p>
            </div>
          </div>

          {isOwner && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Project Information Display */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Project Details</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Project ID:</span>
              <span className="ml-2 text-gray-600 font-mono">{project.id}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <span className="ml-2 text-gray-600">{new Date(project.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Updated:</span>
              <span className="ml-2 text-gray-600">{new Date(project.updated_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Your Role:</span>
              <span className="ml-2 text-gray-600">{isOwner ? 'Owner' : 'Member'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}