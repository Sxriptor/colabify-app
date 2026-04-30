# GitHub Token Setup Guide

## Current Authentication Flow

Your app currently uses this flow:
1. User clicks "Sign in with GitHub" in the Electron app
2. Opens browser to `https://colabify.xyz/login?source=ide&redirect_uri=http://localhost:8080/auth/callback`
3. User authenticates on your website
4. Website redirects back to `http://localhost:8080/auth/callback?token=...`
5. Electron's local callback server receives the token
6. Token is stored securely in keytar (macOS Keychain)

## The Problem: GitHub API Access

The token you're receiving is **your app's session token**, not a **GitHub access token**. That's why you see "GITHUB.API.STATUS.DISCONNECTED".

To access GitHub's API (for fetching branches, commits, etc.), you need a **GitHub Personal Access Token** or **GitHub OAuth token**.

## Solution Options

### Option 1: Store GitHub Token During Website Login (Recommended)

When users sign in with GitHub on your website, you already get a GitHub access token from GitHub OAuth. You need to:

1. **On your website backend** (during GitHub OAuth callback):
   ```javascript
   // After GitHub OAuth succeeds, you have:
   const githubAccessToken = githubOAuthResponse.access_token;
   
   // Store this in your database associated with the user
   await supabase
     .from('user_github_tokens')
     .upsert({
       user_id: user.id,
       github_token: githubAccessToken,
       expires_at: expiresAt,
       scopes: ['repo', 'read:user'] // whatever scopes you requested
     });
   ```

2. **When redirecting to Electron**, include a flag:
   ```javascript
   // In your website's auth callback handler
   const redirectUrl = `${redirect_uri}?token=${sessionToken}&github_connected=true`;
   ```

3. **In Electron**, fetch the GitHub token when needed:
   ```javascript
   // In AuthManager or a new GitHubTokenManager
   async getGitHubToken() {
     const response = await this.makeAuthenticatedRequest('/auth/github-token');
     return response.github_token;
   }
   ```

4. **Create API endpoint** on your website:
   ```javascript
   // /api/auth/github-token
   export async function GET(request) {
     const user = await getCurrentUser(request);
     
     const { data } = await supabase
       .from('user_github_tokens')
       .select('github_token, expires_at')
       .eq('user_id', user.id)
       .single();
     
     return Response.json({ github_token: data.github_token });
   }
   ```

### Option 2: Request GitHub Token Separately in Electron

If you don't want to store GitHub tokens on your server:

1. **Add a "Connect GitHub" button** in your Electron app
2. **Open GitHub OAuth flow** directly from Electron:
   ```javascript
   const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo,read:user&redirect_uri=http://localhost:8080/github/callback`;
   ```
3. **Handle the callback** and exchange code for token
4. **Store GitHub token separately** in keytar

### Option 3: Use Personal Access Tokens (Simplest for Testing)

For development/testing:

1. User generates a GitHub Personal Access Token at https://github.com/settings/tokens
2. Add a settings page in your app where users can paste their token
3. Store it securely in keytar

## Required GitHub Token Scopes

For your visualization features, you need these scopes:
- `repo` - Access to private repositories
- `read:user` - Read user profile data
- `read:org` - Read organization data (if needed)

## Implementation Steps (Option 1 - Recommended)

### Step 1: Update Website Database Schema

```sql
-- Add to your Supabase migrations
CREATE TABLE user_github_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  github_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_github_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own tokens
CREATE POLICY "Users can read own github tokens"
  ON user_github_tokens FOR SELECT
  USING (auth.uid() = user_id);
```

### Step 2: Update Website OAuth Handler

```javascript
// In your GitHub OAuth callback handler
async function handleGitHubCallback(code) {
  // Exchange code for token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: code
    })
  });
  
  const { access_token, expires_in, refresh_token, scope } = await tokenResponse.json();
  
  // Store in database
  await supabase.from('user_github_tokens').upsert({
    user_id: user.id,
    github_token: access_token,
    refresh_token: refresh_token,
    expires_at: new Date(Date.now() + expires_in * 1000),
    scopes: scope.split(',')
  });
  
  // Continue with your normal auth flow...
}
```

### Step 3: Create API Endpoint

```javascript
// /api/auth/github-token/route.ts
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { data, error } = await supabase
    .from('user_github_tokens')
    .select('github_token, expires_at, scopes')
    .eq('user_id', user.id)
    .single();
  
  if (error || !data) {
    return Response.json({ 
      connected: false,
      error: 'No GitHub token found' 
    }, { status: 404 });
  }
  
  // Check if token is expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return Response.json({ 
      connected: false,
      error: 'GitHub token expired' 
    }, { status: 401 });
  }
  
  return Response.json({
    connected: true,
    github_token: data.github_token,
    scopes: data.scopes
  });
}
```

### Step 4: Update Electron to Fetch GitHub Token

```javascript
// In electron/services/GitHubTokenManager.js (new file)
class GitHubTokenManager {
  constructor(authManager) {
    this.authManager = authManager;
    this.cachedToken = null;
    this.cacheExpiry = null;
  }
  
  async getGitHubToken() {
    // Check cache
    if (this.cachedToken && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      return this.cachedToken;
    }
    
    try {
      const response = await this.authManager.makeAuthenticatedRequest('/auth/github-token');
      
      if (response.connected) {
        this.cachedToken = response.github_token;
        this.cacheExpiry = Date.now() + 5 * 60 * 1000; // Cache for 5 minutes
        return this.cachedToken;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get GitHub token:', error);
      return null;
    }
  }
  
  clearCache() {
    this.cachedToken = null;
    this.cacheExpiry = null;
  }
}

module.exports = GitHubTokenManager;
```

### Step 5: Use GitHub Token in API Calls

```javascript
// In your RepoVisualizationModal.tsx
const fetchGitHubBranches = async (owner: string, repo: string) => {
  if (typeof window === 'undefined' || !(window as any).electronAPI) {
    return;
  }
  
  try {
    // Get GitHub token from backend
    const response = await (window as any).electronAPI.api.call('/auth/github-token');
    
    if (!response.connected) {
      setError('GitHub not connected. Please reconnect your GitHub account.');
      setDataSource('mock');
      return;
    }
    
    // Use token to fetch from GitHub API
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: {
          'Authorization': `Bearer ${response.github_token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (githubResponse.ok) {
      const branches = await githubResponse.json();
      setBranches(branches);
      setDataSource('github');
    } else {
      console.error('GitHub API error:', githubResponse.status);
      setDataSource('backend'); // Fall back to local git data
    }
  } catch (error) {
    console.error('Error fetching from GitHub:', error);
    setDataSource('backend');
  }
};
```

## Testing the Flow

1. **Install dependencies**: `npm install`
2. **Sign in** through your website
3. **Check if GitHub token is stored**: Query your database
4. **Test API endpoint**: `curl -H "Authorization: Bearer YOUR_TOKEN" https://colabify.xyz/api/auth/github-token`
5. **Test in Electron**: Open the visualization modal and check console logs

## Current Status

✅ You have: Session authentication working
❌ You need: GitHub API token to access GitHub data
🎯 Solution: Store GitHub OAuth token during website login and expose it via API endpoint

The "GITHUB.API.STATUS.DISCONNECTED" message means your app can read local git data but can't fetch remote GitHub data because it doesn't have a GitHub API token.
