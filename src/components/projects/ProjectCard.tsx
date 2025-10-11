'use client'

import Link from 'next/link'
import { Project, ProjectMember, Repository } from '@/types/database'

interface ProjectWithDetails extends Project {
  owner: {
    id: string
    name: string
    email: string
    avatar_url?: string
  }
  members: (ProjectMember & {
    user?: {
      id: string
      name: string
      email: string
      avatar_url?: string
    }
  })[]
  repositories: Repository[]
  watches?: {
    id: string
    user_id: string
  }[]
}

interface ProjectCardProps {
  project: ProjectWithDetails
  currentUserId: string
  onWatchToggle?: (projectId: string, isWatching: boolean) => void
}

export function ProjectCard({ project, currentUserId, onWatchToggle }: ProjectCardProps) {
  const isOwner = project.owner_id === currentUserId
  const memberCount = project.members?.filter(m => m.status === 'active').length || 0
  const repoCount = project.repositories?.length || 0
  const isWatching = project.watches?.some(watch => watch.user_id === currentUserId) || false

  // Handle cases where owner data might not be available due to RLS
  const ownerName = project.owner?.name || project.owner?.email || 'Unknown'
  const ownerInitial = ownerName.charAt(0).toUpperCase()
  const ownerAvatarUrl = project.owner?.avatar_url

  const handleWatchClick = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent navigation to project detail
    e.stopPropagation()
    if (onWatchToggle) {
      onWatchToggle(project.id, isWatching)
    }
  }

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {project.name}
              </h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.visibility === 'public'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
                }`}>
                {project.visibility}
              </span>
            </div>

            {project.description && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {project.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>{repoCount} repositor{repoCount !== 1 ? 'ies' : 'y'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            {isOwner && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                Owner
              </span>
            )}

            <div className="flex items-center">
              {ownerAvatarUrl ? (
                <img
                  src={ownerAvatarUrl}
                  alt={ownerName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-700">
                    {ownerInitial}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Created {new Date(project.created_at).toLocaleDateString()}
            </div>
            
            {onWatchToggle && (
              <button
                onClick={handleWatchClick}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  isWatching
                    ? 'bg-gray-800 text-white hover:bg-gray-900'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={isWatching ? 'Stop watching this project' : 'Watch this project for notifications'}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isWatching ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                  {!isWatching && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
                {isWatching ? 'Watching' : 'Watch'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}