const { autoUpdater } = require('electron-updater');
const { app } = require('electron');

/**
 * AutoUpdaterService - Manages application auto-updates
 *
 * Features:
 * - Checks for updates on startup and periodically
 * - Downloads updates in the background
 * - Notifies renderer process of update events
 * - Handles update installation on app quit
 */
class AutoUpdaterService {
  constructor() {
    this.mainWindow = null;
    this.updateCheckInterval = null;
    this.isInitialized = false;

    // Configure auto-updater
    this.configureAutoUpdater();
  }

  /**
   * Configure auto-updater settings
   */
  configureAutoUpdater() {
    // Disable auto-download (user must click download button)
    autoUpdater.autoDownload = false;

    // Auto-install on app quit
    autoUpdater.autoInstallOnAppQuit = true;

    // Disable signature verification for unsigned apps
    autoUpdater.disableWebInstaller = false;
    autoUpdater.allowDowngrade = false;
    
    // For macOS: disable signature verification and handle unsigned apps
    if (process.platform === 'darwin') {
      process.env.ELECTRON_IS_DEV = '0'; // Ensure we're not in dev mode for updater
      autoUpdater.allowPrerelease = false;
      
      // Set updater logger for debugging
      autoUpdater.logger = console;
    }
    
    // Handle unsigned app updates by disabling signature verification
    process.env.ELECTRON_UPDATER_ALLOW_UNSIGNED = '1';

    // Log all events in development
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.forceDevUpdateConfig = true;
      console.log('🔧 Auto-updater: Development mode enabled');
    }

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup auto-updater event listeners
   */
  setupEventListeners() {
    // Checking for update
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Auto-updater: Checking for updates...');
      this.sendToRenderer('update-checking');
    });

    // Update available
    autoUpdater.on('update-available', (info) => {
      console.log('✅ Auto-updater: Update available:', info.version);
      this.sendToRenderer('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    });

    // No update available
    autoUpdater.on('update-not-available', (info) => {
      console.log('ℹ️ Auto-updater: No updates available (current version:', info.version + ')');
      this.sendToRenderer('update-not-available', {
        version: info.version
      });
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      console.log(`📥 Auto-updater: Download progress - ${Math.round(progressObj.percent)}%`);
      this.sendToRenderer('update-download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      console.log('✅ Auto-updater: Update downloaded:', info.version);
      this.sendToRenderer('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    });

    // Error occurred
    autoUpdater.on('error', (error) => {
      console.error('❌ Auto-updater: Error:', error);
      this.sendToRenderer('update-error', {
        message: error.message || 'Unknown error occurred'
      });
    });
  }

  /**
   * Initialize the auto-updater service
   * @param {BrowserWindow} mainWindow - The main application window
   */
  async initialize(mainWindow) {
    if (this.isInitialized) {
      console.log('⚠️ Auto-updater: Already initialized');
      return;
    }

    this.mainWindow = mainWindow;
    this.isInitialized = true;

    // Don't check for updates in development or if not packaged
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      console.log('ℹ️ Auto-updater: Disabled in development/unpackaged mode');
      return;
    }

    console.log('🚀 Auto-updater: Initialized');

    // Check for updates on startup (after a short delay)
    setTimeout(() => {
      this.checkForUpdates();
    }, 5000);

    // Check for updates every 6 hours
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, 6 * 60 * 60 * 1000); // 6 hours
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates() {
    try {
      console.log('🔍 Auto-updater: Manual check for updates');
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('❌ Auto-updater: Error checking for updates:', error);
    }
  }

  /**
   * Download the available update
   */
  async downloadUpdate() {
    try {
      console.log('📥 Auto-updater: Starting update download');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('❌ Auto-updater: Error downloading update:', error);
      this.sendToRenderer('update-error', {
        message: error.message || 'Failed to download update'
      });
    }
  }

  /**
   * Install the downloaded update and restart the app
   */
  quitAndInstall() {
    try {
      console.log('🔄 Auto-updater: Quitting and installing update');
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      console.error('❌ Auto-updater: Error installing update:', error);
    }
  }

  /**
   * Send update event to renderer process
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  sendToRenderer(event, data = {}) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`updater:${event}`, data);
    }
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
    console.log('🧹 Auto-updater: Cleanup complete');
  }
}

module.exports = AutoUpdaterService;
