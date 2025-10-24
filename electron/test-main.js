const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('🚀 Test Electron main process starting...');
console.log('🖥️ Platform:', process.platform);
console.log('📁 __dirname:', __dirname);

let mainWindow;

function createWindow() {
  console.log('🪟 Creating test window...');
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    backgroundColor: '#ffffff'
  });

  // Load a simple test page
  const testHtml = `
    <html>
      <head>
        <title>Electron Test</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
          }
          .info { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>🚀 Electron Test - Mac Build</h1>
        <div class="info">
          <h2>Platform Information</h2>
          <p><strong>Platform:</strong> ${process.platform}</p>
          <p><strong>Arch:</strong> ${process.arch}</p>
          <p><strong>Node Version:</strong> ${process.version}</p>
          <p><strong>Electron Version:</strong> ${process.versions.electron}</p>
        </div>
        <div class="info">
          <h2>Path Information</h2>
          <p><strong>__dirname:</strong> ${__dirname}</p>
          <p><strong>process.cwd():</strong> ${process.cwd()}</p>
        </div>
        <p>✅ If you can see this, the Electron app is working correctly!</p>
        <p>The issue is likely with the Next.js server startup or URL loading.</p>
      </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html,${encodeURIComponent(testHtml)}`);

  mainWindow.once('ready-to-show', () => {
    console.log('✅ Test window ready to show');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('✅ App ready, creating window...');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});