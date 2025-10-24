const path = require('path');
const fs = require('fs');

// Load environment variables with better path resolution
const envPath = path.join(__dirname, '../.env.local');
console.log('🔧 Loading environment from:', envPath);
console.log('🔧 Environment file exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✅ Environment file loaded');
} else {
  console.log('⚠️ Environment file not found, trying alternative paths...');
  
  // Try alternative paths for different build contexts
  const altPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(__dirname, '../../.env.local'),
    path.join(process.resourcesPath, '.env.local')
  ];
  
  for (const altPath of altPaths) {
    console.log('🔍 Trying:', altPath);
    if (fs.existsSync(altPath)) {
      require('dotenv').config({ path: altPath });
      console.log('✅ Environment loaded from:', altPath);
      break;
    }
  }
}

// Debug: Check if Supabase credentials are loaded
console.log('🔧 Environment check:');
console.log('  SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('  SUPABASE_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Loaded' : '❌ Missing');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  Platform:', process.platform);
console.log('  Architecture:', process.arch);

const { app, BrowserWindow, Notification, ipcMain, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const AuthManager = require('./services/AuthManager');
const isDev = process.env.NODE_ENV === 'development';
const net = require('net');

// Use built-in fetch (Node.js 18+)
const fetch = globalThis.fetch;

// Initialize AuthManager
const authManager = new AuthManager();

// Initialize Auto-updater Service
const AutoUpdaterService = require('./services/AutoUpdaterService');
const autoUpdaterService = new AutoUpdaterService();

let mainWindow;
let tray = null; // System tray instance
let selectedPort = 3000; // Global variable to store the selected port

// Function to check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, 'localhost');
  });
}

