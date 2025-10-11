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
  startSignIn: () => ipcRenderer.invoke('auth:start-sign-in'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUser: () => ipcRenderer.invoke('auth:get-user'),
  isAuthenticated: () => ipcRenderer.invoke('auth:is-authenticated'),
  getToken: () => ipcRenderer.invoke('auth:get-token'),

  // Auth event listeners
  onAuthSuccess: (callback) => {
    console.log('🎧 PRELOAD: Setting up auth-success listener');
    ipcRenderer.on('auth-success', (event, data) => {
      console.log('🎧 PRELOAD: auth-success event received!', data);
      callback(data);
    });
  },
  onAuthError: (callback) => {
    console.log('🎧 PRELOAD: Setting up auth-error listener');
    ipcRenderer.on('auth-error', (event, error) => {
      console.log('🎧 PRELOAD: auth-error event received!', error);
      callback(error);
    });
  },
  onAuthSignedOut: (callback) => {
    console.log('🎧 PRELOAD: Setting up auth-signed-out listener');
    ipcRenderer.on('auth-signed-out', () => {
      console.log('🎧 PRELOAD: auth-signed-out event received!');
      callback();
    });
  },

  // API calls with stored token
  apiCall: (endpoint, options) => ipcRenderer.invoke('api:call', endpoint, options),

  // Remove auth event listeners
  removeAuthListeners: () => {
    ipcRenderer.removeAllListeners('auth-success');
    ipcRenderer.removeAllListeners('auth-error');
    ipcRenderer.removeAllListeners('auth-signed-out');
  },

  // Platform information
  platform: process.platform,
  isElectron: true,
  
  // Test IPC listener
  onTestEvent: (callback) => {
    console.log('🎧 PRELOAD: Setting up test-event listener');
    ipcRenderer.on('test-event', (event, data) => {
      console.log('✅ PRELOAD: test-event received!', data);
      callback(data);
    });
  },
});
