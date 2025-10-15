-- Add notification preferences column to users table
ALTER TABLE users 
ADD COLUMN notification_preferences JSONB DEFAULT '{"notifications": true, "email": true, "app": true}'::jsonb;

-- Add index for better query performance
CREATE INDEX idx_users_notification_preferences ON users USING GIN (notification_preferences);

-- Add comment for documentation
COMMENT ON COLUMN users.notification_preferences IS 'User notification preferences stored as JSON with keys: notifications, email, app';