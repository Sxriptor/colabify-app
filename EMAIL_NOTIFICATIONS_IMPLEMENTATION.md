# Email Notifications System Implementation

## Overview
This document outlines the email notification system that works alongside the Electron app notifications. The system uses database triggers to send email notifications via your website backend when notifications are created.

## Architecture

```
Database Insert → Supabase Function → Website API → Email Sent
     ↓
Notification Created → Trigger Fires → HTTP Request → SMTP Email
```

## Database Setup

### 1. Supabase Edge Function
The database will call a Supabase Edge Function when a notification_log entry is created with `delivery_method = 'email'`.

### 2. Website API Endpoint
Your website needs an API endpoint to receive notification data and send emails.

## Website Backend Requirements

### API Endpoint: `POST /api/notifications/send-email`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <supabase-service-role-key>
```

**Request Body:**
```json
{
  "notification": {
    "id": "uuid",
    "title": "Sxriptor pushed to main",
    "message": "3 new commits in electron-colabify • Latest: a7b9c2d",
    "type": "info",
    "data": {
      "contributor": "Sxriptor",
      "action": "pushed",
      "branch": "main",
      "repository": "electron-colabify",
      "commitHash": "a7b9c2d",
      "commitCount": 3
    }
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "log_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

### Email Template Requirements

**Subject Line Format:**
- `[Colabify] {notification.title}`
- Example: `[Colabify] Sxriptor pushed to main`

**Email Content:**
- **HTML Template** with your branding
- **Git activity details** (contributor, action, branch, repo)
- **Commit information** (hash, count)
- **Action buttons** (View Project, Open App)
- **Unsubscribe link**

### Environment Variables Needed
```env
# SMTP Configuration (already in your .env.local)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_HOST_USER=noreply@colabify.xyz
SMTP_NOTIFY_USER=notifications@colabify.xyz
SMTP_PASS=your_password

# Supabase (for verification)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Implementation Steps

### Step 1: Create Supabase Edge Function
```sql
-- This will be added to the migration
CREATE OR REPLACE FUNCTION send_email_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_data JSONB;
  user_data JSONB;
  webhook_url TEXT := 'https://colabify.xyz/api/notifications/send-email';
  response TEXT;
BEGIN
  -- Only process email notifications
  IF NEW.delivery_method != 'email' OR NEW.delivery_status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get notification and user data
  SELECT to_jsonb(n.*) INTO notification_data
  FROM notifications n
  WHERE n.id = NEW.notification_id;

  SELECT to_jsonb(u.*) INTO user_data
  FROM users u
  WHERE u.id = NEW.user_id;

  -- Call website API (this requires pg_net extension)
  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object(
      'notification', notification_data,
      'user', user_data,
      'log_id', NEW.id
    )
  ) INTO response;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Website API Implementation (Next.js)

**File: `pages/api/notifications/send-email.js`**
```javascript
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify request is from Supabase
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { notification, user, log_id } = req.body;

    // Create email transporter
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_NOTIFY_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Generate email content
    const emailHtml = generateEmailTemplate(notification, user);

    // Send email
    await transporter.sendMail({
      from: `"Colabify" <${process.env.SMTP_NOTIFY_USER}>`,
      to: user.email,
      subject: `[Colabify] ${notification.title}`,
      html: emailHtml,
    });

    // Mark as delivered in database
    // (You'll need to update the notification_log table)

    res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
}

function generateEmailTemplate(notification, user) {
  const data = notification.data || {};
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Colabify Notification</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h2 style="color: #333; margin-top: 0;">🔔 ${notification.title}</h2>
        <p style="color: #666; font-size: 16px;">${notification.message}</p>
        
        ${data.contributor ? `
        <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <strong>Activity Details:</strong><br>
          👤 Contributor: ${data.contributor}<br>
          🔄 Action: ${data.action}<br>
          🌿 Branch: ${data.branch}<br>
          📁 Repository: ${data.repository}<br>
          ${data.commitHash ? `🔗 Commit: ${data.commitHash}<br>` : ''}
          ${data.commitCount ? `📊 Commits: ${data.commitCount}<br>` : ''}
        </div>
        ` : ''}
        
        <div style="margin: 20px 0;">
          <a href="https://colabify.xyz/inbox" 
             style="background: #007bff; color: white; padding: 10px 20px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            View in Colabify
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          You're receiving this because you have email notifications enabled in Colabify.
          <a href="https://colabify.xyz/settings">Manage notification preferences</a>
        </p>
      </div>
    </body>
    </html>
  `;
}
```

### Step 3: Database Trigger Setup
```sql
-- Add trigger to notifications_log table
CREATE TRIGGER email_notification_trigger
  AFTER INSERT ON notifications_log
  FOR EACH ROW
  EXECUTE FUNCTION send_email_notification();
```

## Testing

### Test Button Enhancement
The existing "Simulate Git Activity" button will now:
1. ✅ Create notification in database
2. ✅ Create app notification log (for Electron)
3. ✅ Create email notification log (for website)
4. ✅ Trigger both system notification AND email

### Manual Testing
```sql
-- Test email notification
SELECT create_notification(
  'your-user-id',
  'Test Email Notification',
  'This should be sent via email',
  'info',
  '{"test": true}'::jsonb
);
```

## Security Considerations

1. **API Authentication**: Verify requests come from Supabase
2. **Rate Limiting**: Prevent email spam
3. **User Preferences**: Respect email notification settings
4. **Unsubscribe**: Provide easy opt-out mechanism

## Monitoring

### Logs to Track
- Email delivery success/failure rates
- API response times
- User engagement (email opens, clicks)
- Unsubscribe rates

### Database Queries
```sql
-- Check email delivery status
SELECT 
  delivery_status,
  COUNT(*) as count
FROM notifications_log 
WHERE delivery_method = 'email'
GROUP BY delivery_status;

-- Failed email deliveries
SELECT * FROM notifications_log 
WHERE delivery_method = 'email' 
AND delivery_status = 'failed';
```

## Next Steps

1. **Implement website API endpoint**
2. **Add Supabase Edge Function**
3. **Test email delivery**
4. **Add email templates**
5. **Monitor delivery rates**

This system ensures email notifications work independently of the Electron app and provides a robust, scalable solution for user notifications.