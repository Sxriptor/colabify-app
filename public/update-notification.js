/**
 * UpdateNotification - UI component for displaying update notifications
 *
 * This is a standalone component that integrates with the auto-updater system.
 * It displays notifications for available updates, download progress, and provides
 * buttons for downloading and installing updates.
 */

class UpdateNotificationManager {
  constructor() {
    this.container = null;
    this.currentState = 'idle'; // idle, checking, available, downloading, ready
    this.downloadProgress = 0;
    this.updateInfo = null;
  }

  /**
   * Initialize the update notification manager
   */
  initialize() {
    // Create the notification container
    this.createContainer();

    // Setup IPC listeners for update events
    this.setupListeners();

    console.log('✅ Update notification manager initialized');
  }

  /**
   * Create the notification container element
   */
  createContainer() {
    // Remove existing container if present
    const existing = document.getElementById('update-notification');
    if (existing) {
      existing.remove();
    }

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'update-notification';
    this.container.className = 'update-notification hidden';

    // Add to body
    document.body.appendChild(this.container);

    // Add styles
    this.injectStyles();
  }

  /**
   * Inject CSS styles for the notification
   */
  injectStyles() {
    // Check if styles already exist
    if (document.getElementById('update-notification-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'update-notification-styles';
    style.textContent = `
      .update-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 360px;
        max-width: calc(100vw - 40px);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        padding: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform: translateY(0);
        opacity: 1;
      }

      .update-notification.hidden {
        transform: translateY(20px);
        opacity: 0;
        pointer-events: none;
      }

      .update-notification-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .update-notification-title {
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .update-notification-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        cursor: pointer;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 18px;
        line-height: 1;
        transition: background 0.2s;
      }

      .update-notification-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .update-notification-body {
        margin-bottom: 16px;
        font-size: 14px;
        line-height: 1.5;
        opacity: 0.95;
      }

      .update-notification-version {
        font-weight: 600;
        margin-bottom: 4px;
      }

      .update-notification-progress {
        margin-top: 12px;
      }

      .update-notification-progress-bar {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .update-notification-progress-fill {
        height: 100%;
        background: white;
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .update-notification-progress-text {
        font-size: 12px;
        opacity: 0.9;
        text-align: center;
      }

      .update-notification-actions {
        display: flex;
        gap: 10px;
      }

      .update-notification-button {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .update-notification-button-primary {
        background: white;
        color: #667eea;
      }

      .update-notification-button-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
      }

      .update-notification-button-secondary {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }

      .update-notification-button-secondary:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .update-notification-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      @media (max-width: 480px) {
        .update-notification {
          bottom: 10px;
          right: 10px;
          width: calc(100vw - 20px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup IPC listeners for update events
   */
  setupListeners() {
    if (!window.electronAPI) {
      console.warn('⚠️ electronAPI not available, update notifications disabled');
      return;
    }

    // Listen for update events
    window.electronAPI.onUpdateEvent((event, data) => {
      console.log('🔄 Update event received:', event, data);

      switch (event) {
        case 'checking':
          this.handleChecking();
          break;
        case 'available':
          this.handleUpdateAvailable(data);
          break;
        case 'not-available':
          this.handleUpdateNotAvailable();
          break;
        case 'download-progress':
          this.handleDownloadProgress(data);
          break;
        case 'downloaded':
          this.handleUpdateDownloaded(data);
          break;
        case 'error':
          this.handleError(data);
          break;
      }
    });
  }

  /**
   * Handle checking for updates
   */
  handleChecking() {
    console.log('🔍 Checking for updates...');
    this.currentState = 'checking';
    // Don't show notification for checking state
  }

  /**
   * Handle update available
   */
  handleUpdateAvailable(data) {
    console.log('✅ Update available:', data);
    this.currentState = 'available';
    this.updateInfo = data;
    this.show('available');
  }

  /**
   * Handle no update available
   */
  handleUpdateNotAvailable() {
    console.log('ℹ️ No updates available');
    this.currentState = 'idle';
    this.hide();
  }

  /**
   * Handle download progress
   */
  handleDownloadProgress(data) {
    console.log('📥 Download progress:', Math.round(data.percent) + '%');
    this.currentState = 'downloading';
    this.downloadProgress = data.percent;
    this.show('downloading');
  }

  /**
   * Handle update downloaded
   */
  handleUpdateDownloaded(data) {
    console.log('✅ Update downloaded:', data);
    this.currentState = 'ready';
    this.updateInfo = data;
    this.show('ready');
  }

  /**
   * Handle error
   */
  handleError(data) {
    console.error('❌ Update error:', data);
    this.currentState = 'idle';
    this.show('error', data.message);
  }

  /**
   * Show the notification
   */
  show(state, errorMessage = null) {
    if (!this.container) return;

    let content = '';

    switch (state) {
      case 'available':
        content = this.getAvailableContent();
        break;
      case 'downloading':
        content = this.getDownloadingContent();
        break;
      case 'ready':
        content = this.getReadyContent();
        break;
      case 'error':
        content = this.getErrorContent(errorMessage);
        break;
    }

    this.container.innerHTML = content;
    this.container.classList.remove('hidden');

    // Add event listeners
    this.attachEventListeners();
  }

  /**
   * Hide the notification
   */
  hide() {
    if (!this.container) return;
    this.container.classList.add('hidden');
  }

  /**
   * Get content for update available state
   */
  getAvailableContent() {
    return `
      <div class="update-notification-header">
        <div class="update-notification-title">
          🚀 Update Available
        </div>
        <button class="update-notification-close" data-action="close">×</button>
      </div>
      <div class="update-notification-body">
        <div class="update-notification-version">
          Version ${this.updateInfo?.version || 'Unknown'}
        </div>
        <div>A new version of Colabify is available!</div>
      </div>
      <div class="update-notification-actions">
        <button class="update-notification-button update-notification-button-secondary" data-action="later">
          Later
        </button>
        <button class="update-notification-button update-notification-button-primary" data-action="download">
          Download
        </button>
      </div>
    `;
  }

  /**
   * Get content for downloading state
   */
  getDownloadingContent() {
    const percent = Math.round(this.downloadProgress);
    return `
      <div class="update-notification-header">
        <div class="update-notification-title">
          📥 Downloading Update
        </div>
        <button class="update-notification-close" data-action="close">×</button>
      </div>
      <div class="update-notification-body">
        <div>Downloading update...</div>
        <div class="update-notification-progress">
          <div class="update-notification-progress-bar">
            <div class="update-notification-progress-fill" style="width: ${percent}%"></div>
          </div>
          <div class="update-notification-progress-text">${percent}%</div>
        </div>
      </div>
    `;
  }

  /**
   * Get content for ready state
   */
  getReadyContent() {
    return `
      <div class="update-notification-header">
        <div class="update-notification-title">
          ✅ Update Ready
        </div>
        <button class="update-notification-close" data-action="close">×</button>
      </div>
      <div class="update-notification-body">
        <div class="update-notification-version">
          Version ${this.updateInfo?.version || 'Unknown'}
        </div>
        <div>Update has been downloaded and is ready to install.</div>
      </div>
      <div class="update-notification-actions">
        <button class="update-notification-button update-notification-button-secondary" data-action="later">
          Later
        </button>
        <button class="update-notification-button update-notification-button-primary" data-action="install">
          Restart & Install
        </button>
      </div>
    `;
  }

  /**
   * Get content for error state
   */
  getErrorContent(message) {
    return `
      <div class="update-notification-header">
        <div class="update-notification-title">
          ❌ Update Error
        </div>
        <button class="update-notification-close" data-action="close">×</button>
      </div>
      <div class="update-notification-body">
        <div>${message || 'An error occurred while checking for updates.'}</div>
      </div>
      <div class="update-notification-actions">
        <button class="update-notification-button update-notification-button-primary" data-action="close">
          OK
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners to buttons
   */
  attachEventListeners() {
    const buttons = this.container.querySelectorAll('[data-action]');
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        this.handleAction(action);
      });
    });
  }

  /**
   * Handle button actions
   */
  async handleAction(action) {
    switch (action) {
      case 'close':
      case 'later':
        this.hide();
        break;
      case 'download':
        await this.downloadUpdate();
        break;
      case 'install':
        await this.installUpdate();
        break;
    }
  }

  /**
   * Download the update
   */
  async downloadUpdate() {
    if (!window.electronAPI?.downloadUpdate) {
      console.error('❌ downloadUpdate API not available');
      return;
    }

    try {
      const result = await window.electronAPI.downloadUpdate();
      if (!result.success) {
        console.error('❌ Failed to start download:', result.error);
      }
    } catch (error) {
      console.error('❌ Error downloading update:', error);
    }
  }

  /**
   * Install the update
   */
  async installUpdate() {
    if (!window.electronAPI?.quitAndInstall) {
      console.error('❌ quitAndInstall API not available');
      return;
    }

    try {
      await window.electronAPI.quitAndInstall();
    } catch (error) {
      console.error('❌ Error installing update:', error);
    }
  }

  /**
   * Manually check for updates
   */
  async checkForUpdates() {
    if (!window.electronAPI?.checkForUpdates) {
      console.error('❌ checkForUpdates API not available');
      return;
    }

    try {
      const result = await window.electronAPI.checkForUpdates();
      if (!result.success) {
        console.error('❌ Failed to check for updates:', result.error);
      }
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateNotificationManager;
}
