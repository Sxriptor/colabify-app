# Website Backend Requirements for Electron App

This document outlines the backend API endpoints and email functionality required on **colabify.xyz** to support the Electron desktop application.

## Overview

The Electron app communicates with colabify.xyz for:
1. **User Authentication** (OAuth flow)
2. **Invitation Emails** (sending project invitations via email)
3. **Bearer Token Authentication** (all API calls)

---

## 1. Authentication

### OAuth Callback Handler
**Endpoint:** `POST /api/auth/callback` or custom OAuth route

**Purpose:** Handle GitHub OAuth callback and generate session token

**Request:**
- OAuth code from GitHub
- Redirect URI from Electron app

**Response:**
```typescript
{
  token: string        // JWT/Session token
  expires_at: string   // ISO timestamp
  user: {
    id: string
    email: string
    name: string
    avatar_url: string
    github_username: string
  }
}
```

**Redirect:**
After successful authentication, redirect to:
```
http://localhost:{PORT}/auth/callback?token={TOKEN}&expires_at={TIMESTAMP}
```

The port (8080-8090) is dynamically found by the Electron app.

---

## 2. API Endpoints

All API endpoints must accept **Bearer token authentication**:
```
Authorization: Bearer {TOKEN}
```

### 2.1 Get User Info
**Endpoint:** `GET /api/auth/user`

**Headers:**
- `Authorization: Bearer {TOKEN}`

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "github_id": 12345,
    "github_username": "username",
    "avatar_url": "https://...",
    "notification_preference": "instant",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

### 2.2 Send Project Invitations
**Endpoint:** `POST /api/projects/{projectId}/invite`

**Purpose:** Create invitations and send invitation emails

**Headers:**
- `Authorization: Bearer {TOKEN}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "emails": ["user1@example.com", "user2@example.com"]
}
```

**Response:**
```json
{
  "message": "Invitations processed",
  "results": [
    {
      "email": "user1@example.com",
      "status": "sent",
      "message": "Invitation sent successfully",
      "invitationId": "uuid"
    },
    {
      "email": "user2@example.com",
      "status": "already_member",
      "message": "User is already a project member"
    }
  ]
}
```

**Status Types:**
- `sent` - Invitation email sent successfully
- `already_member` - User is already a project member
- `already_invited` - Invitation already pending
- `error` - Failed to process invitation

---

## 3. Email Service Requirements

### SMTP Configuration

Required environment variables on **colabify.xyz**:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_HOST_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_INVITE_USER=invites@colabify.xyz
SMTP_NOTIFY_USER=notifications@colabify.xyz
```

### Invitation Email Template

**From:** `DevPulse Invitations <invites@colabify.xyz>`
**Subject:** `You've been invited to join {ProjectName} on Colabify`

**Content:**
- Project name
- Inviter name
- Invitation link: `https://colabify.xyz/signup?invitation={INVITATION_ID}`
- Expiration notice (7 days)

**Functionality:**
- HTML and plain text versions
- Track email delivery status in database
- Handle existing vs new users:
  - **Existing users:** Automatically add to project, send notification
  - **New users:** Send signup invitation with link

---

## 4. Database Schema Requirements

### project_invitations table
```sql
- id: uuid (primary key)
- project_id: uuid (foreign key)
- email: string
- invited_by: uuid (foreign key to users)
- status: enum ('pending', 'accepted', 'declined', 'cancelled', 'expired')
- expires_at: timestamp
- created_at: timestamp
- responded_at: timestamp (nullable)
```

### email_deliveries table (optional, for tracking)
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key, nullable)
- notification_id: uuid (foreign key, nullable)
- email_type: enum ('invitation', 'instant', 'digest')
- recipient_email: string
- subject: string
- delivery_status: enum ('sent', 'failed')
- sent_at: timestamp
```

---

## 5. Invitation Flow

### For Existing Users:
1. Electron app calls `/api/projects/{id}/invite`
2. Website checks if user exists in database
3. If exists, automatically adds to project
4. Sends notification email (no signup link needed)
5. Returns success status

### For New Users:
1. Electron app calls `/api/projects/{id}/invite`
2. Website creates invitation record in database
3. Sends invitation email with signup link
4. Link includes invitation ID: `?invitation={ID}`
5. On signup, user is automatically added to project

### Invitation Expiration:
- Invitations expire after 7 days
- Expired invitations can be resent (updates expiration date)
- Background job should mark expired invitations periodically

---

## 6. Security Requirements

### Bearer Token Validation:
- Verify token signature (JWT)
- Check token expiration
- Extract user ID from token
- Return 401 if invalid/expired

### Authorization Checks:
- **Invite endpoint:** Only project owners can send invitations
- **User endpoint:** Users can only access their own data
- Rate limiting on invitation endpoint (prevent spam)

---

## 7. Existing Code

The website already has the following files (included in this repo):
- ✅ `/src/app/api/projects/[id]/invite/route.ts` - Invitation API endpoint (with Bearer token support)
- ✅ `/src/app/api/auth/user/route.ts` - User info endpoint (with Bearer token support)
- ✅ `/src/lib/invitations.ts` - Invitation logic and database operations
- ✅ `/src/lib/email.ts` - Email templates and sending logic

**All API endpoints have been updated to support Bearer token authentication** for the Electron app.

These files need to be deployed to **colabify.xyz** with proper environment variables configured.

---

## 8. Testing Checklist

### Authentication:
- [ ] OAuth flow completes successfully
- [ ] Token is generated and returned to Electron app
- [ ] Redirect to `localhost:8080/auth/callback` works
- [ ] Token can be used for API calls

### Invitations:
- [ ] Can send invitation to new user (receives email)
- [ ] Can send invitation to existing user (auto-added to project)
- [ ] Duplicate invitations are handled correctly
- [ ] Invitation emails contain correct links
- [ ] Invitation links work and auto-add user on signup/login
- [ ] Only project owners can send invitations

### Email Delivery:
- [ ] SMTP configuration is correct
- [ ] Emails are sent from correct address
- [ ] HTML and plain text versions render correctly
- [ ] Email links are valid and clickable
- [ ] Delivery status is logged (if implemented)

---

## 9. Deployment Steps

1. **Update `/api/auth/user` endpoint** (already done in this repo)
   - Add Bearer token support
   - File: `src/app/api/auth/user/route.ts`

2. **Deploy invitation files** (already exist in this repo)
   - `src/app/api/projects/[id]/invite/route.ts`
   - `src/lib/invitations.ts`
   - `src/lib/email.ts`

3. **Configure environment variables** on colabify.xyz
   - Add SMTP credentials
   - Add API base URL (if different from colabify.xyz)

4. **Test OAuth flow**
   - Ensure redirect URI accepts localhost ports 8080-8090

5. **Test email sending**
   - Send test invitation
   - Verify email delivery
   - Check invitation links work

---

## 10. API Base URL Configuration

The Electron app uses:
```typescript
const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://colabify.xyz'
```

Set `NEXT_PUBLIC_API_URL` if your API is hosted on a different domain.

---

## Summary

**Electron App:**
- ✅ Handles all UI and direct Supabase queries
- ✅ Stores auth token securely in keytar
- ✅ Sends Bearer token with API calls

**Website (colabify.xyz):**
- ✅ Handles OAuth callbacks
- ✅ Generates and validates auth tokens
- ✅ Sends invitation emails via SMTP
- ✅ Manages invitation database records

The invitation system is the **only** reason the Electron app calls the website API - everything else goes directly to Supabase!
