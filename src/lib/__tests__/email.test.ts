import { describe, it, expect } from 'vitest'
import { generateInvitationEmailTemplate, generateNotificationEmailTemplate } from '../email'

describe('Email Templates', () => {
  describe('generateInvitationEmailTemplate', () => {
    it('should generate invitation email template with all data', () => {
      const data = {
        recipientEmail: 'test@example.com',
        recipientName: 'John Doe',
        projectName: 'Test Project',
        inviterName: 'Jane Smith',
        inviteUrl: 'https://example.com/invite/123'
      }

      const template = generateInvitationEmailTemplate(data)

      expect(template.subject).toBe('You\'ve been invited to join Test Project on Colabify')
      expect(template.htmlContent).toContain('Hi John Doe,')
      expect(template.htmlContent).toContain('Jane Smith')
      expect(template.htmlContent).toContain('Test Project')
      expect(template.htmlContent).toContain('https://example.com/invite/123')
      expect(template.textContent).toContain('Hi John Doe,')
      expect(template.textContent).toContain('Jane Smith')
      expect(template.textContent).toContain('Test Project')
    })

    it('should generate invitation email template without recipient name', () => {
      const data = {
        recipientEmail: 'test@example.com',
        projectName: 'Test Project',
        inviterName: 'Jane Smith',
        inviteUrl: 'https://example.com/invite/123'
      }

      const template = generateInvitationEmailTemplate(data)

      expect(template.htmlContent).toContain('Hi,')
      expect(template.textContent).toContain('Hi,')
      expect(template.htmlContent).not.toContain('Hi undefined,')
    })
  })

  describe('generateNotificationEmailTemplate', () => {
    it('should generate instant notification email template', () => {
      const data = {
        recipientEmail: 'test@example.com',
        recipientName: 'John Doe',
        projectName: 'Test Project',
        notifications: [
          {
            message: 'Cole pushed 3 commits to feature/overlay-fix',
            repository: 'test-repo',
            timestamp: '2024-01-01T12:00:00Z',
            eventType: 'push'
          }
        ],
        isDigest: false
      }

      const template = generateNotificationEmailTemplate(data)

      expect(template.subject).toBe('New activity in Test Project')
      expect(template.htmlContent).toContain('New activity in Test Project')
      expect(template.htmlContent).toContain('Cole pushed 3 commits to feature/overlay-fix')
      expect(template.htmlContent).toContain('test-repo')
      expect(template.textContent).toContain('There\'s been new activity in the Test Project project')
    })

    it('should generate digest notification email template', () => {
      const data = {
        recipientEmail: 'test@example.com',
        projectName: 'Test Project',
        notifications: [
          {
            message: 'Cole pushed 3 commits to feature/overlay-fix',
            repository: 'test-repo',
            timestamp: '2024-01-01T12:00:00Z',
            eventType: 'push'
          },
          {
            message: 'Alice opened pull request #42',
            repository: 'test-repo',
            timestamp: '2024-01-01T14:00:00Z',
            eventType: 'pull_request'
          }
        ],
        isDigest: true
      }

      const template = generateNotificationEmailTemplate(data)

      expect(template.subject).toBe('Daily digest for Test Project - 2 updates')
      expect(template.htmlContent).toContain('Daily digest for Test Project')
      expect(template.htmlContent).toContain('Cole pushed 3 commits')
      expect(template.htmlContent).toContain('Alice opened pull request')
      expect(template.textContent).toContain('Here\'s your daily summary of activity in the Test Project project')
    })

    it('should handle empty notifications array', () => {
      const data = {
        recipientEmail: 'test@example.com',
        projectName: 'Test Project',
        notifications: [],
        isDigest: true
      }

      const template = generateNotificationEmailTemplate(data)

      expect(template.subject).toBe('Daily digest for Test Project - 0 updates')
      expect(template.htmlContent).toContain('Daily digest for Test Project')
    })
  })
})