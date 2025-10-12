'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { RepoVisualizationModal } from '../projects/RepoVisualizationModal'

export function FloatingActionMenu() {
  const { signOut, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showRepoVisualization, setShowRepoVisualization] = useState(false)
  const [currentProject, setCurrentProject] = useState<any>(null)
  const [unreadInboxCount, setUnreadInboxCount] = useState(0)

  // Check if we're on a project page and fetch project data
  useEffect(() => {
    const projectMatch = pathname?.match(/^\/projects\/([^\/]+)/)
    if (projectMatch) {
      const projectId = projectMatch[1]
      fetchProjectData(projectId)
    } else {
      setCurrentProject(null)
    }
  }, [pathname])

  // Fetch unread inbox count when user changes or when navigating to/from inbox
  useEffect(() => {
    if (user?.id) {
      fetchUnreadInboxCount()
    } else {
      setUnreadInboxCount(0)
    }
  }, [user?.id, pathname])

  const fetchProjectData = async (projectId: string) => {
    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
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
          )
        `)
        .eq('id', projectId)
        .single()

      if (error) throw error
      setCurrentProject(data)
    } catch (error) {
      console.error('Error fetching project data:', error)
      setCurrentProject(null)
    }
  }

  const fetchUnreadInboxCount = async () => {
    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Check for pending project invitations
      const { count: invitationCount, error: inviteError } = await supabase
        .from('project_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('email', user!.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())

      if (inviteError) {
        console.error('Error fetching pending invitations count:', inviteError)
      }

      // Get project IDs the user can access (owned + member of)
      const { data: userProjects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .or(`owner_id.eq.${user!.id},id.in.(${supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user!.id)
          .eq('status', 'active')
        })`)

      let notificationCount = 0
      if (!projectsError && userProjects && userProjects.length > 0) {
        const projectIds = userProjects.map(p => p.id)
        const { count, error: notifError } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .in('project_id', projectIds)

        if (notifError) {
          console.error('Error fetching notifications count:', notifError)
        } else {
          notificationCount = count || 0
        }
      }

      const totalUnread = (invitationCount || 0) + (notificationCount || 0)
      setUnreadInboxCount(totalUnread)
    } catch (error) {
      console.error('Error fetching unread inbox count:', error)
      setUnreadInboxCount(0)
    }
  }

  const handleSettingsClick = () => {
    // Check if we're currently in a project
    const projectMatch = pathname?.match(/^\/projects\/([^\/]+)/)
    if (projectMatch) {
      const projectId = projectMatch[1]
      router.push(`/settings?project=${projectId}`)
    } else {
      router.push('/settings')
    }
  }

  const handleInboxClick = () => {
    router.push('/inbox')
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-gray-800 rounded-lg shadow-lg p-2 flex flex-col gap-1">
          {/* Repository Visualization Button - Only show on project pages with repositories */}
          {currentProject && currentProject.repositories?.length > 0 && (
            <button
              onClick={() => setShowRepoVisualization(true)}
              className="text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 rounded p-3 relative"
              title="Repository Visualization"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {/* Small indicator dot */}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
            </button>
          )}

          {/* Inbox Button */}
          <button
            onClick={handleInboxClick}
            className="text-white hover:bg-gray-700 transition-colors duration-200 rounded p-3 relative"
            title="Inbox"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m16 0l-2-2m2 2l-2 2M4 13l2-2m-2 2l2 2" />
            </svg>
            {/* Dark blue indicator dot for unread items */}
            {unreadInboxCount > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-800 rounded-full border-2 border-gray-800"></div>
            )}
          </button>

        {/* Settings Button */}
        <button
          onClick={handleSettingsClick}
          className="text-white hover:bg-gray-700 transition-colors duration-200 rounded p-3"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Sign Out Button */}
        <button
          onClick={signOut}
          className="text-white hover:bg-gray-700 transition-colors duration-200 rounded p-3"
          title="Sign Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>

    {/* Repository Visualization Modal */}
    {currentProject && (
      <RepoVisualizationModal
        isOpen={showRepoVisualization}
        onClose={() => setShowRepoVisualization(false)}
        project={currentProject}
      />
    )}
  </>
  )
}