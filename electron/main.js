const { app, BrowserWindow, Notification, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const AuthManager = require('./services/AuthManager');
const isDev = process.env.NODE_ENV === 'development';

// Use built-in fetch (Node.js 18+)
const fetch = globalThis.fetch;

// Initialize AuthManager
const authManager = new AuthManager();

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
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
  const url = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../out/index.html')}`;

  mainWindow.loadURL(url);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Initialize Git monitoring backend after window is ready
    initializeGitMonitoring(mainWindow);
  });

  // Prevent navigation to external URLs (for OAuth flow)
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const currentUrl = new URL(mainWindow.webContents.getURL());

    // Allow navigation within the app
    if (isDev) {
      // In dev, only allow localhost:3000
      if (parsedUrl.origin !== 'http://localhost:3000') {
        event.preventDefault();
        console.log('Blocked navigation to:', navigationUrl);
      }
    } else {
      // In production, only allow file:// protocol
      if (parsedUrl.protocol !== 'file:') {
        event.preventDefault();
        console.log('Blocked navigation to:', navigationUrl);
      }
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
      title: title || 'DevPulse',
      body: body || '',
      icon: icon ? path.join(__dirname, '../public', icon) : undefined
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
        subscriptionStatus: authResult.subscriptionStatus
      };
      console.log('📦 Event data:', JSON.stringify(eventData, null, 2));

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

// Make authenticated API calls
ipcMain.handle('api:call', async (event, endpoint, options = {}) => {
  try {
    return await authManager.makeAuthenticatedRequest(endpoint, options);
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
});

console.log('✅ All IPC handlers registered');

// Initialize Git monitoring backend
let gitMonitoringBackend;

// Function to initialize Git monitoring (called after window is ready)
async function initializeGitMonitoring(mainWindow) {
  try {
    // Dynamic import for TypeScript modules
    const gitModule = await import('../src/main/index.js');
    gitMonitoringBackend = gitModule.gitMonitoringBackend;
    
    await gitMonitoringBackend.initialize(mainWindow);
    console.log('✅ Git monitoring backend initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Git monitoring backend:', error);
    console.error('This is expected in development - Git monitoring will be available after TypeScript compilation');
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
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup Git monitoring backend on app quit
app.on('before-quit', async (event) => {
  if (gitMonitoringBackend && gitMonitoringBackend.isInitialized()) {
    event.preventDefault();
    
    try {
      await gitMonitoringBackend.cleanup();
      app.quit();
    } catch (error) {
      console.error('❌ Error during Git monitoring cleanup:', error);
      app.quit();
    }
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
