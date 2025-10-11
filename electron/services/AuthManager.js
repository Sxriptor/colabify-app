const { shell } = require('electron');
const http = require('http');
const { URL } = require('url');
const keytar = require('keytar');

class AuthManager {
  constructor() {
    this.callbackServer = null;
    this.authPromise = null;
    this.serviceName = 'DevPulse';
    this.accountName = 'auth-token';
    this.cachedUser = null; // Cache user data to avoid repeated API calls
    this.userCacheExpiry = null; // Cache expiry time
    this.cacheValidityMs = 5 * 60 * 1000; // Cache for 5 minutes
  }

  /**
   * Find an open port in the given range
   */
  async findOpenPort(startPort = 8080, endPort = 8090) {
    for (let port = startPort; port <= endPort; port++) {
      if (await this.isPortOpen(port)) {
        return port;
      }
    }
    throw new Error(`No open ports found between ${startPort} and ${endPort}`);
  }

  /**
   * Check if a port is available
   */
  isPortOpen(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Start the local callback server
   */
  async startCallbackServer(port) {
    return new Promise((resolve, reject) => {
      this.callbackServer = http.createServer((req, res) => {
        const url = new URL(req.url, `http://localhost:${port}`);

        console.log('🔗 Callback received:', url.pathname, url.search);
        console.log('📋 Full URL:', req.url);

        if (url.pathname === '/auth/callback') {
          const token = url.searchParams.get('token');
          const expiresAt = url.searchParams.get('expires_at');
          const subscriptionStatus = url.searchParams.get('subscription_status');
          const error = url.searchParams.get('error');

          console.log('🔍 Callback params:', {
            hasToken: !!token,
            tokenLength: token?.length,
            expiresAt,
            subscriptionStatus,
            error
          });

          // Send response to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });

          if (error) {
            console.log('❌ Error in callback:', error);
            res.end(`
              <html>
                <head><title>Authentication Error</title></head>
                <body style="font-family: system-ui; text-align: center; padding: 50px;">
                  <h2>Authentication Error</h2>
                  <p>Error: ${error}</p>
                  <p>You can close this window and try again.</p>
                </body>
              </html>
            `);
            this.authPromise?.reject(new Error(error));
          } else if (token) {
            console.log('✅ Token received, processing authentication...');
            res.end(`
              <html>
                <head><title>Authentication Successful</title></head>
                <body style="font-family: system-ui; text-align: center; padding: 50px;">
                  <h2>✅ Authentication Successful!</h2>
                  <p>You can now close this window and return to DevPulse.</p>
                  <script>
                    setTimeout(() => window.close(), 2000);
                  </script>
                </body>
              </html>
            `);

            // Process the successful authentication
            console.log('🔄 Calling processAuthCallback...');
            this.processAuthCallback(token, expiresAt, subscriptionStatus)
              .catch(err => {
                console.error('❌ Error in processAuthCallback:', err);
              });
          } else {
            console.log('❌ No token in callback');
            res.end(`
              <html>
                <head><title>Authentication Error</title></head>
                <body style="font-family: system-ui; text-align: center; padding: 50px;">
                  <h2>Authentication Error</h2>
                  <p>No authentication token received.</p>
                  <p>You can close this window and try again.</p>
                </body>
              </html>
            `);
            this.authPromise?.reject(new Error('No token received'));
          }

          // Close server after handling callback
          setTimeout(() => {
            console.log('🔒 Closing callback server...');
            this.callbackServer?.close();
            this.callbackServer = null;
          }, 1000);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.callbackServer.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🚀 Callback server listening on port ${port}`);
          resolve(port);
        }
      });
    });
  }

  /**
   * Process the authentication callback
   */
  async processAuthCallback(token, expiresAt, subscriptionStatus) {
    try {
      console.log('🔄 Processing auth callback...');
      console.log('📥 Token received (first 50 chars):', token ? token.substring(0, 50) + '...' : 'NO TOKEN');
      console.log('📥 Expires at:', expiresAt);
      console.log('📥 Subscription status:', subscriptionStatus);

      if (!token) {
        throw new Error('No token provided to processAuthCallback');
      }

      // Store token securely
      console.log('💾 Storing token in keytar...');
      await this.storeToken(token, expiresAt);
      console.log('✅ Token stored successfully');

      // Get user info from the token
      console.log('👤 Fetching user info from API...');
      console.log('🌐 API URL: https://colabify.xyz/api/auth/user');

      const userInfo = await this.getUserInfo(token);
      console.log('✅ User info received:', userInfo?.email || 'no email');
      console.log('📦 User info keys:', Object.keys(userInfo || {}));
      console.log('📦 Full user info:', JSON.stringify(userInfo, null, 2));

      // Cache the user data
      this.cachedUser = userInfo;
      this.userCacheExpiry = Date.now() + this.cacheValidityMs;
      console.log('💾 User data cached for 5 minutes');

      console.log('✅ Authentication successful for:', userInfo?.email || 'unknown user');

      // Resolve the auth promise
      console.log('🎯 Resolving auth promise...');
      console.log('🎯 Auth promise exists?', !!this.authPromise);

      if (this.authPromise) {
        this.authPromise.resolve({
          user: userInfo,
          token,
          expiresAt,
          subscriptionStatus
        });
        console.log('✅ Auth promise resolved');
      } else {
        console.warn('⚠️ No auth promise to resolve!');
      }

    } catch (error) {
      console.error('❌ Error processing auth callback:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);

      if (this.authPromise) {
        this.authPromise.reject(error);
      } else {
        console.error('⚠️ No auth promise to reject error to!');
      }
    }
  }

  /**
   * Get user information from token
   */
  async getUserInfo(token) {
    try {
      console.log('📡 Fetching user info...');
      console.log('🔑 Token (first 20 chars):', token.substring(0, 20) + '...');

      // Use IDE-specific endpoint that accepts Bearer tokens
      const url = 'https://colabify.xyz/api/auth/user';
      console.log('🌐 Request URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📨 Response status:', response.status);
      console.log('📨 Response ok?', response.ok);
      console.log('📨 Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error text:', errorText);
        throw new Error(`Failed to get user info: ${response.status} - ${errorText}`);
      }

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Response is not JSON. Content-Type:', contentType);
        console.error('❌ Response body (first 500 chars):', text.substring(0, 500));
        throw new Error(`API returned HTML instead of JSON. The endpoint may not exist on the server yet.`);
      }

      const data = await response.json();
      console.log('📦 Response data keys:', Object.keys(data));
      console.log('📦 Has user property?', 'user' in data);

      // The API returns { user: profile }, so unwrap it
      const userInfo = data.user || data;
      console.log('✅ Returning user info:', userInfo?.email || 'no email');

      return userInfo;
    } catch (error) {
      console.error('❌ Error getting user info:', error);
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      throw error;
    }
  }

  /**
   * Store token securely using keytar
   */
  async storeToken(token, expiresAt) {
    try {
      const authData = {
        token,
        expiresAt: expiresAt || (Date.now() + 24 * 60 * 60 * 1000), // Default 24h
        storedAt: Date.now()
      };
      
      await keytar.setPassword(this.serviceName, this.accountName, JSON.stringify(authData));
      console.log('🔐 Token stored securely');
    } catch (error) {
      console.error('Error storing token:', error);
      throw error;
    }
  }

  /**
   * Retrieve stored token
   */
  async getStoredToken() {
    try {
      const stored = await keytar.getPassword(this.serviceName, this.accountName);
      if (!stored) return null;

      const authData = JSON.parse(stored);
      
      // Check if token is expired
      if (authData.expiresAt && Date.now() > authData.expiresAt) {
        console.log('🕐 Stored token expired, removing...');
        await this.clearStoredToken();
        return null;
      }

      return authData;
    } catch (error) {
      console.error('Error retrieving stored token:', error);
      return null;
    }
  }

  /**
   * Clear stored token
   */
  async clearStoredToken() {
    try {
      this.clearUserCache();
      await keytar.deletePassword(this.serviceName, this.accountName);
      console.log('🗑️ Token cleared from secure storage');
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  }

  /**
   * Begin external sign-in process
   */
  async beginExternalSignIn() {
    try {
      console.log('🚀 Starting external sign-in process...');

      // Find an open port for callback
      const port = await this.findOpenPort(8080, 8090);
      
      // Start callback server
      await this.startCallbackServer(port);
      
      // Build redirect URI
      const redirectUri = `http://localhost:${port}/auth/callback`;
      
      // Build auth URL - using your account management system
      const authUrl = `https://colabify.xyz/login?source=ide&redirect_uri=${encodeURIComponent(redirectUri)}`;

      console.log('🌐 Opening auth URL:', authUrl);
      
      // Open external browser
      await shell.openExternal(authUrl);
      
      // Return promise that resolves when auth completes
      return new Promise((resolve, reject) => {
        this.authPromise = { resolve, reject };
        
        // Set timeout for auth process
        setTimeout(() => {
          if (this.authPromise) {
            this.authPromise.reject(new Error('Authentication timeout'));
            this.authPromise = null;
          }
          if (this.callbackServer) {
            this.callbackServer.close();
            this.callbackServer = null;
          }
        }, 5 * 60 * 1000); // 5 minute timeout
      });
      
    } catch (error) {
      console.error('❌ Error starting external sign-in:', error);
      throw error;
    }
  }

  /**
   * Check if user is currently authenticated
   */
  async isAuthenticated() {
    const stored = await this.getStoredToken();
    return !!stored;
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    const stored = await this.getStoredToken();
    if (!stored) {
      this.clearUserCache();
      return null;
    }

    // Check if we have valid cached user data
    if (this.cachedUser && this.userCacheExpiry && Date.now() < this.userCacheExpiry) {
      console.log('📋 Returning cached user data');
      return this.cachedUser;
    }

    try {
      console.log('🔄 Cache expired or missing, fetching fresh user data');
      const userInfo = await this.getUserInfo(stored.token);
      
      // Cache the fresh user data
      this.cachedUser = userInfo;
      this.userCacheExpiry = Date.now() + this.cacheValidityMs;
      console.log('💾 Fresh user data cached');
      
      return userInfo;
    } catch (error) {
      console.error('Error getting current user:', error);
      // If we can't get user info, token might be invalid
      this.clearUserCache();
      await this.clearStoredToken();
      return null;
    }
  }

  /**
   * Clear cached user data
   */
  clearUserCache() {
    this.cachedUser = null;
    this.userCacheExpiry = null;
    console.log('🗑️ User cache cleared');
  }

  /**
   * Sign out user
   */
  async signOut() {
    this.clearUserCache();
    await this.clearStoredToken();
    console.log('👋 User signed out');
  }

  /**
   * Make authenticated API call
   */
  async makeAuthenticatedRequest(endpoint, options = {}) {
    const stored = await this.getStoredToken();
    if (!stored) {
      throw new Error('Not authenticated');
    }

    // Use localhost in development
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://colabify.xyz'
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${stored.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (response.status === 401) {
      // Token might be invalid, clear it
      this.clearUserCache();
      await this.clearStoredToken();
      throw new Error('Authentication expired');
    }

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    return response.json();
  }
}

module.exports = AuthManager;