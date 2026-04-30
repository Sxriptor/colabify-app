# Quick Start - GitHub Token Integration

## Install Dependencies

```bash
npm install
```

This installs:
- `simple-git` - Git operations
- `d3` - Data visualization
- `@types/d3` - TypeScript types

## What's Ready

✅ Electron app accepts GitHub token in callback URL  
✅ Stores token securely in macOS Keychain  
✅ Exposes token to React components  
✅ Visualization modal uses token for GitHub API  
✅ Clears token on logout  

## What Website Needs to Add

**One line of code:**

```javascript
// In your auth callback redirect (when source=ide)
redirectUrl.searchParams.set('github_token', githubAccessToken);
```

**Full example:**

```javascript
// After GitHub OAuth succeeds
const redirectUrl = new URL(redirectUri); // e.g., http://localhost:8080/auth/callback

// Existing parameters
redirectUrl.searchParams.set('token', sessionToken);
redirectUrl.searchParams.set('expires_at', expiresAt);
redirectUrl.searchParams.set('subscription_status', status);

// NEW: Add GitHub token
redirectUrl.searchParams.set('github_token', githubAccessToken);

return Response.redirect(redirectUrl.toString());
```

## Test It

1. **Run Electron app:**
   ```bash
   npm run dev
   ```

2. **Sign in with GitHub**

3. **Check console:**
   ```
   ✅ GitHub token stored successfully
   ```

4. **Test in DevTools:**
   ```javascript
   await window.electronAPI.hasGitHubToken()
   // Should return: true
   ```

5. **Open visualization modal:**
   - Should see "🔐 Using authenticated GitHub API request"
   - Should fetch real data from GitHub

## That's It!

The Electron app is ready. Just need the website to pass the `github_token` parameter.

## Docs

- `WEBSITE_GITHUB_TOKEN_INTEGRATION.md` - Full guide for website team
- `GITHUB_TOKEN_IMPLEMENTATION_SUMMARY.md` - What was implemented
- `GITHUB_TOKEN_SETUP.md` - Original planning
