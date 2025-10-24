const { app, BrowserWindow, Notification } = require('electron');
const path = require('path');

console.log('🔔 Testing Mac Notifications');
console.log('Platform:', process.platform);
console.log('Electron version:', process.versions.electron);

app.whenReady().then(() => {
  console.log('🚀 App ready');
  
  // Set app name and ID for notifications
  app.setName('Colabify');
  app.setAppUserModelId('com.colabify.app');
  
  console.log('App name:', app.getName());
  console.log('Notifications supported:', Notification.isSupported());
  
  // Create a simple window
  const win = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  win.loadURL('data:text/html,<h1>Testing Notifications</h1><p>Check console for results</p>');
  
  // Test notification after a short delay
  setTimeout(() => {
    console.log('🔔 Attempting to show test notification...');
    
    try {
      const notification = new Notification({
        title: 'Colabify Test',
        body: 'This is a test notification from the DMG build',
        silent: false
      });
      
      notification.on('show', () => {
        console.log('✅ Notification shown successfully!');
      });
      
      notification.on('failed', (error) => {
        console.error('❌ Notification failed:', error);
      });
      
      notification.on('click', () => {
        console.log('🖱️ Notification clicked');
      });
      
      notification.show();
      console.log('📤 Notification.show() called');
      
    } catch (error) {
      console.error('❌ Error creating notification:', error);
    }
  }, 2000);
});

app.on('window-all-closed', () => {
  app.quit();
});