// Function to check if a port has a running HTTP server (for dev mode)
async function checkPortHasServer(port) {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Function to detect Next.js dev server port (tries multiple ports)
async function detectNextJsPort() {
  console.log('🔍 Detecting Next.js dev server port...');
  
  // First, check which ports are busy to determine the search order
  const port3000Busy = !(await isPortAvailable(3000));
  
  if (port3000Busy) {
    console.log('⚠️ Port 3000 is already busy, Next.js likely starting on port 3001...');
  }
  
  // In development, Next.js might be on 3000 or 3001
  // If port 3000 is already occupied, prioritize checking 3001
  for (let attempt = 0; attempt < 15; attempt++) {
    if (port3000Busy) {
      // Port 3000 was busy when we started, so check 3001 first
      const port3001HasServer = await checkPortHasServer(3001);
      if (port3001HasServer) {
        console.log('✅ Found Next.js dev server on port 3001');
        selectedPort = 3001;
        return 3001;
      }
      
      // Still check 3000 as fallback, but it's less likely
      const port3000HasServer = await checkPortHasServer(3000);
      if (port3000HasServer) {
        console.log('✅ Found Next.js dev server on port 3000');
        selectedPort = 3000;
        return 3000;
      }
    } else {
      // Port 3000 was free, so check it first
      const port3000HasServer = await checkPortHasServer(3000);
      if (port3000HasServer) {
        console.log('✅ Found Next.js dev server on port 3000');
        selectedPort = 3000;
        return 3000;
      }
      
      // Check 3001 as fallback
      const port3001HasServer = await checkPortHasServer(3001);
      if (port3001HasServer) {
        console.log('✅ Found Next.js dev server on port 3001');
        selectedPort = 3001;
        return 3001;
      }
    }
    
    // Wait a bit before trying again
    console.log(`⏳ Waiting for Next.js dev server... (attempt ${attempt + 1}/15)`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.error('❌ Could not detect Next.js dev server on ports 3000 or 3001');
  throw new Error('Next.js dev server not found on ports 3000 or 3001');
}

// Function to select an available port (for production mode)
async function selectAvailablePort() {
  const portsToTry = [3000, 3001, 3002, 3003, 3004];
  
  for (const port of portsToTry) {
    console.log(`🔍 Checking port ${port}...`);
    const available = await isPortAvailable(port);
    if (available) {
      console.log(`✅ Port ${port} is available`);
      selectedPort = port;
      return port;
    } else {
      console.log(`⚠️ Port ${port} is busy`);
    }
  }
  
  console.error('❌ All ports 3000-3004 are busy!');
  throw new Error('No available ports found in range 3000-3004');
}

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

// Function to create system tray
function createSystemTray() {
  console.log('🔔 Creating system tray...');
  
  // Get the appropriate icon for the tray
  const getTrayIconPath = () => {
    if (process.platform === 'win32') {
      // Windows uses .ico for tray icons
      return path.join(__dirname, '../build/icon.ico');
    } else if (process.platform === 'darwin') {
      // macOS uses template images for tray (PNG with @2x for Retina)
      return path.join(__dirname, '../public/icons/colabify.png');
    } else {
      // Linux uses PNG
      return path.join(__dirname, '../public/icons/colabify.png');
    }
  };
  
  const trayIconPath = getTrayIconPath();
  console.log('🎨 Tray icon path:', trayIconPath);
  console.log('🎨 Tray icon exists:', fs.existsSync(trayIconPath));
  
  // Create tray icon
  const trayImage = nativeImage.createFromPath(trayIconPath);
  
  // Resize for better display on different platforms
  if (process.platform === 'darwin') {
    // macOS tray icons should be 22x22 (or 16x16)
    tray = new Tray(trayImage.resize({ width: 22, height: 22 }));
  } else {
    tray = new Tray(trayImage);
  }
  
  tray.setToolTip('Colabify');
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Colabify',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Notifications',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
          // Navigate to inbox page
          mainWindow.webContents.send('navigate-to-inbox');
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  // Set context menu (shows on right-click)
  tray.setContextMenu(contextMenu);
  
  // Handle left-click on tray icon
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  // Handle double-click on tray icon (Windows)
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  console.log('✅ System tray created');
}

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
    console.log(`🌐 Connecting to Next.js dev server on port ${selectedPort}`);
    url = `http://localhost:${selectedPort}`;
  } else {
    // In production, run the Next.js standalone server
    const path = require('path');
    const fs = require('fs');
    const { spawn } = require('child_process');
    
    console.log(`🚀 Starting Next.js standalone server on port ${selectedPort}...`);
    console.log(`🖥️ Platform: ${process.platform}`);
    console.log(`📁 Current directory: ${__dirname}`);
    
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
      url = `data:text/html,<html><body><h1>Error: Next.js server not found</h1><p>Please rebuild the application with: npm run build</p><p>Server path: ${serverPath}</p><p>Platform: ${process.platform}</p></body></html>`;
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
        
        // Copy .env.local to standalone if needed (for environment variables)
        const envPath = path.join(__dirname, '../.env.local');
        const standaloneEnvPath = path.join(standalonePath, '.env.local');
        if (!fs.existsSync(standaloneEnvPath) && fs.existsSync(envPath)) {
          console.log('📦 Copying environment file to standalone folder...');
          fs.copyFileSync(envPath, standaloneEnvPath);
          console.log('✅ Environment file copied');
        }
        
        // Simplified approach: Use direct require method since spawn is problematic on Mac
        console.log('🚀 Starting server using direct require method...');
        
        // Set environment variables for the server
        const serverEnv = {
          ...process.env,
          PORT: selectedPort.toString(),
          HOSTNAME: 'localhost',
          NODE_ENV: 'production'
        };
        
        // Explicitly set Supabase environment variables if they exist
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          serverEnv.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        }
        if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        }
        
        console.log('🔧 Server environment:');
        console.log('  PORT:', serverEnv.PORT);
        console.log('  NODE_ENV:', serverEnv.NODE_ENV);
        console.log('  SUPABASE_URL:', serverEnv.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
        
        // Store original environment and directory
        const originalEnv = { ...process.env };
        const originalCwd = process.cwd();
        
        try {
          // Set environment variables
          Object.assign(process.env, serverEnv);
          
          // Change to standalone directory
          process.chdir(standalonePath);
          
          // Clear require cache and start server
          delete require.cache[serverPath];
          require(serverPath);
          
          console.log('✅ Server started successfully using direct method');
          
          // Wait a moment for server to initialize
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          url = `http://localhost:${selectedPort}`;
          
        } catch (requireError) {
          console.error('❌ Server startup failed:', requireError);
          url = `data:text/html,<html><body style="font-family: Arial, sans-serif; padding: 20px; background: #f44336; color: white;"><h1>Server Startup Error</h1><p><strong>Error:</strong> ${requireError.message}</p><p><strong>Platform:</strong> ${process.platform}</p><p><strong>Port:</strong> ${selectedPort}</p></body></html>`;
        } finally {
          // Restore original environment and directory
          process.env = originalEnv;
          process.chdir(originalCwd);
        }
        

      } catch (error) {
        console.error('❌ Failed to start Next.js server:', error);
        url = `data:text/html,<html><body><h1>Error: Failed to start server</h1><p>${error.message}</p><p>Platform: ${process.platform}</p></body></html>`;
      }
    }
  }
  
  console.log('🌐 Loading URL:', url);
  
  // Add comprehensive error handling for URL loading
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Failed to load URL:', validatedURL);
    console.error('❌ Error code:', errorCode);
    console.error('❌ Error description:', errorDescription);
    
    // Load an error page if the main URL fails
    const errorHtml = `
      <html>
        <head>
          <title>Colabify - Loading Error</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              padding: 40px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              margin: 0;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .container { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px); }
            .error { color: #ff6b6b; }
            .info { margin: 10px 0; }
            code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; }
            .retry-btn { 
              background: #4CAF50; 
              color: white; 
              border: none; 
              padding: 10px 20px; 
              border-radius: 5px; 
              cursor: pointer; 
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚫 Failed to Load Colabify</h1>
            <div class="info"><strong>URL:</strong> ${validatedURL}</div>
            <div class="info"><strong>Error Code:</strong> <span class="error">${errorCode}</span></div>
            <div class="info"><strong>Error:</strong> <span class="error">${errorDescription}</span></div>
            <div class="info"><strong>Platform:</strong> ${process.platform}</div>
            <div class="info"><strong>Development Mode:</strong> ${isDev}</div>
            <div class="info"><strong>Selected Port:</strong> ${selectedPort}</div>
            <hr style="border: 1px solid rgba(255,255,255,0.3); margin: 20px 0;">
            <h3>Troubleshooting Steps:</h3>
            <ol>
              <li>Try rebuilding: <code>npm run build</code></li>
              <li>Check if port ${selectedPort} is available</li>
              <li>Restart the application</li>
              <li>Check the console for additional error messages</li>
            </ol>
            <button class="retry-btn" onclick="location.reload()">🔄 Retry</button>
          </div>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page loaded successfully');
    
    // Inject some debugging info into the page
    mainWindow.webContents.executeJavaScript(`
      console.log('🔍 Electron Debug Info:');
      console.log('Platform: ${process.platform}');
      console.log('URL: ${url}');
      console.log('Development Mode: ${isDev}');
      console.log('Selected Port: ${selectedPort}');
    `).catch(err => console.log('Could not inject debug info:', err));
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('✅ DOM ready');
  });

  // Add a timeout for loading
  const loadTimeout = setTimeout(() => {
    console.error('⏰ URL loading timeout after 30 seconds');
    if (mainWindow && !mainWindow.isDestroyed()) {
      const timeoutHtml = `
        <html>
          <head><title>Loading Timeout</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background: #f44336; color: white;">
            <h1>⏰ Loading Timeout</h1>
            <p>The application failed to load within 30 seconds.</p>
            <p><strong>URL:</strong> ${url}</p>
            <p><strong>Platform:</strong> ${process.platform}</p>
            <button onclick="location.reload()" style="padding: 10px 20px; font-size: 16px;">🔄 Retry</button>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(timeoutHtml)}`);
    }
  }, 30000);

  // Clear timeout when page loads successfully
  mainWindow.webContents.once('did-finish-load', () => {
    clearTimeout(loadTimeout);
  });

  mainWindow.loadURL(url);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    console.log('🪟 Window ready to show');
    mainWindow.show();

    // Initialize Git monitoring backend after window is ready
    initializeGitMonitoring(mainWindow);

    // Initialize auto-updater after window is ready
    autoUpdaterService.initialize(mainWindow);
  });

  // Prevent navigation to external URLs (for OAuth flow)
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    console.log('🧭 Navigation attempt to:', navigationUrl);
    
    try {
      const parsedUrl = new URL(navigationUrl);
      const expectedOrigin = `http://localhost:${selectedPort}`;
      
      console.log('🧭 Expected origin:', expectedOrigin);
      console.log('🧭 Actual origin:', parsedUrl.origin);

      // Allow navigation within the app (using the selected port since we need API routes)
      if (parsedUrl.origin !== expectedOrigin) {
        event.preventDefault();
        console.log('🚫 Blocked navigation to:', navigationUrl);
      } else {
        console.log('✅ Allowed navigation to:', navigationUrl);
      }
    } catch (urlError) {
      console.error('❌ Error parsing navigation URL:', urlError);
      event.preventDefault();
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

  // Handle window close - minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

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

// Single instance lock (disabled in development mode to allow multiple instances)
if (isDev) {
  // In development, allow multiple instances
  console.log('🔧 Development mode: Multiple instances allowed');
} else {
  // In production, enforce single instance
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    console.log('⚠️ Another instance is already running. Exiting...');
    app.quit();
  } else {
    console.log('✅ Single instance lock acquired');
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      console.log('⚠️ Second instance attempted to start, focusing existing window...');
      // Someone tried to run a second instance, focus our window instead
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
        mainWindow.show();
      }
    });
  }
}

