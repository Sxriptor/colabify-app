-- Simple Email Notifications System
-- Trigger on notification insert to send email if user has email notifications enabled

-- Create simple function to send email notification
CREATE OR REPLACE FUNCTION send_email_on_notification_insert()
RETURNS TRIGGER AS $$
DECLARE
  user_email_enabled BOOLEAN;
  webhook_url TEXT := 'https://colabify.xyz/api/notifications/send-email';
  request_id BIGINT;
BEGIN
  -- Check if user has email notifications enabled
  SELECT (notification_preferences->>'email')::boolean INTO user_email_enabled
  FROM users 
  WHERE id = NEW.user_id;

  -- If user doesn't have email notifications enabled, skip
  IF user_email_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Send HTTP request to website to send email
  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'data', NEW.data
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the notification insert if email fails
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on notifications table insert
CREATE TRIGGER email_notification_on_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_email_on_notification_insert();