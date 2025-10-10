const { app, BrowserWindow, Notification, ipcMain, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Use built-in fetch (Node.js 18+)
const fetch = globalThis.fetch;

// Simple in-memory storage for auth data (in production, use electron-store with encryption)
let authData = null;

let mainWindow;

// Register custom protocol for OAuth callback
const PROTOCOL = 'colabify';

// Set as default protocol handler
console.log('🔧 Registering protocol:', PROTOCOL);
console.log('🔧 Process defaultApp:', process.defaultApp);
console.log('🔧 Process argv:', process.argv);

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    const result = app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    console.log('🔧 Protocol registration result (dev):', result);
  }
} else {
  const result = app.setAsDefaultProtocolClient(PROTOCOL);
  console.log('🔧 Protocol registration result (prod):', result);
}

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
ipcMain.handle('auth:login', async () => {
  // Always use production URL for OAuth (simplifies the flow)
  const authUrl = 'https://colabify.xyz/login?platform=electron';
  
  console.log('🚀 Opening auth URL in browser:', authUrl);
  
  try {
    // Open in default browser
    await shell.openExternal(authUrl);
    console.log('✅ Browser opened successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to open browser:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:getUser', async () => {
  return authData ? authData.user : null;
});

ipcMain.handle('auth:logout', async () => {
  authData = null;
  return { success: true };
});

// Make authenticated API calls
ipcMain.handle('api:call', async (event, endpoint, options = {}) => {
  if (!authData) {
    throw new Error('Not authenticated');
  }

  // Check if token expired
  if (authData.expires_at < Date.now()) {
    // TODO: Implement refresh token logic
    throw new Error('Session expired');
  }

  // Always use production URL for API calls
  const response = await fetch(`https://colabify.xyz/api${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${authData.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }

  return response.json();
});

// Test protocol registration
ipcMain.handle('test:protocol', async () => {
  const isRegistered = app.isDefaultProtocolClient(PROTOCOL);
  console.log('🧪 Protocol test - isRegistered:', isRegistered);
  
  // Try to simulate a protocol call
  const testUrl = `${PROTOCOL}://test/callback?token=test123`;
  console.log('🧪 Test URL would be:', testUrl);
  
  return { 
    isRegistered, 
    protocol: PROTOCOL,
    testUrl 
  };
});

// Handle deep links for OAuth callback
const handleDeepLink = async (url) => {
  console.log('🔗 Deep link received:', url);
  console.log('🔍 Expected protocol:', `${PROTOCOL}://auth/callback`);

  if (mainWindow) {
    // Parse the callback URL and extract parameters
    if (url.startsWith(`${PROTOCOL}://auth/callback`)) {
      console.log('✅ Protocol matches, processing auth callback');
      try {
        const urlObj = new URL(url);
        const token = urlObj.searchParams.get('token');

        if (!token) {
          console.error('No token in callback URL');
          mainWindow.webContents.send('auth-error', 'No authentication token received');
          return;
        }

        console.log('Exchanging token for session...');

        // Exchange the one-time token for actual session data
        // Always use production URL for consistency
        const response = await fetch(`https://colabify.xyz/api/auth/electron-token?token=${token}`);

        if (!response.ok) {
          throw new Error(`Token exchange failed: ${response.status}`);
        }

        const sessionData = await response.json();
        console.log('Auth successful for user:', sessionData.user.email);

        // Store auth data securely
        authData = {
          user: sessionData.user,
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
          expires_at: Date.now() + (sessionData.expires_in * 1000)
        };

        // Notify renderer process
        mainWindow.webContents.send('auth-success', {
          user: sessionData.user,
          // Don't send tokens to renderer - keep them in main process
        });

      } catch (error) {
        console.error('Auth callback error:', error);
        mainWindow.webContents.send('auth-error', error.message);
      }

      // Focus the window
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  }
};

// macOS: Handle deep links when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('🍎 macOS open-url event received:', url);
  handleDeepLink(url);
});

// Windows/Linux: Handle deep links from command line
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

    // Check if there's a deep link URL in the command line arguments
    console.log('🔍 Checking command line for deep links:', commandLine);
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      console.log('🔗 Found deep link in command line:', url);
      handleDeepLink(url);
    } else {
      console.log('❌ No deep link found in command line');
    }
  });
}

// App lifecycle events
app.whenReady().then(() => {
  createWindow();

  // Verify protocol registration
  const isRegistered = app.isDefaultProtocolClient(PROTOCOL);
  console.log('✅ Protocol registration verified:', isRegistered);
  
  if (!isRegistered) {
    console.log('❌ Protocol not registered, attempting to register again...');
    const retryResult = app.setAsDefaultProtocolClient(PROTOCOL);
    console.log('🔄 Retry registration result:', retryResult);
  }

  // Check for deep link URL on startup (Windows/Linux)
  if (process.platform === 'win32' || process.platform === 'linux') {
    const url = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      console.log('🔗 Found startup deep link:', url);
      handleDeepLink(url);
    }
  }

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

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
