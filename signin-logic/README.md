# Signin Logic Components

This folder contains all the authentication/signin logic extracted from the Colabify project. The authentication system uses Supabase with GitHub OAuth and supports both web and Electron environments.

## Architecture Overview

- **Supabase Auth**: Uses GitHub OAuth provider
- **Multi-platform**: Supports both web browsers and Electron apps
- **Context-based**: React context for global auth state management
- **Middleware**: Route protection and session management

## Key Components

### 1. Authentication Context (`lib/auth/context.tsx`)
- Global auth state management
- Handles both web and Electron authentication flows
- Manages user sessions and custom user data
- Provides `useAuth()` hook for components

### 2. Login/Signup Forms
- `components/auth/LoginForm.tsx` - Login form with GitHub OAuth
- `components/auth/SignupForm.tsx` - Signup form with GitHub OAuth
- Both support web and Electron environments

### 3. Authentication Pages
- `app/login/page.tsx` - Login page wrapper
- `app/signup/page.tsx` - Signup page wrapper
- `app/auth/callback/page.tsx` - OAuth callback handler

### 4. Supabase Clients
- `lib/supabase/client.ts` - Browser client
- `lib/supabase/server.ts` - Server-side client
- `lib/supabase/middleware.ts` - Route protection middleware
- `lib/supabase/electron-client.ts` - Electron-specific client
- `lib/supabase/api-auth.ts` - API route authentication

### 5. User Management
- `lib/auth/user-management.ts` - User creation and management utilities

### 6. Configuration Files
- `middleware.ts` - Next.js middleware setup
- `app/layout.tsx` - Root layout with AuthProvider

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXTAUTH_URL=your_app_url
```

## Database Schema

The system expects a `users` table with the following structure:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  github_id INTEGER,
  github_username TEXT,
  avatar_url TEXT,
  notification_preference TEXT DEFAULT 'instant',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Usage

1. Wrap your app with `AuthProvider` in the root layout
2. Use `useAuth()` hook in components to access auth state
3. Protect routes using the middleware
4. Handle OAuth callbacks with the callback page

## Features

- GitHub OAuth authentication
- Automatic user profile creation
- Session management
- Route protection
- Multi-platform support (web + Electron)
- Loading states and error handling
- Automatic redirects after authentication