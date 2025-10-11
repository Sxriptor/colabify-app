'use client'

import { useState } from 'react'

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onInviteSuccess: () => void
}

export function InviteModal({ isOpen, onClose, projectId, onInviteSuccess }: InviteModalProps) {
  const [emails, setEmails] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const addEmailField = () => {
    setEmails([...emails, ''])
  }

  const removeEmailField = (index: number) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index))
    }
  }

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails]
    newEmails[index] = value
    setEmails(newEmails)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Filter out empty emails and validate
    const validEmails = emails.filter(email => email.trim() !== '')
    
    if (validEmails.length === 0) {
      setError('Please enter at least one email address')
      setLoading(false)
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = validEmails.filter(email => !emailRegex.test(email.trim()))
    
    if (invalidEmails.length > 0) {
      setError('Please enter valid email addresses')
      setLoading(false)
      return
    }

    try {
      // Use the website API to send invitations (which handles email sending)
      const electronAPI = (window as any).electronAPI
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://colabify.xyz'

      const token = await electronAPI.getToken()
      if (!token) throw new Error('Not authenticated')

      console.log('Sending invitation request to:', `${baseUrl}/api/projects/${projectId}/invite`)
      console.log('With emails:', validEmails)

      const response = await fetch(`${baseUrl}/api/projects/${projectId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          emails: validEmails.map(email => email.trim())
        }),
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)

      const data = await response.json()
      console.log('Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitations')
      }

      console.log('Invitation sent successfully!')
      onInviteSuccess()
      onClose()
      setEmails([''])
    } catch (err) {
      console.error('Invitation error:', err)
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'

      // Provide more helpful error message for CORS issues
      if (errorMessage.includes('Failed to fetch') || errorMessage === 'An error occurred') {
        setError('Unable to connect to server. The website middleware needs to be deployed to support Electron app. See DEPLOYMENT_INVITATION_SYSTEM.md')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Invite Team Members</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Addresses
              </label>
              <div className="space-y-2">
                {emails.map((email, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="Enter email address"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    />
                    {emails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailField(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <button
                type="button"
                onClick={addEmailField}
                className="mt-2 text-sm text-gray-800 hover:text-gray-900 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another email
              </button>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              Send Invitations
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}