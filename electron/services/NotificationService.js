const { Notification, app } = require('electron');
const { createClient } = require('@supabase/supabase-js');

class NotificationService {
  constructor() {
    this.supabase = null;
    this.currentUserId = null;
    this.pollingInterval = null;
    this.isPolling = false;
    this.lastCheckedAt = new Date();
    
    this.initializeSupabase();
  }

  initializeSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log('🔧 NotificationService environment check:');
    console.log('  SUPABASE_URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
    console.log('  SUPABASE_KEY:', supabaseKey ? '✅ Found' : '❌ Missing');

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase credentials not found in environment');
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

  // Start notification polling for a user
  async startPolling(userId, accessToken) {
    console.log('🔔 Starting notification polling for user:', userId);
    
    if (!this.supabase) {
      console.error('❌ Cannot start polling: Supabase not initialized');
      return;
    }
    
    this.currentUserId = userId;
    this.lastCheckedAt = new Date();

    // Set auth token if provided
    if (accessToken && this.supabase) {
      try {
        await this.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: '', // We don't need refresh for polling
          user: { id: userId }
        });
        console.log('✅ Auth session set for notification service');
      } catch (error) {
        console.error('❌ Failed to set auth session:', error);
      }
    }

    // Check if user has app notifications enabled
    const hasAppNotifications = await this.hasAppNotificationsEnabled(userId);
    if (!hasAppNotifications) {
      console.log('📵 App notifications disabled for user, not starting polling');
      return;
    }

    // Stop existing polling
    this.stopPolling();

    // Start polling every 30 seconds
    this.isPolling = true;
    this.pollingInterval = setInterval(() => {
      this.checkForNewNotifications();
    }, 30000);

    console.log('✅ Notification polling started, checking immediately...');
    // Check immediately
    this.checkForNewNotifications();
  }

  // Stop notification polling
  stopPolling() {
    console.log('🔔 Stopping notification polling');
    
    this.isPolling = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
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

      // Get pending app notifications for the current user
      const { data: pendingLogs, error: logsError } = await this.supabase
        .from('notifications_log')
        .select(`
          *,
          notification:notifications(*)
        `)
        .eq('user_id', this.currentUserId)
        .eq('delivery_method', 'app')
        .eq('delivery_status', 'pending')
        .order('created_at', { ascending: false });

      if (logsError) {
        console.error('❌ Error fetching notification logs:', logsError);
        return;
      }

      console.log('📊 Query result:', {
        pendingLogs: pendingLogs?.length || 0,
        data: pendingLogs
      });

      if (!pendingLogs || pendingLogs.length === 0) {
        console.log('📭 No pending notifications found');
        return;
      }

      console.log(`📬 Found ${pendingLogs.length} pending notifications, processing...`);

      // Process each pending notification
      for (const log of pendingLogs) {
        console.log('📋 Processing log:', log.id, 'with notification:', log.notification?.title);
        if (log.notification) {
          await this.showSystemNotification(log.notification, log.id);
        } else {
          console.warn('⚠️ Log has no notification data:', log);
        }
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

      // Create the system notification
      const systemNotification = new Notification({
        title: notification.title,
        body: notification.message,
        icon: this.getIconForType(notification.type),
        silent: false,
        urgency: this.getUrgencyForType(notification.type)
      });

      // Handle notification click
      systemNotification.on('click', () => {
        console.log('🖱️ Notification clicked');
        // Focus the app window
        const { BrowserWindow } = require('electron');
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const mainWindow = windows[0];
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.focus();
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
    // You can customize these paths based on your app's icon structure
    const iconPath = app.getAppPath();
    
    switch (type) {
      case 'success':
        return `${iconPath}/build/icon.icns`;
      case 'warning':
        return `${iconPath}/build/icon.icns`;
      case 'error':
        return `${iconPath}/build/icon.icns`;
      default:
        return `${iconPath}/build/icon.icns`;
    }
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
        console.error('Error fetching user notification preferences:', error);
        return null;
      }

      return data?.notification_preferences || {
        notifications: true,
        email: true,
        app: true
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return null;
    }
  }

  // Check if user has app notifications enabled
  async hasAppNotificationsEnabled(userId) {
    const preferences = await this.getUserNotificationPreferences(userId);
    return preferences?.app === true;
  }

  // Cleanup method
  destroy() {
    this.stopPolling();
    this.currentUserId = null;
  }
}

module.exports = { NotificationService };