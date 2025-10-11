'use client'

import { useState, useEffect } from 'react'

interface Member {
  id: string
  role: 'owner' | 'member'
  status: 'active' | 'pending'
  joined_at?: string
  invited_at?: string
  user?: {
    id: string
    name?: string
    email: string
    avatar_url?: string
  }
}

interface Invitation {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  expires_at: string
  created_at: string
  inviter?: {
    name?: string
    email: string
  }
}

interface MemberManagementProps {
  projectId: string
  canManage: boolean
  refreshTrigger?: number
}

export function MemberManagement({ projectId, canManage, refreshTrigger }: MemberManagementProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMembersAndInvitations()
  }, [projectId, refreshTrigger])

  const fetchMembersAndInvitations = async () => {
    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select(`
          id,
          role,
          status,
          joined_at,
          invited_at,
          user:users(id, name, email, avatar_url)
        `)
        .eq('project_id', projectId)

      if (membersError) throw membersError

      // Fetch invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('project_invitations')
        .select(`
          id,
          email,
          status,
          expires_at,
          created_at,
          inviter:users!project_invitations_invited_by_fkey(name, email)
        `)
        .eq('project_id', projectId)
        .eq('status', 'pending')

      if (invitationsError) throw invitationsError

      setMembers(membersData || [])
      setInvitations(invitationsData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return
    }

    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      // Refresh the list
      fetchMembersAndInvitations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return
    }

    try {
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      const { error } = await supabase
        .from('project_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId)

      if (error) throw error

      // Refresh the list
      fetchMembersAndInvitations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation')
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={fetchMembersAndInvitations}
          className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
        >
          Try again
        </button>
      </div>
    )
  }

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingMembers = members.filter(m => m.status === 'pending')

  return (
    <div className="space-y-6">
      {/* Active Members */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Active Members ({activeMembers.length})
        </h3>
        <div className="space-y-3">
          {activeMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {member.user?.avatar_url ? (
                  <img
                    src={member.user.avatar_url}
                    alt={member.user.name || member.user.email}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-700">
                      {member.user?.name?.charAt(0) || member.user?.email?.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.user?.name || member.user?.email}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="capitalize">{member.role}</span>
                    {member.joined_at && (
                      <>
                        <span>•</span>
                        <span>Joined {new Date(member.joined_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {canManage && member.role !== 'owner' && (
                <button
                  onClick={() => removeMember(member.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          
          {activeMembers.length === 0 && (
            <p className="text-sm text-gray-500">No active members</p>
          )}
        </div>
      </div>

      {/* Pending Members */}
      {pendingMembers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Pending Members ({pendingMembers.length})
          </h3>
          <div className="space-y-3">
            {pendingMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.user?.name || member.user?.email}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Pending acceptance</span>
                      {member.invited_at && (
                        <>
                          <span>•</span>
                          <span>Invited {new Date(member.invited_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {canManage && (
                  <button
                    onClick={() => removeMember(member.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {canManage && invitations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Pending Invitations ({invitations.length})
          </h3>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{invitation.email}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Invitation sent</span>
                      <span>•</span>
                      <span>Expires {new Date(invitation.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => cancelInvitation(invitation.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeMembers.length === 0 && pendingMembers.length === 0 && invitations.length === 0 && (
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No team members</h3>
          <p className="mt-1 text-sm text-gray-500">
            {canManage ? 'Start by inviting team members to your project.' : 'This project has no team members yet.'}
          </p>
        </div>
      )}
    </div>
  )
}