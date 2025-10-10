const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Notification API
  showNotification: (data) => ipcRenderer.invoke('show-notification', data),
  requestNotificationPermission: () => ipcRenderer.invoke('request-notification-permission'),

  // OAuth / Browser API
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  onAuthCallback: (callback) => {
    ipcRenderer.on('auth-callback', (event, url) => callback(url));
  },
  removeAuthCallback: () => {
    ipcRenderer.removeAllListeners('auth-callback');
  },

  // Auth functions
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUser: () => ipcRenderer.invoke('auth:getUser'),

  // Auth event listeners
  onAuthSuccess: (callback) => {
    ipcRenderer.on('auth-success', (event, data) => callback(data));
  },
  onAuthError: (callback) => {
    ipcRenderer.on('auth-error', (event, error) => callback(error));
  },

  // API calls with stored token
  apiCall: (endpoint, options) => ipcRenderer.invoke('api:call', endpoint, options),

  // Test functions
  testProtocol: () => ipcRenderer.invoke('test:protocol'),
  
  // Manual protocol test
  testManualProtocol: () => {
    const testUrl = 'colabify://test/callback?token=test123';
    console.log('🧪 Testing manual protocol redirect to:', testUrl);
    window.location.href = testUrl;
  },

  // Platform information
  platform: process.platform,
  isElectron: true,
});
