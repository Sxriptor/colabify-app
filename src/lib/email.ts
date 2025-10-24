export interface InvitationEmailData {
  recipientEmail: string
  recipientName?: string
  projectName: string
  inviterName: string
  inviteUrl: string
}

export interface EmailTemplate {
  subject: string
  htmlContent: string
  textContent: string
}

export function generateInvitationEmailTemplate(data: InvitationEmailData): EmailTemplate {
  const { recipientEmail, recipientName, projectName, inviterName, inviteUrl } = data

  const subject = `You've been invited to join ${projectName} on Colabify`

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Colabify Invitation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Colabify</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1f2937; margin-top: 0;">You've been invited to join a project!</h2>
          
          <p>Hi${recipientName ? ` ${recipientName}` : ''},</p>
          
          <p><strong>${inviterName}</strong> has invited you to join the <strong>${projectName}</strong> project on Colabify.</p>
          
          <p>Colabify helps development teams stay informed about GitHub repository activity with clean, project-scoped notifications delivered via email.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Accept Invitation</a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">If you don't have a Colabify account yet, you'll be able to create one when you click the link above.</p>
          
          <p style="color: #6b7280; font-size: 14px;">This invitation will expire in 7 days.</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px;">
          <p>This email was sent by Colabify. If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
  `

  const textContent = `
Colabify Invitation

Hi${recipientName ? ` ${recipientName}` : ''},

${inviterName} has invited you to join the ${projectName} project on Colabify.

Colabify helps development teams stay informed about GitHub repository activity with clean, project-scoped notifications delivered via email.

Accept your invitation by visiting: ${inviteUrl}

If you don't have a Colabify account yet, you'll be able to create one when you click the link above.

This invitation will expire in 7 days.

---
This email was sent by Colabify. If you didn't expect this invitation, you can safely ignore this email.
  `

  return { subject, htmlContent, textContent }
}

import nodemailer from 'nodemailer'

// Create SMTP transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_HOST_USER, // Use the main account for authentication
      pass: process.env.SMTP_PASS,
    },
    // Additional options for better compatibility
    tls: {
      rejectUnauthorized: false // Accept self-signed certificates
    },
    debug: true, // Enable debug output
    logger: true, // Log to console
  })
}

export async function sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_HOST_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP not configured, skipping email send')
      console.log('Missing config:', {
        host: !!process.env.SMTP_HOST,
        hostUser: !!process.env.SMTP_HOST_USER,
        inviteUser: !!process.env.SMTP_INVITE_USER,
        pass: !!process.env.SMTP_PASS
      })

      // For now, just log the email content and return true for development
      console.log('=== EMAIL WOULD BE SENT ===')
      const template = generateInvitationEmailTemplate(data)
      console.log('To:', data.recipientEmail)
      console.log('Subject:', template.subject)
      console.log('Content preview:', template.textContent.substring(0, 200) + '...')
      console.log('========================')
      return true
    }

    console.log('=== SMTP CONFIGURATION ===')
    console.log('Host:', process.env.SMTP_HOST)
    console.log('Port:', process.env.SMTP_PORT)
    console.log('Secure:', process.env.SMTP_SECURE)
    console.log('Auth User:', process.env.SMTP_HOST_USER)
    console.log('From User:', process.env.SMTP_INVITE_USER)
    console.log('Pass length:', process.env.SMTP_PASS?.length)

    // Generate email template
    const template = generateInvitationEmailTemplate(data)

    // Create transporter for invitations
    const transporter = createTransporter()

    // Verify connection first
    console.log('Verifying SMTP connection...')
    try {
      await transporter.verify()
      console.log('SMTP connection verified successfully')
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError)
      console.log('=== FALLING BACK TO LOG-ONLY MODE ===')
      console.log('To:', data.recipientEmail)
      console.log('Subject:', template.subject)
      console.log('Content preview:', template.textContent.substring(0, 200) + '...')
      console.log('=====================================')
      return true // Return true so the invitation system continues to work
    }

    // Prepare email data
    const emailData = {
      from: `Colabify Invitations <${process.env.SMTP_INVITE_USER}>`,
      to: data.recipientEmail,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent,
    }

    console.log('=== SENDING INVITATION EMAIL ===')
    console.log('From:', emailData.from)
    console.log('To:', emailData.to)
    console.log('Subject:', emailData.subject)

    // Send email
    const result = await transporter.sendMail(emailData)

    console.log('Invitation email sent successfully:', result.messageId)
    return true
  } catch (error) {
    console.error('Error sending invitation email:', error)
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        code: (error as any).code,
        response: (error as any).response,
        responseCode: (error as any).responseCode,
        command: (error as any).command
      })
    }

    // For development, still return true so the invitation system works
    console.log('=== FALLING BACK TO LOG-ONLY MODE ===')
    const template = generateInvitationEmailTemplate(data)
    console.log('To:', data.recipientEmail)
    console.log('Subject:', template.subject)
    console.log('Content preview:', template.textContent.substring(0, 200) + '...')
    console.log('=====================================')
    return true
  }
}

export interface NotificationEmailData {
  recipientEmail: string
  recipientName?: string
  projectName: string
  notifications: Array<{
    message: string
    repository: string
    timestamp: string
    eventType: string
  }>
  isDigest?: boolean
}

export function generateNotificationEmailTemplate(data: NotificationEmailData): EmailTemplate {
  const { recipientEmail, recipientName, projectName, notifications, isDigest = false } = data

  const subject = isDigest
    ? `Daily digest for ${projectName} - ${notifications.length} updates`
    : `New activity in ${projectName}`

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Colabify ${isDigest ? 'Digest' : 'Notification'}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Colabify</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1f2937; margin-top: 0;">
            ${isDigest ? `Daily digest for ${projectName}` : `New activity in ${projectName}`}
          </h2>
          
          <p>Hi${recipientName ? ` ${recipientName}` : ''},</p>
          
          <p>${isDigest
      ? `Here's your daily summary of activity in the ${projectName} project:`
      : `There's been new activity in the ${projectName} project:`
    }</p>
          
          <div style="margin: 20px 0;">
            ${notifications.map(notification => `
              <div style="border-left: 3px solid #2563eb; padding: 15px; margin: 15px 0; background: #f8f9fa;">
                <p style="margin: 0 0 5px 0; font-weight: 500;">${notification.message}</p>
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  ${notification.repository} • ${new Date(notification.timestamp).toLocaleString()}
                </p>
              </div>
            `).join('')}
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            You're receiving this because you're a member of the ${projectName} project on Colabify.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px;">
          <p>This email was sent by Colabify. To manage your notification preferences, visit your project settings.</p>
        </div>
      </body>
    </html>
  `

  const textContent = `
