const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Debug: Check if Supabase credentials are loaded
console.log('🔧 Environment check:');
console.log('  SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('  SUPABASE_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Loaded' : '❌ Missing');

const { app, BrowserWindow, Notification, ipcMain, shell, dialog } = require('electron');
const AuthManager = require('./services/AuthManager');
const isDev = process.env.NODE_ENV === 'development';

// Use built-in fetch (Node.js 18+)
const fetch = globalThis.fetch;

// Initialize AuthManager
const authManager = new AuthManager();

// Initialize Auto-updater Service
const AutoUpdaterService = require('./services/AutoUpdaterService');
const autoUpdaterService = new AutoUpdaterService();

let mainWindow;

// Register IPC handlers early
console.log('🔧 Registering IPC handlers...');

// File system operations
ipcMain.handle('fs:select-folder', async () => {
  try {
    console.log('📁 Folder selection requested');
    
    if (!mainWindow) {
      console.error('❌ No main window available for dialog');
      return { success: false, error: 'No main window available' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Repository Folder',
      buttonLabel: 'Select Folder'
    });

    console.log('📁 Dialog result:', result);

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { 
      success: true, 
      folderPath: result.filePaths[0],
      canceled: false 
    };
  } catch (error) {
    console.error('❌ Error selecting folder:', error);
    return { 
      success: false, 
      error: error.message,
      canceled: false 
    };
  }
});

// Test IPC handler for debugging
ipcMain.handle('test:folder-selection', async () => {
  console.log('🧪 Test folder selection handler called');
  return { success: true, message: 'Handler is working' };
});

console.log('✅ Early IPC handlers registered');

// No protocol registration needed - using external browser with local callback server

async function createWindow() {
  // Use platform-specific icons for best quality
  // Windows ALWAYS needs .ico for crisp taskbar/window icons (even in dev)
  // Mac uses .icns, Linux uses PNG
  const getIconPath = () => {
    if (process.platform === 'win32') {
      // Always use .ico on Windows for best quality
      return path.join(__dirname, '../build/icon.ico');
    } else if (process.platform === 'darwin') {
      return isDev 
        ? path.join(__dirname, '../public/icons/colabify.png')
        : path.join(__dirname, '../build/icon.icns');
    } else {
      return path.join(__dirname, '../public/icons/colabify.png');
    }
  };
  
  const iconPath = getIconPath();
    
  console.log('🎨 Icon configuration:');
  console.log('  Platform:', process.platform);
  console.log('  Development mode:', isDev);
  console.log('  Icon path:', iconPath);
  console.log('  Icon exists:', require('fs').existsSync(iconPath));
    
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath, // Platform-specific icon (Windows uses .ico for best quality)
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#ffffff'
  });

  // Load the Next.js app
  let url;
  if (isDev) {
    // In development, connect to Next.js dev server
    url = 'http://localhost:3000';
  } else {
    // In production, run the Next.js standalone server
    const path = require('path');
    const fs = require('fs');
    const { spawn } = require('child_process');
    
    console.log('🚀 Starting Next.js standalone server...');
    
    // Path to the standalone server
    const serverPath = path.join(__dirname, '../.next/standalone/server.js');
    const standalonePath = path.join(__dirname, '../.next/standalone');
    const staticPath = path.join(__dirname, '../.next/static');
    
    console.log('📁 Checking paths:');
    console.log('  Server path:', serverPath);
    console.log('  Server exists:', fs.existsSync(serverPath));
    console.log('  Standalone path:', standalonePath);
    console.log('  Standalone exists:', fs.existsSync(standalonePath));
    console.log('  Static path:', staticPath);
    console.log('  Static exists:', fs.existsSync(staticPath));
    
    if (!fs.existsSync(serverPath)) {
      console.error('❌ Next.js server not found at:', serverPath);
      console.error('❌ Available files in .next:', fs.existsSync(path.join(__dirname, '../.next')) ? fs.readdirSync(path.join(__dirname, '../.next')) : 'No .next folder');
      
      // Fallback: try to load a simple error page
      url = `data:text/html,<html><body><h1>Error: Next.js server not found</h1><p>Please rebuild the application with: npm run build</p></body></html>`;
    } else {
      try {
        // Copy static folder to standalone if needed
        const standaloneStaticPath = path.join(standalonePath, '.next/static');
        if (!fs.existsSync(standaloneStaticPath) && fs.existsSync(staticPath)) {
          console.log('📦 Copying static files to standalone folder...');
          const standaloneNextPath = path.join(standalonePath, '.next');
          if (!fs.existsSync(standaloneNextPath)) {
            fs.mkdirSync(standaloneNextPath, { recursive: true });
          }
          fs.cpSync(staticPath, standaloneStaticPath, { recursive: true });
          console.log('✅ Static files copied');
        }
        
        // Copy public folder to standalone if needed
        const publicPath = path.join(__dirname, '../public');
        const standalonePublicPath = path.join(standalonePath, 'public');
        if (!fs.existsSync(standalonePublicPath) && fs.existsSync(publicPath)) {
          console.log('📦 Copying public files to standalone folder...');
          fs.cpSync(publicPath, standalonePublicPath, { recursive: true });
          console.log('✅ Public files copied');
        }
        
        // Start the Next.js server as a child process
        const nextServer = spawn('node', [serverPath], {
          cwd: standalonePath,
          env: {
            ...process.env,
            PORT: '3000',
            HOSTNAME: 'localhost',
          },
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        nextServer.stdout.on('data', (data) => {
          console.log('Next.js:', data.toString().trim());
        });
        
        nextServer.stderr.on('data', (data) => {
          console.error('Next.js Error:', data.toString().trim());
        });
        
        nextServer.on('error', (error) => {
          console.error('❌ Failed to start Next.js server:', error);
        });
        
        nextServer.on('exit', (code, signal) => {
          console.log(`Next.js server exited with code ${code} and signal ${signal}`);
        });
        
        // Store the server process so we can kill it on app quit
        global.nextServerProcess = nextServer;
        
        // Give the server a moment to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        url = 'http://localhost:3000';
        console.log('✅ Next.js standalone server started');
      } catch (error) {
        console.error('❌ Failed to start Next.js server:', error);
        url = `data:text/html,<html><body><h1>Error: Failed to start server</h1><p>${error.message}</p></body></html>`;
      }
    }
  }
  
  mainWindow.loadURL(url);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Initialize Git monitoring backend after window is ready
    initializeGitMonitoring(mainWindow);

    // Initialize auto-updater after window is ready
    autoUpdaterService.initialize(mainWindow);
  });

  // Prevent navigation to external URLs (for OAuth flow)
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // Allow navigation within the app (always localhost:3000 since we need API routes)
    if (parsedUrl.origin !== 'http://localhost:3000') {
      event.preventDefault();
      console.log('Blocked navigation to:', navigationUrl);
    }
  });

  // Prevent new windows from opening (this catches OAuth popups)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Block all new windows - OAuth should open in external browser via our IPC handler
    console.log('Blocked window.open to:', url);
    return { action: 'deny' };
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Test IPC communication after window loads
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('🔍 Main: Window finished loading, testing IPC...');
    setTimeout(() => {
      mainWindow.webContents.send('test-event', { message: 'IPC test from main process' });
      console.log('📤 Main: Sent test-event');
    }, 1000);
  });
}

