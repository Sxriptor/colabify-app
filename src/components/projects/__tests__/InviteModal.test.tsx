import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InviteModal } from '../InviteModal'

// Mock fetch
global.fetch = vi.fn()

describe('InviteModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    projectId: 'test-project-123',
    onInviteSuccess: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render when open', () => {
    render(<InviteModal {...mockProps} />)
    
    expect(screen.getByText('Invite Team Members')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter email address')).toBeInTheDocument()
    expect(screen.getByText('Send Invitations')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<InviteModal {...mockProps} isOpen={false} />)
    
    expect(screen.queryByText('Invite Team Members')).not.toBeInTheDocument()
  })

  it('should allow adding multiple email fields', () => {
    render(<InviteModal {...mockProps} />)
    
    // Initially should have one email field
    expect(screen.getAllByPlaceholderText('Enter email address')).toHaveLength(1)
    
    // Click add another email
    fireEvent.click(screen.getByText('Add another email'))
    
    // Should now have two email fields
    expect(screen.getAllByPlaceholderText('Enter email address')).toHaveLength(2)
  })

  it('should allow removing email fields', () => {
    render(<InviteModal {...mockProps} />)
    
    // Add a second email field
    fireEvent.click(screen.getByText('Add another email'))
    expect(screen.getAllByPlaceholderText('Enter email address')).toHaveLength(2)
    
    // Remove one field
    const removeButtons = screen.getAllByRole('button')
    const removeButton = removeButtons.find(button => 
      button.querySelector('svg') && button !== screen.getByText('Send Invitations')
    )
    
    if (removeButton) {
      fireEvent.click(removeButton)
      expect(screen.getAllByPlaceholderText('Enter email address')).toHaveLength(1)
    }
  })

  it('should validate email addresses before submission', async () => {
    render(<InviteModal {...mockProps} />)
    
    const emailInput = screen.getByPlaceholderText('Enter email address')
    const submitButton = screen.getByText('Send Invitations')
    
    // Try to submit with invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Please enter valid email addresses')).toBeInTheDocument()
    })
    
    // Should not have called fetch
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should submit valid emails', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        message: 'Invitations processed',
        results: [{ email: 'test@example.com', status: 'sent', message: 'Invitation sent successfully' }]
      })
    }
    
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)
    
    render(<InviteModal {...mockProps} />)
    
    const emailInput = screen.getByPlaceholderText('Enter email address')
    const submitButton = screen.getByText('Send Invitations')
    
    // Enter valid email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/projects/test-project-123/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: ['test@example.com']
        }),
      })
    })
    
    await waitFor(() => {
      expect(mockProps.onInviteSuccess).toHaveBeenCalled()
      expect(mockProps.onClose).toHaveBeenCalled()
    })
  })

  it('should handle API errors', async () => {
    const mockResponse = {
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to send invitations' })
    }
    
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)
    
    render(<InviteModal {...mockProps} />)
    
    const emailInput = screen.getByPlaceholderText('Enter email address')
    const submitButton = screen.getByText('Send Invitations')
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to send invitations')).toBeInTheDocument()
    })
    
    // Should not have called success callbacks
    expect(mockProps.onInviteSuccess).not.toHaveBeenCalled()
    expect(mockProps.onClose).not.toHaveBeenCalled()
  })

  it('should show loading state during submission', async () => {
    // Mock a delayed response
    vi.mocked(fetch).mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'Success', results: [] })
      } as any), 100))
    )
    
    render(<InviteModal {...mockProps} />)
    
    const emailInput = screen.getByPlaceholderText('Enter email address')
    const submitButton = screen.getByText('Send Invitations')
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)
    
    // Should show loading state
    expect(submitButton).toBeDisabled()
    expect(screen.getByRole('button', { name: /send invitations/i })).toHaveClass('disabled:opacity-50')
    
    await waitFor(() => {
      expect(mockProps.onInviteSuccess).toHaveBeenCalled()
    })
  })
})