import { createClient } from '@/lib/supabase/server'
import { handlePendingInvitation } from '@/lib/invitations'
import type { User } from '@supabase/supabase-js'

export interface CreateUserData {
  id: string
  email: string
  name?: string | null
  github_id?: number | null
  github_username?: string | null
  avatar_url?: string | null
  notification_preference?: 'instant' | 'digest'
}

/**
 * Create a user record in our custom users table
 */
export async function createUserRecord(userData: CreateUserData) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      github_id: userData.github_id,
      github_username: userData.github_username,
      avatar_url: userData.avatar_url,
      notification_preference: userData.notification_preference || 'instant'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating user record:', error)
    throw error
  }

  // Handle any pending invitations for this email
  try {
    const invitationResult = await handlePendingInvitation(userData.email, userData.id)
    if (invitationResult.success && invitationResult.projectsAdded > 0) {
      console.log(`Added user to ${invitationResult.projectsAdded} projects from pending invitations`)
    }
  } catch (error) {
    console.error('Error handling pending invitations:', error)
    // Don't fail user creation if invitation handling fails
  }

  return data
}

/**
 * Get or create a user record from Supabase auth user
 */
export async function getOrCreateUser(authUser: User) {
  console.log('getOrCreateUser called for:', authUser.email)
  console.log('Auth user metadata:', authUser.user_metadata)
  
  const supabase = await createClient()
  
  // First, try to get existing user
  const { data: existingUser, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (selectError && selectError.code !== 'PGRST116') {
    console.error('Error checking for existing user:', selectError)
  }

  if (existingUser) {
    console.log('Found existing user:', existingUser.email)
    return existingUser
  }

  console.log('User not found, creating new user record...')

  // If user doesn't exist, create them
  const userData: CreateUserData = {
    id: authUser.id,
    email: authUser.email!,
    name: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
    github_id: authUser.user_metadata?.provider_id ? parseInt(authUser.user_metadata.provider_id) : null,
    github_username: authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username,
    avatar_url: authUser.user_metadata?.avatar_url,
    notification_preference: 'instant'
  }

  console.log('User data to create:', userData)

  return await createUserRecord(userData)
}

/**
 * Ensure current user exists in our users table
 */
export async function ensureUserExists() {
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  if (!authUser) {
    throw new Error('No authenticated user found')
  }

  return await getOrCreateUser(authUser)
}