# GitHub Token Flow in Electron App

## Overview

The GitHub token is passed from the web OAuth flow directly to the Electron app without being stored server-side. It's only temporarily available during the authentication callback for immediate use.

## How It Works

### 1. User Initiates Sign-In

When the user clicks "Sign in" in the Electron app:
- Electron opens the browser to `https://colabify.xyz/login?source=ide`
- User completes GitHub OAuth in the browser

### 2. Website Callback Route

The callback route at `src/app/auth/callback/route.ts` handles the OAuth response:

```typescript
// Line 82: Get GitHub provider token from Supabase session
const githubToken = authData.session.provider_token

// Line 93-100: Add GitHub token to redirect params
const params = new URLSearchParams({
  token: authData.session.access_token,
})

if (githubToken) {
  params.append('github_token', githubToken)
}

// Line 102: Redirect to localhost with both tokens
const localhostUrl = `http://localhost:8080/auth/callback?${params.toString()}`
```

### 3. Electron Callback Server

The `AuthManager.js` callback server receives the redirect:

```javascript
// Line 56: Extract GitHub token from URL params
const githubToken = url.searchParams.get('github_token');

// Line 104: Pass to processAuthCallback
this.processAuthCallback(token, expiresAt, subscriptionStatus, githubToken)
```

### 4. AuthManager Processes Token

The `processAuthCallback` function (line 149) receives the GitHub token and:
- Stores the Supabase auth token securely in keytar
- Does NOT store the GitHub token permanently
- Passes the GitHub token through to the auth promise resolver

```javascript
// Line 186-193: Resolve promise with GitHub token
this.authPromise.resolve({
  user: userInfo,
  token,
  expiresAt,
  subscriptionStatus,
  githubToken // Pass GitHub token through to caller
});
```

### 5. Main Process Receives Token

In `main.js`, the `auth:start-sign-in` IPC handler (line 177) receives the auth result:

```javascript
const authResult = await authManager.beginExternalSignIn();

// Line 195-199: Send to renderer with GitHub token
const eventData = {
  user: authResult.user,
  subscriptionStatus: authResult.subscriptionStatus,
  githubToken: authResult.githubToken // Pass to renderer for immediate use
};

mainWindow.webContents.send('auth-success', eventData);
```

### 6. Using the GitHub Token in Renderer

The renderer process receives the token via the `auth-success` event:

```javascript
// Listen for auth success
window.electronAPI.onAuthSuccess((data) => {
  const { user, githubToken } = data;

  if (githubToken) {
    // Use immediately for GitHub API calls
    // Token is only available in this callback - use it or lose it!
    fetchRepoData(githubToken);
  }
});
```

## Important Notes

1. **No Server Storage**: The GitHub token is NEVER stored in Supabase or any server database
2. **No Persistent Storage**: The GitHub token is NOT stored in keytar or electron-store
3. **Ephemeral**: The token is only available during the `auth-success` event callback
4. **Immediate Use**: If you need the token for future operations, you must use it immediately to fetch/cache the data you need
5. **Security**: The token is only passed through memory and logs are sanitized to hide token values

## Use Cases

This pattern is ideal for:
- One-time data fetching after authentication
- Loading user's GitHub repos during sign-in
- Fetching GitHub profile data
- Any operation that needs to happen immediately after auth

## Example: Fetching Repos on Sign-In

```javascript
window.electronAPI.onAuthSuccess(async (data) => {
  const { user, githubToken } = data;

  if (githubToken) {
    try {
      // Fetch user's repos
      const response = await fetch('https://api.github.com/user/repos', {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const repos = await response.json();

      // Store repos in your app's state/storage for later use
      localStorage.setItem('github_repos', JSON.stringify(repos));

      // Don't store the token itself!
      // Token is discarded after this callback
    } catch (error) {
      console.error('Failed to fetch repos:', error);
    }
  }
});
```

## Token Lifecycle

```
User clicks sign in
    ↓
Browser opens → GitHub OAuth
    ↓
OAuth callback → website receives provider_token
    ↓
Website redirects to localhost with token in URL
    ↓
Electron callback server receives token
    ↓
Token passed through AuthManager promise
    ↓
Main process sends token to renderer via IPC
    ↓
Renderer receives token in auth-success event
    ↓
[USE TOKEN HERE - Last chance!]
    ↓
Token discarded from memory
```

## Security Considerations

- Token is only in memory temporarily
- Not written to disk or database
- Passed via localhost (only accessible to local machine)
- Immediately used and discarded
- Logs sanitize token values
- No long-term storage risk
