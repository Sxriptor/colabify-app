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

  // Auth event listeners
  onAuthSuccess: (callback) => {
    ipcRenderer.on('auth-success', (event, data) => callback(data));
  },
  onAuthError: (callback) => {
    ipcRenderer.on('auth-error', (event, error) => callback(error));
  },
  onAuthSignedOut: (callback) => {
    ipcRenderer.on('auth-signed-out', () => callback());
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
});
