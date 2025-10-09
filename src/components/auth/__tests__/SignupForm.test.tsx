import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignupForm } from '../SignupForm'

// Mock the Supabase client
const mockSignInWithOAuth = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}))

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders GitHub signup button', () => {
    render(<SignupForm />)
    
    expect(screen.getByRole('button', { name: /sign up with github/i })).toBeInTheDocument()
    expect(screen.getByText(/create your devpulse account using github/i)).toBeInTheDocument()
  })

  it('handles GitHub OAuth signup successfully', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null })
    
    render(<SignupForm />)
    
    fireEvent.click(screen.getByRole('button', { name: /sign up with github/i }))
    
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      })
    })
  })

  it('displays error message on GitHub signup failure', async () => {
    const errorMessage = 'OAuth provider error'
    mockSignInWithOAuth.mockResolvedValue({ error: { message: errorMessage } })
    
    render(<SignupForm />)
    
    fireEvent.click(screen.getByRole('button', { name: /sign up with github/i }))
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('shows loading state during GitHub authentication', async () => {
    mockSignInWithOAuth.mockImplementation(() => new Promise(() => {})) // Never resolves
    
    render(<SignupForm />)
    
    fireEvent.click(screen.getByRole('button', { name: /sign up with github/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/connecting to github/i)).toBeInTheDocument()
    })
  })

  it('displays privacy information', () => {
    render(<SignupForm />)
    
    expect(screen.getByText(/by signing up, you agree to let devpulse access/i)).toBeInTheDocument()
    expect(screen.getByText(/we only read repository activity and never modify/i)).toBeInTheDocument()
  })

  it('has link to sign in page', () => {
    render(<SignupForm />)
    
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })
})