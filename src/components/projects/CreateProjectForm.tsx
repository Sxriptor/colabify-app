'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CreateProjectFormProps {
  onSuccess?: (project: any) => void
  onCancel?: () => void
}

export function CreateProjectForm({ onSuccess, onCancel }: CreateProjectFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Import dynamically to avoid SSR issues
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Not authenticated')

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          visibility: visibility || 'private',
          owner_id: authUser.id,
        })
        .select(`
          *,
          owner:users!projects_owner_id_fkey(id, name, email, avatar_url)
        `)
        .single()

      if (projectError) throw projectError

      // Add owner as project member
      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: project.id,
          user_id: authUser.id,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        })

      if (memberError) {
        console.error('Failed to add owner to project_members:', memberError)
        // Don't fail project creation, but log the error
        // This is likely an RLS issue - see FIX_PROJECT_MEMBERS_ISSUE.md
      }

      if (onSuccess) {
        onSuccess(project)
      } else {
        router.push(`/projects/${project.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Project</h2>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Project Name *
          </label>
          <div className="mt-1">
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
              placeholder="Enter project name"
              maxLength={255}
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <div className="mt-1">
            <textarea
              id="description"
              name="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
              placeholder="Optional project description"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Visibility
          </label>
          <div className="mt-2 space-y-2">
            <div className="flex items-center">
              <input
                id="private"
                name="visibility"
                type="radio"
                value="private"
                checked={visibility === 'private'}
                onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}
                className="focus:ring-gray-500 h-4 w-4 text-gray-600 border-gray-300"
              />
              <label htmlFor="private" className="ml-3 block text-sm text-gray-700">
                <span className="font-medium">Private</span>
                <span className="text-gray-500 block">Only invited members can access this project</span>
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="public"
                name="visibility"
                type="radio"
                value="public"
                checked={visibility === 'public'}
                onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}
                className="focus:ring-gray-500 h-4 w-4 text-gray-600 border-gray-300"
              />
              <label htmlFor="public" className="ml-3 block text-sm text-gray-700">
                <span className="font-medium">Public</span>
                <span className="text-gray-500 block">Anyone can view this project's activity</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}