// App lifecycle events
app.whenReady().then(async () => {
  console.log('🚀 App ready event fired');
  console.log('🖥️ Platform:', process.platform);
  console.log('🔧 Development mode:', isDev);
  console.log('📁 __dirname:', __dirname);
  console.log('📁 process.cwd():', process.cwd());
  
  // Select an available port before creating the window
  try {
    if (isDev) {
      // In development, detect which port Next.js is running on
      await detectNextJsPort();
    } else {
      // In production, select an available port for our standalone server
      await selectAvailablePort();
    }
    console.log(`✅ Selected port: ${selectedPort}`);
  } catch (error) {
    console.error('❌ Failed to select an available port:', error);
    // Continue with default port 3000 if selection fails
  }
  
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
  
  // Create system tray
  createSystemTray();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep the app running in the tray even when all windows are closed
  // Don't quit the app - it will continue running in the system tray
  // User must explicitly choose "Quit" from the tray menu
  console.log('🪟 All windows closed, app still running in tray');
});

// Cleanup Git monitoring backend, notification service, auto-updater, tray, and Next.js server on app quit
app.on('before-quit', async (event) => {
  // Only do cleanup once
  if (global.isCleaningUp) {
    return;
  }
  
  global.isCleaningUp = true;
  event.preventDefault();

  console.log('🧹 Starting cleanup...');

  try {
    // Cleanup system tray
    if (tray) {
      console.log('🔔 Destroying system tray...');
      try {
        tray.destroy();
        tray = null;
      } catch (err) {
        console.error('Error destroying tray:', err);
      }
    }

    // Cleanup Next.js server
    if (global.nextServerProcess) {
      console.log('🛑 Stopping Next.js server...');
      try {
        global.nextServerProcess.kill();
        global.nextServerProcess = null;
      } catch (err) {
        console.error('Error killing Next.js server:', err);
      }
    }

    // Cleanup notification service
    if (notificationService) {
      console.log('🔔 Cleaning up notification service...');
      try {
        notificationService.destroy();
        notificationService = null;
      } catch (err) {
        console.error('Error cleaning up notification service:', err);
      }
    }

    // Cleanup Git monitoring - safely check if methods exist
    if (gitMonitoringBackend) {
      console.log('🧹 Cleaning up Git monitoring backend...');
      try {
        if (typeof gitMonitoringBackend.cleanup === 'function') {
          await gitMonitoringBackend.cleanup();
        } else if (typeof gitMonitoringBackend.destroy === 'function') {
          await gitMonitoringBackend.destroy();
        }
        gitMonitoringBackend = null;
      } catch (err) {
        console.error('Error cleaning up Git monitoring:', err);
      }
    }

    // Cleanup auto-updater
    if (autoUpdaterService) {
      console.log('🔄 Cleaning up auto-updater...');
      try {
        if (typeof autoUpdaterService.cleanup === 'function') {
          autoUpdaterService.cleanup();
        }
      } catch (err) {
        console.error('Error cleaning up auto-updater:', err);
      }
    }

    console.log('✅ Cleanup complete, quitting app...');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    // Force quit the app after cleanup with a small delay to ensure async operations complete
    global.isCleaningUp = false;
    setTimeout(() => {
      console.log('👋 Forcing app exit...');
      app.exit(0);
      // If app.exit doesn't work, force process exit
      setTimeout(() => {
        process.exit(0);
      }, 500);
    }, 100);
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
