# Website Integration: Passing GitHub Token to Electron

## What Changed

The Electron app now accepts and securely stores the GitHub access token locally using keytar (macOS Keychain).

## What Your Website Needs to Do

When redirecting back to the Electron app after successful authentication, include the GitHub token in the URL:

### Before (Current)
```
http://localhost:8080/auth/callback?token=SESSION_TOKEN&expires_at=TIMESTAMP&subscription_status=STATUS
```

### After (New)
```
http://localhost:8080/auth/callback?token=SESSION_TOKEN&expires_at=TIMESTAMP&subscription_status=STATUS&github_token=GITHUB_ACCESS_TOKEN
```

## Implementation on Website

### Step 1: Capture GitHub Token During OAuth

When the user signs in with GitHub, you receive an access token from GitHub. Store it temporarily in the session:

```javascript
// In your GitHub OAuth callback handler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  // Exchange code for token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: code
    })
  });
  
  const { access_token, scope, token_type } = await tokenResponse.json();
  
  // Store in session or temporary storage
  // (You'll pass this to the redirect URL in the next step)
  const session = await getSession();
  session.githubAccessToken = access_token;
  await session.save();
  
  // Continue with your normal auth flow...
}
```

### Step 2: Include Token in Redirect URL

When redirecting back to Electron (after successful authentication):

```javascript
// In your auth callback/redirect handler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get('redirect_uri');
  const source = searchParams.get('source');
  
  // Only for IDE/Electron requests
  if (source === 'ide' && redirectUri) {
    const session = await getSession();
    const user = await getCurrentUser();
    
    // Create session token (your existing logic)
    const sessionToken = await createSessionToken(user);
    
    // Get GitHub token from session
    const githubToken = session.githubAccessToken;
    
    // Build redirect URL with both tokens
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('token', sessionToken);
    redirectUrl.searchParams.set('expires_at', Date.now() + 24 * 60 * 60 * 1000);
    redirectUrl.searchParams.set('subscription_status', user.subscription_status);
    
    // Add GitHub token if available
    if (githubToken) {
      redirectUrl.searchParams.set('github_token', githubToken);
    }
    
    // Clean up session
    delete session.githubAccessToken;
    await session.save();
    
    return Response.redirect(redirectUrl.toString());
  }
  
  // Normal web flow...
}
```

## Security Considerations

### ✅ Safe (What We're Doing)
- Passing token via localhost callback URL (only accessible on user's machine)
- Storing in macOS Keychain via keytar (encrypted, OS-level security)
- Token never leaves the user's computer
- Only works when Electron app is running and listening

### ❌ Never Do This
- Don't store GitHub tokens in your database (security risk)
- Don't pass tokens via public URLs
- Don't log GitHub tokens in server logs

## Testing the Integration

### 1. Check if Token is Received

In Electron console, you should see:
```
🔍 Callback params: {
  hasToken: true,
  tokenLength: 40,
  hasGithubToken: true,
  githubTokenLength: 40,
  ...
}
💾 Storing GitHub token in keytar...
✅ GitHub token stored successfully
```

### 2. Verify Token is Stored

In your Electron app, open DevTools console and run:
```javascript
await window.electronAPI.hasGitHubToken()
// Should return: true

await window.electronAPI.getGitHubToken()
// Should return: "ghp_xxxxxxxxxxxxxxxxxxxx"
```

### 3. Test GitHub API Access

The visualization modal should now show:
- ✅ "Using GitHub API data" instead of "GITHUB.API.STATUS.DISCONNECTED"
- Real branch data from GitHub
- Real commit history
- Contributor information

## Using the GitHub Token in Electron

### In React Components

```typescript
// Example: Fetching branches from GitHub
const fetchGitHubBranches = async (owner: string, repo: string) => {
  // Get GitHub token
  const githubToken = await window.electronAPI.getGitHubToken();
  
  if (!githubToken) {
    console.log('No GitHub token available');
    return;
  }
  
  // Use token to call GitHub API
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches`,
    {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  );
  
  if (response.ok) {
    const branches = await response.json();
    console.log('Fetched branches from GitHub:', branches);
    return branches;
  }
};
```

### Check Token Availability

```typescript
const checkGitHubConnection = async () => {
  const hasToken = await window.electronAPI.hasGitHubToken();
  
  if (hasToken) {
    setGitHubStatus('connected');
  } else {
    setGitHubStatus('disconnected');
  }
};
```

## Token Lifecycle

1. **User signs in** → Website receives GitHub token from OAuth
2. **Website redirects** → Includes GitHub token in callback URL
3. **Electron receives** → Stores token in macOS Keychain
4. **Token persists** → Available until user logs out
5. **User logs out** → Token is removed from Keychain

## Troubleshooting

### Token Not Received
- Check website logs: Is GitHub OAuth succeeding?
- Check redirect URL: Does it include `github_token` parameter?
- Check Electron logs: Look for "GitHub token received" message

### Token Not Working
- Verify token format: Should start with `ghp_` or `gho_`
- Check token scopes: Needs `repo` and `read:user` at minimum
- Test token manually: `curl -H "Authorization: Bearer TOKEN" https://api.github.com/user`

### Token Expired
- GitHub tokens don't expire by default (unless you set an expiration)
- If user revokes access on GitHub, token becomes invalid
- App should handle 401 errors and prompt re-authentication

## Example: Complete Flow

```
1. User clicks "Sign in with GitHub" in Electron
   ↓
2. Browser opens: https://colabify.xyz/login?source=ide&redirect_uri=http://localhost:8080/auth/callback
   ↓
3. User authenticates with GitHub on your website
   ↓
4. GitHub redirects to your website with code
   ↓
5. Your website exchanges code for access_token
   ↓
6. Your website redirects: http://localhost:8080/auth/callback?token=SESSION&github_token=GITHUB_TOKEN
   ↓
7. Electron receives both tokens
   ↓
8. Electron stores both in macOS Keychain
   ↓
9. App can now access GitHub API with stored token
```

## Required GitHub OAuth Scopes

When setting up GitHub OAuth on your website, request these scopes:

```javascript
const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo,read:user,read:org`;
```

- `repo` - Access to repositories (public and private)
- `read:user` - Read user profile information
- `read:org` - Read organization membership (optional)

## Summary

**What you need to change on the website:**
1. Capture the GitHub access token during OAuth flow
2. Add `github_token` parameter to the redirect URL when `source=ide`
3. That's it! Electron handles the rest.

**What Electron now does:**
1. Receives GitHub token in callback URL
2. Stores it securely in macOS Keychain
3. Exposes it to React components via `window.electronAPI.getGitHubToken()`
4. Removes it on logout

This approach keeps tokens secure (never stored on your servers) while making them available to the Electron app for GitHub API access.
