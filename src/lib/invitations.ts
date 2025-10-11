import { createClient } from '@/lib/supabase/server'
import { sendInvitationEmail } from './email'

export interface InvitationResult {
  email: string
  status: 'sent' | 'already_member' | 'already_invited' | 'error'
  message: string
  invitationId?: string
}

export interface PendingInvitation {
  id: string
  project_id: string
  email: string
  invited_by: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  expires_at: string
  created_at: string
  project?: any
  inviter?: any
}

/**
 * Create member invitation database operations
 */
export async function createInvitation(
  projectId: string,
  email: string,
  invitedBy: string
): Promise<{ success: boolean; invitationId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    
    // Check if invitation already exists
    const { data: existingInvitation } = await supabase
      .from('project_invitations')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('email', email)
      .single()

    if (existingInvitation) {
      if (existingInvitation.status === 'pending') {
        return { success: false, error: 'Invitation already sent' }
      }
      
      // Update existing invitation if it was declined or expired
      const { data: updatedInvitation, error: updateError } = await supabase
        .from('project_invitations')
        .update({
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          responded_at: null
        })
        .eq('id', existingInvitation.id)
        .select()
        .single()

      if (updateError) {
        return { success: false, error: 'Failed to update invitation' }
      }

      return { success: true, invitationId: updatedInvitation.id }
    }

    // Create new invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('project_invitations')
      .insert({
        project_id: projectId,
        email: email,
        invited_by: invitedBy,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (inviteError) {
      return { success: false, error: 'Failed to create invitation' }
    }

    return { success: true, invitationId: invitation.id }
  } catch (error) {
    console.error('Error creating invitation:', error)
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Handle automatic project assignment for existing users
 */
export async function handleExistingUserInvitation(
  projectId: string,
  userId: string,
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()

    if (existingMember) {
      return { success: false, error: 'User is already a project member' }
    }

    // Create project membership
    const { error: memberError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      return { success: false, error: 'Failed to add user to project' }
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('project_invitations')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId)

    if (updateError) {
      console.error('Failed to update invitation status:', updateError)
      // Don't fail the operation if we can't update the invitation
    }

    // Create inbox item for the invited user
    const { data: projectData } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single()

    if (projectData) {
      const { error: inboxError } = await supabase
        .from('inbox_items')
        .insert({
          user_id: userId,
          type: 'invitation',
          title: `Added to ${projectData.name}`,
          message: `You've been added to the project "${projectData.name}"`,
          link: `/projects/${projectId}`,
          read: false
        })

      if (inboxError) {
        console.error('Failed to create inbox item:', inboxError)
        // Don't fail the operation if we can't create inbox item
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error handling existing user invitation:', error)
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Handle pending invitation for new users
 */
export async function handlePendingInvitation(
  email: string,
  userId: string
): Promise<{ success: boolean; projectsAdded: number; error?: string }> {
  try {
    const supabase = await createClient()

    // Find all pending invitations for this email
    const { data: invitations, error: invitationsError } = await supabase
      .from('project_invitations')
      .select('id, project_id')
      .eq('email', email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (invitationsError) {
      return { success: false, projectsAdded: 0, error: 'Failed to fetch invitations' }
    }

    if (!invitations || invitations.length === 0) {
      return { success: true, projectsAdded: 0 }
    }

    let projectsAdded = 0

    for (const invitation of invitations) {
      try {
        // Check if user is already a member (shouldn't happen, but safety check)
        const { data: existingMember } = await supabase
          .from('project_members')
          .select('id')
          .eq('project_id', invitation.project_id)
          .eq('user_id', userId)
          .single()

        if (existingMember) {
          continue
        }

        // Add user to project
        const { error: memberError } = await supabase
          .from('project_members')
          .insert({
            project_id: invitation.project_id,
            user_id: userId,
            role: 'member',
            status: 'active',
            joined_at: new Date().toISOString(),
          })

        if (memberError) {
          console.error('Failed to add user to project:', memberError)
          continue
        }

        // Update invitation status
        const { error: updateError } = await supabase
          .from('project_invitations')
          .update({
            status: 'accepted',
            responded_at: new Date().toISOString()
          })
          .eq('id', invitation.id)

        if (updateError) {
          console.error('Failed to update invitation status:', updateError)
        }

        projectsAdded++
      } catch (error) {
        console.error('Error processing invitation:', error)
        continue
      }
    }

    return { success: true, projectsAdded }
  } catch (error) {
    console.error('Error handling pending invitations:', error)
    return { success: false, projectsAdded: 0, error: 'Internal server error' }
  }
}

/**
 * Send invitation emails
 */
export async function sendInvitationEmails(
  emails: string[],
  projectId: string,
  inviterUserId: string
): Promise<InvitationResult[]> {
  try {
    const supabase = await createClient()

    // Get project and inviter information
    const { data: project } = await supabase
      .from('projects')
      .select('name, description')
      .eq('id', projectId)
      .single()

    const { data: inviter } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', inviterUserId)
      .single()

    if (!project || !inviter) {
      return emails.map(email => ({
        email,
        status: 'error',
        message: 'Failed to fetch project or inviter information'
      }))
    }

    const results: InvitationResult[] = []

    for (const email of emails) {
      try {
        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()

        if (existingUser) {
          // Check if already a member
          const { data: existingMember } = await supabase
            .from('project_members')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', existingUser.id)
            .single()

          if (existingMember) {
            results.push({
              email,
              status: 'already_member',
              message: 'User is already a project member'
            })
            continue
          }
        }

        // Create invitation
        const invitationResult = await createInvitation(projectId, email, inviterUserId)
        
        if (!invitationResult.success) {
          if (invitationResult.error === 'Invitation already sent') {
            results.push({
              email,
              status: 'already_invited',
              message: 'Invitation already sent'
            })
          } else {
            results.push({
              email,
              status: 'error',
              message: invitationResult.error || 'Failed to create invitation'
            })
          }
          continue
        }

        // If user exists, handle automatic assignment
        if (existingUser) {
          const assignmentResult = await handleExistingUserInvitation(
            projectId,
            existingUser.id,
            invitationResult.invitationId!
          )

          if (assignmentResult.success) {
            results.push({
              email,
              status: 'sent',
              message: 'User automatically added to project',
              invitationId: invitationResult.invitationId
            })
          } else {
            results.push({
              email,
              status: 'error',
              message: assignmentResult.error || 'Failed to add user to project'
            })
          }
          continue
        }

        // Send email invitation for new users
        const inviteUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/signup?invitation=${invitationResult.invitationId}`
        
        const emailSent = await sendInvitationEmail({
          recipientEmail: email,
          projectName: project.name,
          inviterName: inviter.name || inviter.email,
          inviteUrl
        })

        if (emailSent) {
          results.push({
            email,
            status: 'sent',
            message: 'Invitation sent successfully',
            invitationId: invitationResult.invitationId
          })
        } else {
          results.push({
            email,
            status: 'error',
            message: 'Failed to send invitation email'
          })
        }

      } catch (error) {
        console.error(`Error processing invitation for ${email}:`, error)
        results.push({
          email,
          status: 'error',
          message: 'Failed to process invitation'
        })
      }
    }

    return results
  } catch (error) {
    console.error('Error sending invitation emails:', error)
    return emails.map(email => ({
      email,
      status: 'error',
      message: 'Internal server error'
    }))
  }
}

/**
 * Get pending invitations for a project
 */
export async function getProjectInvitations(projectId: string): Promise<PendingInvitation[]> {
  try {
    const supabase = await createClient()

    const { data: invitations, error } = await supabase
      .from('project_invitations')
      .select(`
        id,
        project_id,
        email,
        invited_by,
        status,
        expires_at,
        created_at,
        project:projects(name, description),
        inviter:users!project_invitations_invited_by_fkey(name, email)
      `)
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching project invitations:', error)
      return []
    }

    return invitations || []
  } catch (error) {
    console.error('Error getting project invitations:', error)
    return []
  }
}

/**
 * Cancel/revoke an invitation
 */
export async function cancelInvitation(invitationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('project_invitations')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId)

    if (error) {
      return { success: false, error: 'Failed to cancel invitation' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error canceling invitation:', error)
    return { success: false, error: 'Internal server error' }
  }
}