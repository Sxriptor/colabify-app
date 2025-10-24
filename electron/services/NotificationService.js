const { Notification, app } = require('electron');
const { createClient } = require('@supabase/supabase-js');

class NotificationService {
  constructor() {
    this.supabase = null;
    this.currentUserId = null;
    this.pollingInterval = null;
    this.isPolling = false;
    this.lastCheckedAt = new Date();
    this.accessToken = null;
    this.subscription = null;
    
    this.initializeSupabase();
  }

  initializeSupabase() {
    // Try to load from environment variables first
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // If not found in env, try to read from .env.local file
    if (!supabaseUrl || !supabaseKey) {
      try {
        const path = require('path');
        const fs = require('fs');
        const dotenv = require('dotenv');
        
        // Try different possible locations for .env.local
        const possiblePaths = [
          path.join(__dirname, '../../.env.local'),
          path.join(process.resourcesPath, '.env.local'),
          path.join(process.cwd(), '.env.local')
        ];
        
        for (const envPath of possiblePaths) {
          if (fs.existsSync(envPath)) {
            console.log('🔍 Found .env.local at:', envPath);
            const envConfig = dotenv.parse(fs.readFileSync(envPath));
            supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
            supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseKey) break;
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not load .env.local file:', error.message);
      }
    }

    console.log('🔧 NotificationService environment check:');
    console.log('  SUPABASE_URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
    console.log('  SUPABASE_KEY:', supabaseKey ? '✅ Found' : '❌ Missing');

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase credentials not found in environment');
      console.error('Please create a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
      console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));
      return;
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase client:', error);
    }
  }

  // Start real-time notification listening for a user
  async startPolling(userId, accessToken) {
    console.log('🔔 Starting real-time notification listening for user:', userId);
    
    if (!this.supabase) {
      console.error('❌ Cannot start listening: Supabase not initialized');
      return;
    }
    
    this.currentUserId = userId;

    // Store the access token and create authenticated client
    if (accessToken) {
      this.accessToken = accessToken;
      console.log('✅ Access token stored for notification service');
      
      // Create a new Supabase client with the access token
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        
        // Set the session explicitly for real-time to work with RLS
        await this.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: '' // Not needed for real-time subscriptions
        });
        
