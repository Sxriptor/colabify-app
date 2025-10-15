'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'

export function TestNotificationButton() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const createTestNotification = async () => {
    if (!user) return

    setLoading(true)
    setMessage('')

    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Create a realistic Git activity notification
      const gitActions = [
        { action: 'pushed', branch: 'main', commits: 3 },
        { action: 'merged', branch: 'feature/auth-system', commits: 5 },
        { action: 'committed', branch: 'develop', commits: 1 },
        { action: 'created branch', branch: 'hotfix/critical-bug', commits: 0 },
        { action: 'pushed', branch: 'feature/notifications', commits: 2 }
      ]
      
      const contributors = ['Sxriptor', 'DevMaster', 'CodeNinja', 'GitGuru']
      const repositories = ['electron-colabify', 'web-dashboard', 'api-server', 'mobile-app']
      
      const randomAction = gitActions[Math.floor(Math.random() * gitActions.length)]
      const randomContributor = contributors[Math.floor(Math.random() * contributors.length)]
      const randomRepo = repositories[Math.floor(Math.random() * repositories.length)]
      const commitHash = Math.random().toString(36).substring(2, 9)
      
      let title, message;
      
      if (randomAction.action === 'pushed') {
        title = `${randomContributor} pushed to ${randomAction.branch}`
        message = `${randomAction.commits} new commit${randomAction.commits > 1 ? 's' : ''} in ${randomRepo} • Latest: ${commitHash}`
      } else if (randomAction.action === 'merged') {
        title = `${randomContributor} merged ${randomAction.branch}`
        message = `${randomAction.commits} commits merged into main in ${randomRepo} • ${commitHash}`
      } else if (randomAction.action === 'committed') {
        title = `${randomContributor} committed to ${randomAction.branch}`
        message = `New commit in ${randomRepo} • ${commitHash}`
      } else if (randomAction.action === 'created branch') {
        title = `${randomContributor} created ${randomAction.branch}`
        message = `New branch in ${randomRepo} • Ready for development`
      }

      const { data, error } = await supabase.rpc('create_notification', {
        p_user_id: user.id,
        p_title: title,
        p_message: message,
        p_type: 'info',
        p_data: {
          contributor: randomContributor,
          action: randomAction.action,
          branch: randomAction.branch,
          repository: randomRepo,
          commitHash: commitHash,
          commitCount: randomAction.commits
        }
      })

      if (error) throw error

      setMessage('✅ Git activity notification sent! Check your system notifications, email, and inbox.')
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error creating test notification:', error)
      setMessage('❌ Failed to create test notification: ' + error.message)
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={createTestNotification}
        disabled={loading || !user}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Creating...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Simulate Git Activity
          </>
        )}
      </button>
      
      {message && (
        <p className={`text-sm ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}