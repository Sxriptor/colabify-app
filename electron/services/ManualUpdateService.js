const { shell } = require('electron');
const fetch = globalThis.fetch;

/**
 * ManualUpdateService - Checks for updates and directs users to manual download
 * Only affects macOS builds due to code signing issues
 */
class ManualUpdateService {
  constructor() {
    this.mainWindow = null;
    this.updateCheckInterval = null;
    this.isInitialized = false;
    this.currentVersion = require('../../package.json').version;
  }

  /**
   * Initialize the manual update service
   * @param {BrowserWindow} mainWindow - The main application window
   */
  async initialize(mainWindow) {
    if (this.isInitialized) {
      console.log('⚠️ Manual Update Service: Already initialized');
      return;
    }

    this.mainWindow = mainWindow;
    this.isInitialized = true;

    // Only enable on macOS (due to code signing issues)
    if (process.platform !== 'darwin') {
      console.log('ℹ️ Manual Update Service: Disabled on non-macOS platforms');
      return;
    }

    // Don't check for updates in development
    if (process.env.NODE_ENV === 'development') {
      console.log('ℹ️ Manual Update Service: Disabled in development mode');
      return;
    }

    console.log('🚀 Manual Update Service: Initialized for macOS');

    // Check for updates on startup (after a short delay)
    setTimeout(() => {
      this.checkForUpdates();
    }, 10000); // 10 seconds delay

    // Check for updates every 24 hours
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Check for updates by comparing with GitHub releases
   */
  async checkForUpdates() {
    try {
      console.log('🔍 Manual Update Service: Checking for updates...');
      
      const response = await fetch('https://api.github.com/repos/Sxriptor/colabify-app/releases/latest');
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
      
      console.log(`📋 Current version: ${this.currentVersion}`);
      console.log(`📋 Latest version: ${latestVersion}`);

      if (this.isNewerVersion(latestVersion, this.currentVersion)) {
        console.log('✅ New version available!');
        this.showUpdateNotification(latestVersion, release.body || '');
      } else {
        console.log('ℹ️ No updates available');
      }
    } catch (error) {
      console.error('❌ Manual Update Service: Error checking for updates:', error);
    }
  }

  /**
   * Compare version strings to determine if update is available
   * @param {string} latest - Latest version string
   * @param {string} current - Current version string
   * @returns {boolean} True if latest is newer than current
   */
  isNewerVersion(latest, current) {
    const parseVersion = (version) => {
      return version.split('.').map(num => parseInt(num, 10));
    };

    const latestParts = parseVersion(latest);
    const currentParts = parseVersion(current);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;

      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }

    return false;
  }

  /**
   * Show update notification to user
   * @param {string} version - New version number
   * @param {string} releaseNotes - Release notes
   */
  showUpdateNotification(version, releaseNotes) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('manual-update-available', {
        version,
        releaseNotes,
        downloadUrl: 'https://github.com/Sxriptor/colabify-app/releases/latest/download/colabify-setup.dmg',
        currentVersion: this.currentVersion
      });
    }
  }

  /**
   * Open download URL in browser
   */
  openDownloadPage() {
    shell.openExternal('https://github.com/Sxriptor/colabify-app/releases/latest/download/colabify-setup.dmg');
  }

  /**
   * Cleanup on app quit
   */
  cleanup() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    this.isInitialized = false;
    console.log('🧹 Manual Update Service: Cleanup complete');
  }
}

module.exports = ManualUpdateService;