        console.log('✅ Authenticated Supabase client created with session');
      } catch (error) {
        console.error('❌ Failed to create authenticated client:', error);
      }
    } else {
      console.warn('⚠️ No access token provided for notification service');
    }

    // Stop existing subscriptions
    this.stopPolling();

    // Set up real-time subscription for notifications_log table
    this.isPolling = true;
    
    try {
      console.log('🔔 Setting up real-time subscription for notifications...');
      console.log('🔔 Subscribing to notifications_log for user:', userId);
      
      this.subscription = this.supabase
        .channel(`notification-changes-${userId}`) // Unique channel per user
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications_log',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('🔔 Real-time event received!');
            console.log('🔔 Payload:', JSON.stringify(payload, null, 2));
            this.handleNewNotificationLog(payload.new);
          }
        )
        .subscribe((status, error) => {
          console.log('🔔 Subscription status changed:', status);
          if (error) {
            console.error('❌ Subscription error:', error);
          }
          if (status === 'SUBSCRIBED') {
            console.log('✅ Real-time notifications ACTIVE and listening for user:', userId);
            console.log('✅ Waiting for INSERT events on notifications_log table...');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Channel error - real-time subscription failed');
          } else if (status === 'TIMED_OUT') {
            console.error('❌ Subscription timed out');
          } else if (status === 'CLOSED') {
            console.log('🔔 Subscription closed');
          }
        });

    } catch (error) {
      console.error('❌ Failed to set up real-time subscription:', error);
      console.error('❌ Error stack:', error.stack);
    }
  }

  // Stop notification listening
  stopPolling() {
    console.log('🔔 Stopping notification listening');
    
    this.isPolling = false;
    
    // Unsubscribe from real-time changes
    if (this.subscription) {
      this.supabase.removeChannel(this.subscription);
      this.subscription = null;
      console.log('✅ Real-time subscription removed');
    }
    
    // Legacy: remove polling interval if it exists
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Handle new notification log from real-time subscription
  async handleNewNotificationLog(logData) {
    try {
      console.log('🔔 Processing new notification log:', logData);
      
      // Only process app notifications that are pending
      if (logData.delivery_method !== 'app' || logData.delivery_status !== 'pending') {
        console.log('📭 Skipping non-app or non-pending notification');
        return;
      }

      // Get the actual notification data
      const { data: notification, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('id', logData.notification_id)
        .single();

      if (error) {
        console.error('❌ Error fetching notification:', error);
        return;
      }

      if (notification) {
        console.log('🔔 Showing system notification for:', notification.title);
        await this.showSystemNotification(notification, logData.id);
      } else {
        console.warn('⚠️ No notification found for log:', logData.notification_id);
      }
    } catch (error) {
      console.error('❌ Error handling new notification log:', error);
    }
  }

  // Check for new notifications
  async checkForNewNotifications() {
    if (!this.currentUserId || !this.supabase || !this.isPolling) {
      console.log('🔍 Skipping notification check:', {
        hasUserId: !!this.currentUserId,
        hasSupabase: !!this.supabase,
        isPolling: this.isPolling
      });
      return;
    }

    try {
      console.log('🔍 Checking for new notifications for user:', this.currentUserId);
      
      // Check if we have access token
      if (!this.accessToken) {
        console.error('❌ No access token available for notification service');
        return;
      }

      // Get pending app notifications for the current user (only recent ones - last 30 seconds)
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
      
      const { data: pendingLogs, error: logsError } = await this.supabase
        .from('notifications_log')
        .select('*')
        .eq('user_id', this.currentUserId)
        .eq('delivery_method', 'app')
        .eq('delivery_status', 'pending')
        .gte('created_at', thirtySecondsAgo)
        .order('created_at', { ascending: false });

      if (logsError) {
        console.error('❌ Error fetching notification logs:', logsError);
        return;
      }

      if (!pendingLogs || pendingLogs.length === 0) {
        console.log('📭 No pending notification logs found');
        return;
      }

      console.log(`📋 Found ${pendingLogs.length} pending logs, fetching notifications...`);

      // Now get the actual notifications for each log
      const notificationIds = pendingLogs.map(log => log.notification_id);
      console.log('🔍 Looking for these notification IDs:', notificationIds);
      
      // Let's also check what's actually in the notifications table
      const { data: allNotifications, error: allError } = await this.supabase
        .from('notifications')
        .select('id, title, user_id')
        .eq('user_id', this.currentUserId);
        
      console.log('📋 All notifications for user:', allNotifications);
      if (allError) {
        console.error('❌ Error fetching all notifications:', allError);
      }
      
      const { data: notifications, error: notificationsError } = await this.supabase
        .from('notifications')
        .select('*')
        .in('id', notificationIds);

      if (notificationsError) {
        console.error('❌ Error fetching notifications:', notificationsError);
        return;
      }

      console.log(`📬 Found ${notifications?.length || 0} notifications for ${pendingLogs.length} logs`);
      
      // Debug: Log the notification IDs we're looking for vs what we found
      console.log('🔍 Debug info:');
      console.log('  Looking for notification IDs:', notificationIds);
      console.log('  Found notifications:', notifications?.map(n => ({ id: n.id, title: n.title })) || []);

      // Match notifications to logs and process them
      for (const log of pendingLogs) {
        const notification = notifications?.find(n => n.id === log.notification_id);
        if (notification) {
          console.log('📋 Processing notification:', notification.title);
          await this.showSystemNotification(notification, log.id);
        } else {
          console.warn('⚠️ No notification found for log:', log.notification_id);
        }
      }

      if (logsError) {
        console.error('❌ Error fetching notification logs:', logsError);
        return;
      }



    } catch (error) {
      console.error('❌ Error checking for notifications:', error);
      console.error('❌ Error details:', error.message);
    }
  }

  // Show system notification
  async showSystemNotification(notification, logId) {
    try {
      console.log('🔔 Showing system notification:', notification.title);

      // Check if notifications are supported and permitted
      if (!Notification.isSupported()) {
        console.warn('System notifications not supported');
        await this.markAsDelivered(logId, 'System notifications not supported');
        return;
      }

      // Create the system notification with enhanced formatting
      const icon = this.getIconForType(notification.type);
      
      const systemNotification = new Notification({
        title: notification.title,
        body: notification.message,
        icon: icon,
        silent: false,
        urgency: this.getUrgencyForType(notification.type),
        tag: 'colabify-git-activity', // Group similar notifications
        timeoutType: 'default'
      });

      // Handle notification click
      systemNotification.on('click', () => {
        console.log('🖱️ Notification clicked - opening inbox');
        
        // Focus the app window and navigate to inbox
        const { BrowserWindow } = require('electron');
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const mainWindow = windows[0];
          
          // Restore and focus the window
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.focus();
          
          // Navigate to inbox page
          mainWindow.webContents.executeJavaScript(`
            if (window.location.pathname !== '/inbox') {
              window.location.href = '/inbox';
            }
          `).catch(err => {
            console.error('❌ Failed to navigate to inbox:', err);
          });
          
          console.log('✅ App focused and navigated to inbox');
        } else {
          console.warn('⚠️ No main window found');
        }
      });

      // Handle notification close
      systemNotification.on('close', () => {
        console.log('🔔 Notification closed');
      });

      // Show the notification
      systemNotification.show();

      // Mark as delivered
      await this.markAsDelivered(logId);

    } catch (error) {
      console.error('Error showing system notification:', error);
      await this.markAsDelivered(logId, error.message);
    }
  }

  // Mark notification as delivered
  async markAsDelivered(logId, errorMessage) {
    if (!this.supabase) return;

    try {
      const updateData = {
        delivery_status: errorMessage ? 'failed' : 'delivered',
        delivered_at: new Date().toISOString()
      };

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const { error } = await this.supabase
        .from('notifications_log')
        .update(updateData)
        .eq('id', logId);

      if (error) {
        console.error('Error updating notification log:', error);
      } else {
        console.log('✅ Notification marked as delivered');
      }
    } catch (error) {
      console.error('Error marking notification as delivered:', error);
    }
  }

  // Get icon path for notification type
  getIconForType(type) {
    const path = require('path');
    const fs = require('fs');

    // Try different icon paths in order of preference
    // PNG files work best for Windows notifications
    const iconPaths = [
      path.join(__dirname, '../../build/icon.png'),            // Production PNG
      path.join(__dirname, '../../public/icons/icon-192x192.png'), // Development PNG (better for notifications)
      path.join(__dirname, '../../public/icons/colabify.png'), // Fallback PNG
      path.join(__dirname, '../../build/icon.icns'),           // macOS icon (production)
      path.join(__dirname, '../../public/icons/icon.icns')     // macOS icon (development)
    ];

    // Find the first icon that exists
    for (const iconPath of iconPaths) {
      if (fs.existsSync(iconPath)) {
        console.log('🎨 Using notification icon:', iconPath);
        return iconPath;
      }
    }

    // Ultimate fallback - no icon
    console.warn('⚠️ No notification icon found, using default');
    return null;
  }

  // Get urgency level for notification type
  getUrgencyForType(type) {
    switch (type) {
      case 'error':
        return 'critical';
      case 'warning':
        return 'normal';
      case 'success':
        return 'low';
      default:
        return 'normal';
    }
  }

  // Get current user's notification preferences
  async getUserNotificationPreferences(userId) {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('ℹ️ User notification preferences not found (this is normal for new users):', error.message);
        // Return default preferences if user record doesn't exist or doesn't have preferences
        return {
          notifications: true,
          email: true,
          app: true
        };
      }

      const preferences = data?.notification_preferences || {
        notifications: true,
        email: true,
        app: true
      };

      console.log('📋 User notification preferences:', preferences);
      return preferences;
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      // Return default preferences on error
      return {
        notifications: true,
        email: true,
        app: true
      };
    }
  }

  // Check if user has app notifications enabled
  async hasAppNotificationsEnabled(userId) {
    const preferences = await this.getUserNotificationPreferences(userId);
    const hasAppNotifications = preferences?.app === true;
    console.log('🔔 App notifications enabled check:', {
      userId,
      preferences,
      hasAppNotifications
    });
    return hasAppNotifications;
  }

  // Cleanup method
  destroy() {
    this.stopPolling();
    this.currentUserId = null;
  }
}

module.exports = { NotificationService };