// Handle notification requests from renderer
ipcMain.handle('show-notification', async (event, { title, body, icon }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title || 'Colabify',
      body: body || '',
      icon: icon ? path.join(__dirname, '../public', icon) : path.join(__dirname, '../public/icons/colabify.png')
    });

    notification.show();

    return { success: true };
  }
  return { success: false, error: 'Notifications not supported' };
});

// Request notification permissions
ipcMain.handle('request-notification-permission', async () => {
  // Electron doesn't require explicit permission like browsers
  return Notification.isSupported() ? 'granted' : 'denied';
});

// Open URL in external browser
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open URL:', error);
    return { success: false, error: error.message };
  }
});

// Auth management IPC handlers
ipcMain.handle('auth:start-sign-in', async () => {
  try {
    console.log('🚀 Starting external sign-in process...');
    console.log('📋 Current window state:', {
      hasMainWindow: !!mainWindow,
      isDestroyed: mainWindow ? mainWindow.isDestroyed() : 'N/A',
      isVisible: mainWindow ? mainWindow.isVisible() : 'N/A'
    });

    const authResult = await authManager.beginExternalSignIn();

    console.log('✅ Authentication successful:', authResult.user?.email || 'no email');
    console.log('📦 Auth result keys:', Object.keys(authResult));
    console.log('📦 Full auth result:', JSON.stringify(authResult, null, 2));

    // Notify renderer process of successful authentication
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('📤 Sending auth-success event to renderer...');
      const eventData = {
        user: authResult.user,
        subscriptionStatus: authResult.subscriptionStatus,
        githubToken: authResult.githubToken // Pass GitHub token to renderer for immediate use
      };
      console.log('📦 Event data (GitHub token hidden):', {
        ...eventData,
        githubToken: eventData.githubToken ? '***' : undefined
      });

      mainWindow.webContents.send('auth-success', eventData);
      console.log('✅ Event sent successfully');

      // Reload the window to pick up the new auth state
      console.log('🔄 Reloading window to apply auth state...');
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reload();
        }
      }, 500);
    } else {
      console.error('⚠️ mainWindow is null or destroyed, cannot send event');
    }

    return { success: true, user: authResult.user };
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    console.error('❌ Error stack:', error.stack);

    // Notify renderer process of auth error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth-error', error.message);
    }

    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:get-user', async () => {
  try {
    const user = await authManager.getCurrentUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
});

