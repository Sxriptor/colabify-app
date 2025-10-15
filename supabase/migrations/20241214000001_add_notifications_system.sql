-- Simple notifications system that works with existing users table
-- The users table has an 'id' column which we'll reference

-- Drop existing tables if they exist (for clean restart)
DROP TABLE IF EXISTS notifications_log CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP FUNCTION IF EXISTS create_notification CASCADE;
DROP FUNCTION IF EXISTS cleanup_user_notifications CASCADE;

-- Create notifications table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications_log table
CREATE TABLE notifications_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_method TEXT NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own notification logs" ON notifications_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage notification logs" ON notifications_log
  FOR ALL USING (true);

-- Create indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(read);

CREATE INDEX idx_notifications_log_notification_id ON notifications_log(notification_id);
CREATE INDEX idx_notifications_log_user_id ON notifications_log(user_id);
CREATE INDEX idx_notifications_log_delivery_status ON notifications_log(delivery_status);

-- Function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- Insert the notification
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (p_user_id, p_title, p_message, p_type, p_data)
  RETURNING id INTO notification_id;
  
  -- Always create app delivery log entry (we'll check preferences in the app)
  INSERT INTO notifications_log (notification_id, user_id, delivery_method, delivery_status)
  VALUES (notification_id, p_user_id, 'app', 'pending');
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark notification as delivered
CREATE OR REPLACE FUNCTION mark_notification_delivered(
  p_notification_id UUID,
  p_delivery_method TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE notifications_log 
  SET delivery_status = 'delivered', 
      delivered_at = NOW()
  WHERE notification_id = p_notification_id 
    AND delivery_method = p_delivery_method;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old notifications (keep only 10 per user)
CREATE OR REPLACE FUNCTION cleanup_user_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Keep only the 10 most recent notifications per user
  DELETE FROM notifications 
  WHERE user_id = NEW.user_id 
    AND id NOT IN (
      SELECT id FROM notifications 
      WHERE user_id = NEW.user_id 
      ORDER BY created_at DESC 
      LIMIT 10
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically clean up old notifications
CREATE TRIGGER cleanup_notifications_trigger
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_user_notifications();