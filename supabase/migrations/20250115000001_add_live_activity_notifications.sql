-- Create function to send notifications when live_activities are updated
-- Checks user notification preferences before creating notifications

CREATE OR REPLACE FUNCTION notify_team_on_live_activity()
RETURNS TRIGGER AS $$
DECLARE
  team_member RECORD;
  notification_id UUID;
  commit_message TEXT;
  actor_name TEXT;
BEGIN
  -- Extract commit message and actor info
  commit_message := NEW.activity_data->>'message';
  actor_name := NEW.activity_data->'author'->>'name';

  -- If actor name is null, get from users table
  IF actor_name IS NULL THEN
    SELECT display_name INTO actor_name
    FROM users
    WHERE id = NEW.user_id;
  END IF;

  -- Find all team members in the project (excluding the actor)
  FOR team_member IN
    SELECT DISTINCT u.id, u.notification_preferences
    FROM users u
    INNER JOIN project_members pm ON pm.user_id = u.id
    WHERE pm.project_id = NEW.project_id
      AND u.id != NEW.user_id  -- Don't notify the person who made the commit
  LOOP
    -- Check if user has notifications enabled
    IF team_member.notification_preferences IS NULL OR
       (team_member.notification_preferences->>'notifications')::boolean = true THEN

      -- Create the notification
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        data,
        read,
        created_at
      ) VALUES (
        team_member.id,
        'New Team Activity',
        actor_name || ' committed: ' || LEFT(commit_message, 100),
        'team_activity',
        jsonb_build_object(
          'activity_id', NEW.id,
          'project_id', NEW.project_id,
          'repository_id', NEW.repository_id,
          'actor_id', NEW.user_id,
          'actor_name', actor_name,
          'activity_type', NEW.activity_type,
          'branch', NEW.branch_name,
          'commit_hash', NEW.commit_hash,
          'commit_message', commit_message,
          'occurred_at', NEW.occurred_at
        ),
        false,
        NOW()
      )
      RETURNING id INTO notification_id;

      -- Create notification log entries based on preferen
      -- App notification (if enabled)
      IF (team_member.notification_preferences->>'app')::boolean = true THEN
        INSERT INTO notifications_log (
          notification_id,
          user_id,
          delivery_method,
          delivery_status,
          created_at
        ) VALUES (
          notification_id,
          team_member.id,
          'app',
          'pending',
          NOW()
        );
      END IF;

      -- Email notification (if enabled)
      IF (team_member.notification_preferences->>'email')::boolean = true THEN
        INSERT INTO notifications_log (
          notification_id,
          user_id,
          delivery_method,
          delivery_status,
          created_at
        ) VALUES (
          notification_id,
          team_member.id,
          'email',
          'pending',
          NOW()
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on live_activities
DROP TRIGGER IF EXISTS trigger_notify_team_on_live_activity ON live_activities;

CREATE TRIGGER trigger_notify_team_on_live_activity
  AFTER INSERT OR UPDATE
  ON live_activities
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_on_live_activity();

-- Add comment
COMMENT ON FUNCTION notify_team_on_live_activity() IS
'Creates notifications for team members when live_activities are updated. Respects user notification preferences for app and email.';
