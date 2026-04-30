# Invitation & Inbox System - Production Deployment Guide

## Overview
This guide covers deploying the invitation and inbox system to **colabify.xyz**.

**How it works:**
- Electron app sends invitation requests to the website API with a Bearer token
- **Website handles ALL email sending via SMTP** (invitations@colabify.xyz)
- **All SMTP configuration lives on the website backend** (colabify.xyz)
- **Electron app never touches email** - it just calls the API

## Critical Files to Deploy to colabify.xyz

### 1. Middleware Fix (MOST IMPORTANT - Fixes CORS Error)

#### `/src/lib/supabase/middleware.ts`
**Purpose**: Allow Bearer token authentication for API routes

**The fix** (already applied in your code):
```typescript
export async function updateSession(request: NextRequest) {
  // Skip middleware for API routes with Bearer tokens (Electron app uses JWT, not cookies)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ') && request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  // ... rest of middleware
}
```

This prevents the CORS error by:
- Detecting Bearer token in Authorization header
- Skipping cookie-based auth check for API routes
- No redirect happens during CORS preflight

### 2. API Routes

#### `/src/app/api/projects/[id]/invite/route.ts`
**Purpose**: Handle project invitations from Electron app
**Authentication**: Bearer token (JWT from Electron)
**Method**: POST

**Request example**:
```bash
POST https://colabify.xyz/api/projects/{project-id}/invite
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "emails": ["user1@example.com", "user2@example.com"]
}
```

**What it does**:
1. Validates Bearer token
2. Creates invitation records in `project_invitations` table
3. **Sends invitation emails via SMTP from colabify.xyz**
4. Returns success/failure response

#### `/src/app/api/auth/user/route.ts`
**Purpose**: Get current user info
**Authentication**: Bearer token OR cookies
**Method**: GET

Supports both:
- Cookie-based auth (for web browser)
- Bearer token auth (for Electron app)

### 3. Email Logic (Website Backend Only)

#### `/src/lib/invitations.ts`
**Purpose**: Core invitation logic
- Creates invitation records
- Sends emails to invitees via SMTP
- Handles existing vs new user logic

#### `/src/lib/email.ts`
**Purpose**: Email templates and SMTP sending
- Invitation email template
- SMTP configuration and sending
- Uses nodemailer to send from invitations@colabify.xyz

## Database Tables Required

### `project_invitations` table
```sql
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,

  UNIQUE(project_id, email)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invitations_email ON project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_project ON project_invitations(project_id);
```

### `inbox_items` table
```sql
CREATE TABLE IF NOT EXISTS inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('invitation', 'mention', 'assignment', 'comment')),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_items(user_id);
```

## Environment Variables for colabify.xyz

### SMTP Configuration (WEBSITE BACKEND ONLY)

**IMPORTANT:** These go on **colabify.xyz** hosting platform, NOT in Electron app.

```bash
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com                    # Your SMTP provider
SMTP_PORT=587                               # 587 for TLS, 465 for SSL
SMTP_SECURE=false                           # false for TLS, true for SSL

# SMTP Authentication (using invitations@colabify.xyz)
SMTP_HOST_USER=invitations@colabify.xyz     # Main account for authentication
SMTP_PASS=your-app-password-here            # App password from email provider

# Email Sender Addresses (what users see in "From:" field)
SMTP_INVITE_USER=invitations@colabify.xyz   # Sender for invitation emails
SMTP_NOTIFY_USER=notifications@colabify.xyz # Sender for notification emails
```

### Supabase (should already be configured)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Optional, for admin operations
```

### Next.js (for invitation links)
```bash
NEXTAUTH_URL=https://colabify.xyz  # Base URL for invitation links
```

## Setting Up SMTP for colabify.xyz

### Option 1: Gmail/Google Workspace (Good for testing)

1. **Create email account**: `invitations@colabify.xyz`
2. **Enable 2FA**: Google Account → Security → 2-Step Verification
3. **Generate App Password**:
   - Google Account → Security → App passwords
   - Select "Mail" and "Other (Custom name)"
   - Copy the 16-character password
4. **Add to environment variables**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_HOST_USER=invitations@colabify.xyz
   SMTP_PASS=your-16-char-app-password
   SMTP_INVITE_USER=invitations@colabify.xyz
   SMTP_NOTIFY_USER=notifications@colabify.xyz
   ```

### Option 2: Dedicated Email Service (Recommended for Production)

Use a professional email service for better deliverability:
- **SendGrid** (12,000 free emails/month)
- **Mailgun** (5,000 free emails/month)
- **AWS SES** (62,000 free emails/month)
- **Postmark** (100 free emails/month, then paid)

