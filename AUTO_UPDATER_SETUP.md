# Auto-Updater Setup Guide for Colabify

This guide explains how to use the auto-updater system that has been implemented for your Colabify Electron application.

## ✅ Features Implemented

- **Auto-updater Service**: Main process service using `electron-updater`
- **Update Notification UI**: Bottom-right corner notification with modern design
- **IPC Communication**: Secure communication between main and renderer processes
- **Download Progress**: Real-time download progress with visual indicator
- **Install & Restart**: One-click installation and restart functionality
- **Error Handling**: Graceful error handling with retry options

## 📁 Files Created/Modified

### Created Files
1. `electron/services/AutoUpdaterService.js` - Main auto-updater service
2. `src/components/ui/UpdateNotification.tsx` - React notification component
3. `public/update-notification.js` - Standalone vanilla JS notification (alternative)

### Modified Files
1. `electron/main.js` - Auto-updater initialization and IPC handlers
2. `electron/preload.js` - Update API exposure to renderer
3. `src/app/layout.tsx` - UpdateNotification component integration
4. `package.json` - electron-updater dependency and build configuration

## 🚀 Setup Instructions

### 1. Configure GitHub Repository

Update the `publish` configuration in `package.json` with your actual GitHub repository details:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",
  "repo": "electron-colabify"
}
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

### 2. Create a GitHub Token (for Publishing)

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` scope
3. Set as environment variable:
   ```bash
   # Windows
   set GH_TOKEN=your_token_here

   # macOS/Linux
   export GH_TOKEN=your_token_here
   ```

### 3. Build and Publish Updates

To create and publish an update:

#### Step 1: Update Version
```bash
# In package.json, update the version:
"version": "1.0.1"
```

#### Step 2: Build the Application
```bash
npm run dist
```

This will create distributable files in the `dist-electron/` directory:
- Windows: `Colabify Setup.exe`, `latest.yml`, `*.blockmap`
- macOS: `Colabify.dmg`, `Colabify-mac.zip`, `latest-mac.yml`
- Linux: `Colabify.AppImage`, `Colabify.deb`, `latest-linux.yml`

#### Step 3: Create GitHub Release

**Option A: Manual Release**
1. Go to your GitHub repository
2. Click "Releases" → "Draft a new release"
3. Create tag: `v1.0.1` (must match package.json version with `v` prefix)
4. Upload the files from `dist-electron/`:
   - The installer (e.g., `Colabify Setup.exe`)
   - The `latest*.yml` file
   - The `.blockmap` file (for delta updates)
5. Publish the release

**Option B: Automated Release (with GitHub Token)**
```bash
npm run dist -- --publish always
```

## 🔄 How It Works

### User Experience Flow

1. **Automatic Check**: App checks for updates on startup and every 6 hours
2. **Notification**: When an update is available, a notification appears in the bottom-right corner
3. **Download**: User clicks "Download" to start downloading the update
4. **Progress**: Real-time progress bar shows download status
5. **Install**: When download completes, user clicks "Restart & Install" to apply the update

### Technical Flow

```
App Launch
    ↓
Auto-updater Service Initializes
    ↓
Check for Updates (after 5 seconds)
    ↓
Update Available? ────→ No → Continue Normally
    ↓ Yes
Send Event to Renderer
    ↓
UpdateNotification Component Shows
    ↓
User Clicks "Download"
    ↓
Download with Progress Events
    ↓
UpdateNotification Shows Progress Bar
    ↓
Download Complete
    ↓
UpdateNotification Shows "Restart & Install"
    ↓
User Clicks "Restart & Install"
    ↓
App Quits and Installs Update
    ↓
App Restarts with New Version
```

### IPC Communication

**Main Process → Renderer Process:**
- `updater:update-checking` - Checking for updates
- `updater:update-available` - Update is available
- `updater:update-not-available` - No update available
- `updater:update-download-progress` - Download progress
- `updater:update-downloaded` - Download complete
- `updater:update-error` - Error occurred

**Renderer Process → Main Process:**
- `updater:check-for-updates` - Manually check for updates
- `updater:download-update` - Start downloading update
- `updater:quit-and-install` - Quit and install update

## ⚙️ Configuration Options

### Auto-Update Settings

Located in `electron/services/AutoUpdaterService.js`:

```javascript
// Disable auto-download (user must click download)
autoUpdater.autoDownload = false;

