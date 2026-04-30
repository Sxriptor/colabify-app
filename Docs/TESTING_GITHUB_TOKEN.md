# Testing GitHub Token Integration

## Quick Test

I've created a test page to verify your GitHub token is working.

### Step 1: Open Test Page

1. Start your Electron app: `npm run dev`
2. In the app, open DevTools (View → Toggle Developer Tools)
3. In the console, run:
   ```javascript
   window.location.href = 'file://' + require('path').join(__dirname, '../test-github-token.html')
   ```

OR manually navigate to the test page in your browser after starting the app.

### Step 2: Run Tests

The test page has 3 buttons:

1. **Check if Token Exists** - Verifies token is in keychain
2. **Get Token** - Shows masked token (first/last 4 chars only)
3. **Test GitHub API** - Makes actual API call to verify token works

### Expected Results

✅ **Success:**
```
✅ GitHub token EXISTS in keychain
✅ Token retrieved: gho_...5M
Token length: 40 characters
✅ GitHub API SUCCESS!
Authenticated as: Sxriptor
Rate limit remaining: 4999/5000
```

❌ **Failure:**
```
❌ No GitHub token found
```
→ Sign in again to store the token

```
❌ GitHub API Error: 401 Unauthorized
Token is invalid or expired
```
→ Token is bad, sign in again

## Manual Console Test

Open DevTools in your Electron app and run:

```javascript
// Check if token exists
await window.electronAPI.hasGitHubToken()
// Should return: true

// Get the token
const token = await window.electronAPI.getGitHubToken()
console.log('Token:', token.substring(0, 10) + '...')
// Should show: gho_...

// Test GitHub API
const response = await fetch('https://api.github.com/user', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json'
  }
})
const data = await response.json()
console.log('GitHub user:', data.login)
// Should show your GitHub username
```

## Debugging the Visualization Modal

The issue is that the modal isn't calling `fetchGitHubBranches` when you have local data. Here's what's happening:

1. ✅ Token is stored correctly
2. ✅ Token can be retrieved
3. ❌ Modal only calls GitHub API when there's NO local data
4. ❌ When you have local repos, it skips GitHub API entirely

### The Fix

The modal needs to:
1. Fetch local Git data for the "Local" tab
2. **ALSO** fetch GitHub data for the "Remote" tab
3. Keep them separate

Currently it's doing either/or, not both.

## Quick Fix for Testing

Add this to your DevTools console while viewing the modal:

```javascript
// Force fetch GitHub data
const project = {
  repositories: [{
    url: 'https://github.com/YOUR_USERNAME/YOUR_REPO'
  }]
};

const owner = 'YOUR_USERNAME';
const repo = 'YOUR_REPO';

const token = await window.electronAPI.getGitHubToken();

const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json'
  }
});

const branches = await response.json();
console.log('GitHub branches:', branches);
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with actual values from your project.

## What's Working

✅ GitHub token is stored in keychain  
✅ Token can be retrieved via `window.electronAPI.getGitHubToken()`  
✅ Token is valid (40 characters, starts with `gho_`)  
✅ Authentication flow works  

## What Needs Fixing

❌ RepoVisualizationModal doesn't call GitHub API when local data exists  
❌ Remote tab shows "DISCONNECTED" even though token is available  

## The Solution

The modal needs to be updated to:
1. Always try to fetch GitHub data (not just when local data is missing)
2. Store GitHub data separately from local data
3. Show GitHub data in the Remote tab
4. Show local data in the Local tab

I've added the `githubDataSource` state to track this separately, but the fetch logic needs to be updated to always call `fetchGitHubBranches` regardless of whether local data exists.