Benefits:
- Better deliverability (won't end up in spam)
- Dedicated IP addresses
- Email analytics and tracking
- Higher sending limits

### DNS Records for colabify.xyz

To ensure emails don't go to spam, add these DNS records:

```txt
# SPF Record (for Gmail)
Type: TXT
Name: @
Value: v=spf1 include:_spf.google.com ~all

# DMARC Record
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:postmaster@colabify.xyz

# DKIM Record (provided by your email service)
Type: TXT
Name: (provided by email service)
Value: (provided by email service)
```

## Deployment Checklist

### Before Deploying to colabify.xyz

- [ ] Create database tables in Supabase (run SQL above)
- [ ] Set up SMTP email account (invitations@colabify.xyz)
- [ ] Configure environment variables on hosting platform
- [ ] Add DNS records (SPF, DMARC, DKIM) for colabify.xyz
- [ ] Test SMTP credentials locally if possible

### Deploy These Files

- [ ] `/src/lib/supabase/middleware.ts` - Bearer token support (fixes CORS)
- [ ] `/src/app/api/projects/[id]/invite/route.ts` - Invitation endpoint
- [ ] `/src/lib/invitations.ts` - Invitation logic
- [ ] `/src/lib/email.ts` - Email templates and sending

### After Deployment

- [ ] Test invitation endpoint with curl:
  ```bash
  curl -X POST https://colabify.xyz/api/projects/{project-id}/invite \
    -H "Authorization: Bearer {jwt-token}" \
    -H "Content-Type: application/json" \
    -d '{"emails": ["test@example.com"]}'
  ```

- [ ] Check that invitation email arrives (check spam folder too)
- [ ] Verify email shows correct sender (invitations@colabify.xyz)
- [ ] Test invitation acceptance flow
- [ ] Check inbox items are created in database

## How the Flow Works

### Electron App → Website → Email

```
1. User clicks "Invite" in Electron app
   ↓
2. Electron calls: POST https://colabify.xyz/api/projects/{id}/invite
   With: Authorization: Bearer {jwt-token}
   ↓
3. Website middleware checks Bearer token → allows request
   ↓
4. API route validates token with Supabase
   ↓
5. Website creates invitation record in database
   ↓
6. Website sends email via SMTP from invitations@colabify.xyz
   ↓
7. Returns success/error to Electron app
```

### Invitation Types

**For Existing Users:**
1. Website creates invitation + inbox item
2. Website sends email notification
3. User automatically added to project
4. User sees notification in inbox

**For New Users:**
1. Website creates invitation
2. Website sends email with signup link
3. User clicks link → signs up
4. After signup → automatically added to project

## Troubleshooting

### CORS Error Still Happening

**Error**: `Response to preflight request doesn't pass access control check: Redirect is not allowed`

**Fix**:
1. Verify middleware.ts is deployed with Bearer token check
2. Check hosting platform logs for middleware execution
3. Test with curl to see if Bearer token is recognized:
   ```bash
   curl -X OPTIONS https://colabify.xyz/api/projects/test/invite \
     -H "Authorization: Bearer test" \
     -H "Access-Control-Request-Method: POST" \
     -H "Origin: http://localhost:3000"
   ```

### Emails Not Sending

**Check these:**
1. Environment variables are set on hosting platform
2. SMTP credentials are correct (test with a simple nodemailer script)
3. Email account has 2FA + App Password enabled
4. Check hosting platform logs for SMTP errors
5. Check spam folder

**Email ends up in spam:**
1. Add SPF, DMARC, DKIM DNS records
2. Consider using dedicated email service (SendGrid, etc.)
3. Verify sender domain matches SMTP server

### Database Errors

**Error**: `relation "project_invitations" does not exist`

**Fix**: Run the SQL table creation commands in Supabase dashboard

## Quick Start Commands

```bash
# 1. Deploy to colabify.xyz
git push origin main  # or your deployment command

# 2. Set environment variables on hosting platform (Vercel example)
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_SECURE
vercel env add SMTP_HOST_USER
vercel env add SMTP_PASS
vercel env add SMTP_INVITE_USER
vercel env add SMTP_NOTIFY_USER

# 3. Test the endpoint
curl -X POST https://colabify.xyz/api/projects/{project-id}/invite \
  -H "Authorization: Bearer {your-jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{"emails": ["test@example.com"]}'
```

## Summary

**What's in Electron app:**
- Calls website API with Bearer token
- Never handles email or SMTP

**What's on colabify.xyz:**
- All SMTP configuration and credentials
- Email sending logic (nodemailer)
- Invitation database records
- Bearer token validation

**Result:**
- Emails come from invitations@colabify.xyz
- Professional, branded emails
- Secure - Electron never has SMTP credentials
