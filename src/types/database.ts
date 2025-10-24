// Database type definitions for Colabify

export interface User {
  id: string
  email: string
  name?: string
  github_id?: number
  github_username?: string
  avatar_url?: string
  notification_preference: 'instant' | 'digest'
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description?: string
  visibility: 'public' | 'private'
  owner_id: string
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id?: string
  invited_email?: string
  role: 'owner' | 'member'
  status: 'pending' | 'active' | 'declined'
  invited_at: string
  joined_at?: string
}

export interface Repository {
  id: string
  project_id: string
  github_id: number
  name: string
  full_name: string
  url: string
  webhook_id?: number
  webhook_secret?: string
  connected_at: string
}

export interface Notification {
  id: string
  project_id: string
  repository_id: string
  event_type: string
  triggered_by: string
  payload: Record<string, any>
  message: string
  created_at: string
}

export interface EmailDelivery {
  id: string
  user_id: string
  notification_id?: string
  email_type: 'instant' | 'digest' | 'invitation'
  recipient_email: string
  subject: string
  sent_at: string
  delivery_status: 'sent' | 'delivered' | 'bounced' | 'failed'
}

// Joined types for common queries
export interface ProjectWithOwner extends Project {
  owner: User
}

export interface ProjectWithMembers extends Project {
  members: (ProjectMember & { user?: User })[]
}

export interface ProjectWithRepositories extends Project {
  repositories: Repository[]
}

export interface NotificationWithRepository extends Notification {
  repository: Repository
}

export interface NotificationWithProject extends Notification {
  project: Project
  repository: Repository
}