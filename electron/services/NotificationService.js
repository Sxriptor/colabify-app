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
          }
        });
        console.log('✅ Authenticated Supabase client created');
      } catch (error) {
        console.error('❌ Failed to create authenticated client:', error);
      }
    } else {
      console.warn('⚠️ No access token provided for notification service');
    }

    // For now, always start polling - we'll check preferences during polling
    // TODO: Re-enable preference check once user records are properly migrated
    console.log('🔔 Starting polling (preference check temporarily disabled for testing)');

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