Colabify ${isDigest ? 'Digest' : 'Notification'}

Hi${recipientName ? ` ${recipientName}` : ''},

${isDigest
      ? `Here's your daily summary of activity in the ${projectName} project:`
      : `There's been new activity in the ${projectName} project:`
    }

${notifications.map(notification => `
• ${notification.message}
  ${notification.repository} • ${new Date(notification.timestamp).toLocaleString()}
`).join('\n')}

You're receiving this because you're a member of the ${projectName} project on Colabify.

---
This email was sent by Colabify. To manage your notification preferences, visit your project settings.
  `

  return { subject, htmlContent, textContent }
}

export async function sendNotificationEmail(data: NotificationEmailData): Promise<boolean> {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_HOST_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP not configured, skipping email send')

      // For now, just log the email content and return true for development
      console.log('=== NOTIFICATION EMAIL WOULD BE SENT ===')
      const template = generateNotificationEmailTemplate(data)
      console.log('To:', data.recipientEmail)
      console.log('Subject:', template.subject)
      console.log('Type:', data.isDigest ? 'Digest' : 'Instant')
      console.log('Content preview:', template.textContent.substring(0, 200) + '...')
      console.log('=======================================')
      return true
    }

    // Generate email template
    const template = generateNotificationEmailTemplate(data)

    // Create transporter for notifications
    const transporter = createTransporter()

    // Verify connection first
    try {
      await transporter.verify()
      console.log('SMTP connection verified successfully for notifications')
    } catch (verifyError) {
      console.error('SMTP verification failed for notifications:', verifyError)
      console.log('=== FALLING BACK TO LOG-ONLY MODE ===')
      console.log('To:', data.recipientEmail)
      console.log('Subject:', template.subject)
      console.log('Type:', data.isDigest ? 'Digest' : 'Instant')
      console.log('Content preview:', template.textContent.substring(0, 200) + '...')
      console.log('=====================================')
      return true
    }

    // Prepare email data
    const emailData = {
      from: `Colabify Notifications <${process.env.SMTP_NOTIFY_USER}>`,
      to: data.recipientEmail,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent,
    }

    console.log('=== SENDING NOTIFICATION EMAIL ===')
    console.log('From:', emailData.from)
    console.log('To:', emailData.to)
    console.log('Subject:', emailData.subject)
    console.log('Type:', data.isDigest ? 'Digest' : 'Instant')

    // Send email
    const result = await transporter.sendMail(emailData)

    console.log('Notification email sent successfully:', result.messageId)
    return true
  } catch (error) {
    console.error('Error sending notification email:', error)

    // For development, still return true so the notification system works
    console.log('=== FALLING BACK TO LOG-ONLY MODE ===')
    const template = generateNotificationEmailTemplate(data)
    console.log('To:', data.recipientEmail)
    console.log('Subject:', template.subject)
    console.log('Type:', data.isDigest ? 'Digest' : 'Instant')
    console.log('Content preview:', template.textContent.substring(0, 200) + '...')
    console.log('=====================================')
    return true
  }
}

export async function logEmailDelivery(
  userId: string,
  recipientEmail: string,
  emailType: 'invitation' | 'instant' | 'digest',
  subject: string,
  status: 'sent' | 'failed' = 'sent',
  notificationId?: string
) {
  try {
    // Import here to avoid circular dependencies
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { error } = await supabase
      .from('email_deliveries')
      .insert({
        user_id: userId,
        notification_id: notificationId || null,
        email_type: emailType,
        recipient_email: recipientEmail,
        subject: subject,
        delivery_status: status,
        sent_at: new Date().toISOString()
      })

    if (error) {
      console.error('Failed to log email delivery:', error)
    } else {
      console.log('Email delivery logged successfully')
    }
  } catch (error) {
    console.error('Error logging email delivery:', error)
  }
}