// Auto-install on app quit
autoUpdater.autoInstallOnAppQuit = true;

// Check interval: 6 hours
this.updateCheckInterval = 6 * 60 * 60 * 1000;

// Initial check delay: 5 seconds after startup
setTimeout(() => { this.checkForUpdates(); }, 5000);
```

### UI Customization

The UpdateNotification component can be customized in:
- `src/components/ui/UpdateNotification.tsx` (React/Next.js version)
- `public/update-notification.js` (Standalone vanilla JS version)

## 🧪 Testing the Auto-Updater

### Local Testing

1. **Build Current Version**
   ```bash
   npm run dist
   ```

2. **Install the Built App**
   - Install from `dist-electron/Colabify Setup.exe` (Windows)

3. **Update package.json Version**
   ```json
   "version": "1.0.1"
   ```

4. **Build New Version**
   ```bash
   npm run dist
   ```

5. **Create GitHub Release**
   - Create release `v1.0.1`
   - Upload new build files

6. **Run Installed App**
   - The app should detect the update
   - Test the download and installation flow

### Testing in Development

The auto-updater is **disabled** in development mode to prevent accidental updates during development. To test:

1. Build and install a production version
2. Create a new release with a higher version
3. Run the installed production app

## 🔒 Security Considerations

1. **Code Signing**: For production, sign your executables
   - Windows: Requires code signing certificate
   - macOS: Requires Apple Developer account

2. **HTTPS**: Updates are served over HTTPS from GitHub

3. **Verification**: electron-updater verifies update integrity using checksums

4. **Permissions**: NSIS installer requests admin permissions when needed

## 🐛 Troubleshooting

### No Updates Detected
- Verify GitHub repository settings in `package.json`
- Check release visibility (must be public)
- Verify version number format (must use semantic versioning)
- Check console logs for errors

### Download Fails
- Verify internet connection
- Check GitHub API rate limits
- Verify release files are properly uploaded

### Install Fails
- Ensure app has proper permissions
- Check if antivirus is blocking the installer
- Verify file integrity

### Version Mismatch
- Ensure `package.json` version matches GitHub release tag
- Release tag must be in format `vX.Y.Z` (with `v` prefix)

## 📊 Monitoring Updates

Check the Electron console for auto-updater logs:
- `🔍 Checking for updates...`
- `✅ Update available: X.Y.Z`
- `📥 Download progress: X%`
- `✅ Update downloaded: X.Y.Z`
- `🔄 Quitting and installing update...`

## 🚫 Development vs Production

- **Development**: Auto-updater is **disabled** when `NODE_ENV=development` or app is not packaged
- **Production**: Auto-updater is **active** and checks for updates automatically

## 📝 Build Configuration

The `package.json` includes the following build configuration:

```json
{
  "build": {
    "appId": "com.colabify.app",
    "productName": "Colabify",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "electron/**/*",
      "out/**/*",
      "build/**/*",
      "public/**/*",
      "package.json"
    ],
    "publish": {
      "provider": "github",
      "owner": "YOUR_GITHUB_USERNAME",
      "repo": "electron-colabify"
    }
  }
}
```

## 🎯 Next Steps

1. ✅ Set up GitHub repository with proper publish configuration
2. ✅ Test the update flow with a higher version number
3. 🔲 Configure code signing for production releases
4. 🔲 Set up automated builds with GitHub Actions (optional)
5. 🔲 Monitor update adoption through analytics (optional)

## 📚 Additional Resources

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [electron-builder Documentation](https://www.electron.build/)
- [Electron Code Signing Guide](https://www.electron.build/code-signing)

---

The auto-updater system is now fully integrated and ready to use! Your users will receive seamless updates with a beautiful notification interface. 🚀
