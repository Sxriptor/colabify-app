const { app, BrowserWindow, Notification, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

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

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
