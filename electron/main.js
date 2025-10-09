const { app, BrowserWindow, Notification, ipcMain, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// Register custom protocol for OAuth callback
const PROTOCOL = 'devpulse';

// Set as default protocol handler
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
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

// Handle deep links for OAuth callback
const handleDeepLink = (url) => {
  console.log('Deep link received:', url);

  if (mainWindow) {
    // Parse the callback URL and extract parameters
    if (url.startsWith(`${PROTOCOL}://`)) {
      // Convert custom protocol URL to HTTP format for parsing
      const callbackUrl = url.replace(`${PROTOCOL}://`, 'http://');

      // Send the callback to the renderer process
      mainWindow.webContents.send('auth-callback', callbackUrl);

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
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      handleDeepLink(url);
    }
  });
}

// App lifecycle events
app.whenReady().then(() => {
  createWindow();

  // Check for deep link URL on startup (Windows/Linux)
  if (process.platform === 'win32' || process.platform === 'linux') {
    const url = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
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
