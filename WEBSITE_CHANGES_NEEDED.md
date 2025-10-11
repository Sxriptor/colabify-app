# Website Changes Required for Electron Auth

## File to Update

**File:** `src/app/api/auth/user/route.ts`

## Change Required

The `/api/auth/user` endpoint currently only accepts cookie-based authentication (for web browsers). It needs to also accept Bearer token authentication (for the Electron app).

### Current Code (Lines 1-8):
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
```

### Updated Code:
```typescript
import { createClient } from '@/lib/supabase/server'
import { createClient as createDirectClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Check if request has Bearer token (from Electron app)
    const authHeader = request.headers.get('Authorization')
    let supabase

    if (authHeader?.startsWith('Bearer ')) {
      // Use direct client with token for Electron app
      const token = authHeader.replace('Bearer ', '')
      supabase = createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } }
        }
      )
    } else {
      // Use cookie-based client for web browser
      supabase = await createClient()
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
```

## What This Does

- **For web browsers:** Uses cookie-based auth (existing behavior, no change)
- **For Electron app:** Uses Bearer token from `Authorization` header

## Deploy

Once this change is deployed to `https://colabify.xyz`, the Electron app authentication will work.

## How It Works

1. User clicks "Sign In" in Electron app
2. Opens browser to `https://colabify.xyz/login?source=ide&redirect_uri=http://localhost:8080/auth/callback`
3. User signs in on website
4. Website redirects to `http://localhost:8080/auth/callback?token=...`
5. Electron app receives token
6. Electron app calls `https://colabify.xyz/api/auth/user` with `Authorization: Bearer {token}`
7. Website validates token and returns user info
8. Electron app stores user info securely
