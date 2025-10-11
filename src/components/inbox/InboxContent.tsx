'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'

interface Invitation {
  id: string
  project_id: string
  email: string
  invited_by: string
  status: string
  expires_at: string
  created_at: string
  project: {
    id: string
    name: string
    description: string
    visibility: string
  }
  inviter: {
    name: string
    email: string
  }
}

export function InboxContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingInvites, setProcessingInvites] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchInvitations()
  }, [])

  const fetchInvitations = async () => {
    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { data, error } = await supabase
        .from('project_invitations')
        .select(`
          id,
          project_id,
          email,
          invited_by,
          status,
          expires_at,
          created_at,
          project:projects(id, name, description, visibility),
          inviter:users!project_invitations_invited_by_fkey(name, email)
        `)
        .eq('email', user?.email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvitations(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleInvitationResponse = async (invitationId: string, action: 'accept' | 'decline') => {
    setProcessingInvites(prev => new Set(prev).add(invitationId))

    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const invitation = invitations.find(inv => inv.id === invitationId)
      if (!invitation) throw new Error('Invitation not found')

      if (action === 'accept') {
        // Get current user
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) throw new Error('Not authenticated')

        // Add user as project member
        const { error: memberError } = await supabase
          .from('project_members')
          .insert({
            project_id: invitation.project_id,
            user_id: authUser.id,
            role: 'member',
            status: 'active',
            joined_at: new Date().toISOString(),
          })

        if (memberError) throw memberError
      }

      // Update invitation status
      const { error: updateError } = await supabase
        .from('project_invitations')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', invitationId)

      if (updateError) throw updateError

      // Remove the invitation from the list
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))

      // If accepted, redirect to the project
      if (action === 'accept') {
        setTimeout(() => {
          router.push(`/projects/${invitation.project_id}`)
        }, 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessingInvites(prev => {
        const newSet = new Set(prev)
        newSet.delete(invitationId)
        return newSet
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffMs = expiry.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 0) return 'Expired'
    if (diffDays === 1) return '1 day left'
    return `${diffDays} days left`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
      </div>
    )
  }

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
              <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Project Invitations</h2>
            <p className="text-gray-600">Manage your pending project invitations</p>
          </div>

          {error && (
            <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {invitations.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m16 0l-2-2m2 2l-2 2M4 13l2-2m-2 2l2 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No pending invitations</h3>
              <p className="mt-1 text-sm text-gray-500">You don't have any pending project invitations at the moment.</p>
              <div className="mt-6">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="bg-white shadow rounded-lg border border-gray-200">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {invitation.project.name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            invitation.project.visibility === 'public' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {invitation.project.visibility}
                          </span>
                        </div>
                        
                        {invitation.project.description && (
                          <p className="text-gray-600 mb-3">{invitation.project.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                          <div>
                            Invited by <span className="font-medium">{invitation.inviter.name || invitation.inviter.email}</span>
                          </div>
                          <div>•</div>
                          <div>{formatDate(invitation.created_at)}</div>
                          <div>•</div>
                          <div className="text-orange-600 font-medium">
                            {getTimeUntilExpiry(invitation.expires_at)}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleInvitationResponse(invitation.id, 'accept')}
                            disabled={processingInvites.has(invitation.id)}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                          >
                            {processingInvites.has(invitation.id) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Accepting...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Accept
                              </>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleInvitationResponse(invitation.id, 'decline')}
                            disabled={processingInvites.has(invitation.id)}
                            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                          >
                            {processingInvites.has(invitation.id) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Declining...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Decline
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}