import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  gt: vi.fn(() => mockSupabase),
  single: vi.fn(),
  order: vi.fn(() => mockSupabase),
}

// Mock the server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase))
}))

// Mock the email service
vi.mock('../email', () => ({
  sendInvitationEmail: vi.fn(() => Promise.resolve(true))
}))

// Import after mocking
const { createInvitation, handleExistingUserInvitation, handlePendingInvitation, sendInvitationEmails } = await import('../invitations')

describe('Invitation System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createInvitation', () => {
    it('should create a new invitation successfully', async () => {
      // Mock no existing invitation
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
      
      // Mock successful invitation creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'invitation-123', project_id: 'project-123', email: 'test@example.com' },
        error: null
      })

      const result = await createInvitation('project-123', 'test@example.com', 'user-123')

      expect(result.success).toBe(true)
      expect(result.invitationId).toBe('invitation-123')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        project_id: 'project-123',
        email: 'test@example.com',
        invited_by: 'user-123',
        status: 'pending',
        expires_at: expect.any(String),
      })
    })

    it('should return error if invitation already exists', async () => {
      // Mock existing pending invitation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'existing-123', status: 'pending' },
        error: null
      })

      const result = await createInvitation('project-123', 'test@example.com', 'user-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invitation already sent')
    })

    it('should update expired invitation', async () => {
      // Mock existing expired invitation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'expired-123', status: 'expired' },
        error: null
      })

      // Mock successful update
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'expired-123' },
        error: null
      })

      const result = await createInvitation('project-123', 'test@example.com', 'user-123')

      expect(result.success).toBe(true)
      expect(result.invitationId).toBe('expired-123')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'pending',
        expires_at: expect.any(String),
        created_at: expect.any(String),
        responded_at: null
      })
    })
  })

  describe('handleExistingUserInvitation', () => {
    it('should add existing user to project successfully', async () => {
      // Mock no existing membership
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
      
      // Mock successful member insertion
      mockSupabase.insert.mockResolvedValueOnce({ error: null })
      
      // Mock successful invitation update
      mockSupabase.update.mockResolvedValueOnce({ error: null })

      const result = await handleExistingUserInvitation('project-123', 'user-123', 'invitation-123')

      expect(result.success).toBe(true)
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        project_id: 'project-123',
        user_id: 'user-123',
        role: 'member',
        status: 'active',
        joined_at: expect.any(String),
      })
    })

    it('should return error if user is already a member', async () => {
      // Mock existing membership
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'member-123' },
        error: null
      })

      const result = await handleExistingUserInvitation('project-123', 'user-123', 'invitation-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('User is already a project member')
    })
  })

  describe('handlePendingInvitation', () => {
    it('should process multiple pending invitations', async () => {
      // Mock pending invitations
      mockSupabase.gt.mockReturnValueOnce(mockSupabase)
      mockSupabase.single.mockResolvedValueOnce({
        data: [
          { id: 'inv-1', project_id: 'project-1' },
          { id: 'inv-2', project_id: 'project-2' }
        ],
        error: null
      })

      // Mock no existing memberships
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })

      // Mock successful insertions
      mockSupabase.insert
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null })

      // Mock successful updates
      mockSupabase.update
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null })

      const result = await handlePendingInvitation('test@example.com', 'user-123')

      expect(result.success).toBe(true)
      expect(result.projectsAdded).toBe(2)
    })

    it('should return zero projects if no pending invitations', async () => {
      // Mock no pending invitations
      mockSupabase.gt.mockReturnValueOnce(mockSupabase)
      mockSupabase.single.mockResolvedValueOnce({
        data: [],
        error: null
      })

      const result = await handlePendingInvitation('test@example.com', 'user-123')

      expect(result.success).toBe(true)
      expect(result.projectsAdded).toBe(0)
    })
  })

  describe('sendInvitationEmails', () => {
    it('should process invitations for new users', async () => {
      // Mock project and inviter data
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { name: 'Test Project', description: 'Test Description' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { name: 'John Doe', email: 'john@example.com' },
          error: null
        })

      // Mock no existing user
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })

      // Mock successful invitation creation
      vi.mocked(createInvitation).mockResolvedValueOnce({
        success: true,
        invitationId: 'invitation-123'
      })

      const { sendInvitationEmail } = await import('../email')
      vi.mocked(sendInvitationEmail).mockResolvedValueOnce(true)

      const results = await sendInvitationEmails(['test@example.com'], 'project-123', 'user-123')

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('sent')
      expect(results[0].email).toBe('test@example.com')
    })

    it('should handle existing users automatically', async () => {
      // Mock project and inviter data
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { name: 'Test Project', description: 'Test Description' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { name: 'John Doe', email: 'john@example.com' },
          error: null
        })

      // Mock existing user
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'existing-user-123' },
        error: null
      })

      // Mock no existing membership
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })

      // Mock successful invitation creation and assignment
      vi.mocked(createInvitation).mockResolvedValueOnce({
        success: true,
        invitationId: 'invitation-123'
      })

      vi.mocked(handleExistingUserInvitation).mockResolvedValueOnce({
        success: true
      })

      const results = await sendInvitationEmails(['existing@example.com'], 'project-123', 'user-123')

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('sent')
      expect(results[0].message).toBe('User automatically added to project')
    })

    it('should handle already member case', async () => {
      // Mock project and inviter data
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { name: 'Test Project', description: 'Test Description' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { name: 'John Doe', email: 'john@example.com' },
          error: null
        })

      // Mock existing user
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'existing-user-123' },
        error: null
      })

      // Mock existing membership
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'member-123' },
        error: null
      })

      const results = await sendInvitationEmails(['member@example.com'], 'project-123', 'user-123')

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('already_member')
      expect(results[0].message).toBe('User is already a project member')
    })
  })
})