ipcMain.handle('auth:is-authenticated', async () => {
  return await authManager.isAuthenticated();
});

ipcMain.handle('auth:get-token', async () => {
  try {
    const stored = await authManager.getStoredToken();
    return stored?.token || null;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
});

ipcMain.handle('auth:logout', async () => {
  try {
    await authManager.signOut();
    
    // Notify renderer process
    if (mainWindow) {
      mainWindow.webContents.send('auth-signed-out');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error during logout:', error);
    return { success: false, error: error.message };
  }
});

// GitHub token management
ipcMain.handle('auth:get-github-token', async () => {
  try {
    // First try to get user-provided PAT
    const userPAT = await authManager.getUserProvidedPAT();
    if (userPAT) {
      console.log('✅ Using user-provided PAT');
      return userPAT;
    }

    // Fall back to OAuth token
    const token = await authManager.getStoredGitHubToken();
    if (token) {
      console.log('✅ Using OAuth token');
    }
    return token;
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return null;
  }
});

ipcMain.handle('auth:has-github-token', async () => {
  try {
    return await authManager.hasGitHubToken();
  } catch (error) {
    console.error('Error checking GitHub token:', error);
    return false;
  }
});

// User-provided PAT management
ipcMain.handle('auth:save-github-token', async (event, token) => {
  try {
    console.log('💾 Saving user-provided GitHub PAT...');
    await authManager.saveUserProvidedPAT(token);
    console.log('✅ PAT saved successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error saving PAT:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:remove-github-token', async () => {
  try {
    console.log('🗑️ Removing user-provided GitHub PAT...');
    await authManager.removeUserProvidedPAT();
    console.log('✅ PAT removed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error removing PAT:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:has-user-pat', async () => {
  try {
    return await authManager.hasUserProvidedPAT();
  } catch (error) {
    console.error('Error checking user PAT:', error);
    return false;
  }
});

// Make authenticated API calls
ipcMain.handle('api:call', async (event, endpoint, options = {}) => {
  try {
    return await authManager.makeAuthenticatedRequest(endpoint, options);
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
});

// Setup notification IPC handlers
setupNotificationIPC();

// Setup auto-updater IPC handlers
setupAutoUpdaterIPC();

console.log('✅ All IPC handlers registered');

// Initialize Git monitoring backend
let gitMonitoringBackend;

// Initialize notification system
let notificationService;

// Function to setup notification IPC handlers
function setupNotificationIPC() {
  console.log('🔔 Setting up Notification IPC handlers');

  // Initialize notification service
  ipcMain.handle('notifications:init', async (event, userId, accessToken) => {
    try {
      console.log('🔔 Initializing notification service for user:', userId);
      
      // Get the access token from AuthManager if not provided
      let token = accessToken;
      if (!token) {
        console.log('🔍 No token provided, getting from AuthManager...');
        try {
          const stored = await authManager.getStoredToken();
          token = stored?.token;
          console.log('🔍 Token from AuthManager:', !!token, token ? 'Length: ' + token.length : 'No token');
        } catch (authError) {
          console.error('❌ Failed to get token from AuthManager:', authError);
        }
      }
      
      // Import the notification service
      const { NotificationService } = require('./services/NotificationService');
      
      if (!notificationService) {
        notificationService = new NotificationService();
      }

      // Start polling (this will check if user has app notifications enabled)
      await notificationService.startPolling(userId, token);
      return { success: true, message: 'Notification service started' };
    } catch (error) {
      console.error('Error initializing notification service:', error);
      return { success: false, error: error.message };
    }
  });

  // Stop notification service
  ipcMain.handle('notifications:stop', async () => {
    try {
      console.log('🔔 Stopping notification service');
      
      if (notificationService) {
        notificationService.stopPolling();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error stopping notification service:', error);
      return { success: false, error: error.message };
    }
  });

  // Get user notification preferences
  ipcMain.handle('notifications:getPreferences', async (event, userId) => {
    try {
      if (!notificationService) {
        const { NotificationService } = require('./services/NotificationService');
        notificationService = new NotificationService();
      }

      const preferences = await notificationService.getUserNotificationPreferences(userId);
      return { success: true, preferences };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return { success: false, error: error.message };
    }
  });

  // Update notification service when preferences change
  ipcMain.handle('notifications:updatePreferences', async (event, userId, preferences) => {
    try {
      console.log('🔔 Updating notification preferences for user:', userId);
      
      if (!notificationService) {
        const { NotificationService } = require('./services/NotificationService');
        notificationService = new NotificationService();
      }

      // If app notifications were enabled, start polling
      if (preferences.app === true) {
        notificationService.startPolling(userId);
      } else {
        // If app notifications were disabled, stop polling
        notificationService.stopPolling();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return { success: false, error: error.message };
    }
  });

  // Cleanup on app quit
  ipcMain.handle('notifications:cleanup', async () => {
    try {
      if (notificationService) {
        notificationService.destroy();
        notificationService = null;
      }
      return { success: true };
    } catch (error) {
      console.error('Error cleaning up notification service:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Notification IPC handlers setup complete');
}

// Setup auto-updater IPC handlers
function setupAutoUpdaterIPC() {
  console.log('🔄 Setting up Auto-updater IPC handlers');

  // Check for updates
  ipcMain.handle('updater:check-for-updates', async () => {
    try {
      console.log('🔍 Checking for updates...');
      await autoUpdaterService.checkForUpdates();
      return { success: true };
    } catch (error) {
      console.error('Error checking for updates:', error);
      return { success: false, error: error.message };
    }
  });

  // Download update
  ipcMain.handle('updater:download-update', async () => {
    try {
      console.log('📥 Starting update download...');
      await autoUpdaterService.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('Error downloading update:', error);
      return { success: false, error: error.message };
    }
  });

  // Quit and install
  ipcMain.handle('updater:quit-and-install', async () => {
    try {
      console.log('🔄 Quitting and installing update...');
      autoUpdaterService.quitAndInstall();
      return { success: true };
    } catch (error) {
      console.error('Error installing update:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Auto-updater IPC handlers setup complete');
}

// Function to initialize Git monitoring (called after window is ready)
async function initializeGitMonitoring(mainWindow) {
  console.log('🚀 Starting Git monitoring initialization...');
  
  try {
    console.log('📦 Loading git-monitoring-simple.js (reliable version)...');
    
    // Use the simple, tested version directly
    const simpleGitModule = require('./git-monitoring-simple.js');
    gitMonitoringBackend = simpleGitModule.gitMonitoringBackend;
    
    console.log('✅ Git monitoring backend instance obtained');
    console.log('🔧 Initializing Git monitoring backend...');
    
    await gitMonitoringBackend.initialize(mainWindow);
    console.log('✅ Git monitoring backend initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize Git monitoring backend:', error);
    console.error('❌ Error stack:', error.stack);
    
    // If even the simple version fails, try the complex one as fallback
    try {
      console.log('🔄 Attempting fallback to git-monitoring-backend.js...');
      
      // First, clean up any partially registered handlers
      try {
        const { ipcMain } = require('electron');
        ipcMain.removeHandler('git:watchProject');
        ipcMain.removeHandler('git:listProjectRepos');
        ipcMain.removeHandler('git:getRepoState');
        ipcMain.removeHandler('git:connectRepoToProject');
        console.log('🧹 Cleaned up any existing Git IPC handlers');
      } catch (cleanupError) {
        console.log('ℹ️ No existing handlers to clean up');
      }
      
      const gitModule = require('./git-monitoring-backend.js');
      gitMonitoringBackend = gitModule.gitMonitoringBackend;
      await gitMonitoringBackend.initialize(mainWindow);
      console.log('✅ Complex Git monitoring backend initialized as fallback');
    } catch (fallbackError) {
      console.error('❌ Failed to initialize any Git monitoring backend:', fallbackError);
      console.error('❌ Fallback error stack:', fallbackError.stack);
    }
  }
}

// No protocol testing needed with external browser auth

// Single instance handling (keep window focus behavior)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

// App lifecycle events
app.whenReady().then(async () => {
  // Set dock icon for macOS
  if (process.platform === 'darwin') {
    const dockIconPath = isDev 
      ? path.join(__dirname, '../public/icons/icon.icns')
      : path.join(__dirname, '../build/icon.icns');
    console.log('🎨 Setting dock icon:', dockIconPath);
    console.log('🎨 Dock icon exists:', require('fs').existsSync(dockIconPath));
    
    if (require('fs').existsSync(dockIconPath)) {
      try {
        app.dock.setIcon(dockIconPath);
        console.log('✅ Dock icon set successfully');
      } catch (error) {
        console.log('❌ Failed to set dock icon:', error.message);
        // Fallback to PNG if ICNS fails
        const fallbackIcon = path.join(__dirname, '../public/icons/icon-512x512.png');
        if (require('fs').existsSync(fallbackIcon)) {
          try {
            app.dock.setIcon(fallbackIcon);
            console.log('✅ Fallback PNG dock icon set successfully');
          } catch (fallbackError) {
            console.log('❌ Fallback icon also failed:', fallbackError.message);
          }
        }
      }
    } else {
      console.log('❌ Dock icon file not found');
    }
  }
  
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup Git monitoring backend, notification service, auto-updater, and Next.js server on app quit
app.on('before-quit', async (event) => {
  let needsCleanup = false;

  if (gitMonitoringBackend && gitMonitoringBackend.isInitialized()) {
    needsCleanup = true;
  }

  if (notificationService) {
    needsCleanup = true;
  }

  if (autoUpdaterService) {
    needsCleanup = true;
  }

  if (global.nextServerProcess) {
    needsCleanup = true;
  }

  if (needsCleanup) {
    event.preventDefault();

    try {
      // Cleanup Next.js server
      if (global.nextServerProcess) {
        console.log('🛑 Stopping Next.js server...');
        global.nextServerProcess.kill();
        global.nextServerProcess = null;
      }

      // Cleanup notification service
      if (notificationService) {
        console.log('🔔 Cleaning up notification service...');
        notificationService.destroy();
        notificationService = null;
      }

      // Cleanup Git monitoring
      if (gitMonitoringBackend && gitMonitoringBackend.isInitialized()) {
        console.log('🧹 Cleaning up Git monitoring backend...');
        await gitMonitoringBackend.cleanup();
      }

      // Cleanup auto-updater
      if (autoUpdaterService) {
        console.log('🔄 Cleaning up auto-updater...');
        autoUpdaterService.cleanup();
      }

      app.quit();
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      app.quit();
    }
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
