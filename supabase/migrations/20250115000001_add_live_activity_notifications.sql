-- Create function to send notifications when live_activities are updated
-- Checks user notification preferences before creating notifications

CREATE OR REPLACE FUNCTION notify_team_on_live_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_member RECORD;
  notification_id UUID;
  commit_message TEXT;
  actor_name TEXT;
  existing_notification_count INTEGER;
BEGIN
  -- For UPDATE operations, only notify if meaningful data changed
  IF TG_OP = 'UPDATE' THEN
    -- Skip if commit_hash, branch_name, and activity_data haven't changed
    IF OLD.commit_hash = NEW.commit_hash AND
       OLD.branch_name = NEW.branch_name AND
       OLD.activity_data = NEW.activity_data THEN
      RAISE LOG 'Skipping notification - no meaningful changes in activity: %', NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  RAISE LOG 'notify_team_on_live_activity triggered for activity_id: %, operation: %, user_id: %, project_id: %', NEW.id, TG_OP, NEW.user_id, NEW.project_id;

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
    RAISE LOG 'Found team member: %, preferences: %', team_member.id, team_member.notification_preferences;

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

      RAISE LOG 'Created notification: % for user: %', notification_id, team_member.id;

      -- Create notification log entries based on preferences
      -- App notification (if enabled or if preference is null, default to true)
      IF team_member.notification_preferences IS NULL OR
         team_member.notification_preferences->>'app' IS NULL OR
         (team_member.notification_preferences->>'app')::boolean = true THEN
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

      -- Email notification (if enabled or if preference is null, default to true)
      IF team_member.notification_preferences IS NULL OR
         team_member.notification_preferences->>'email' IS NULL OR
         (team_member.notification_preferences->>'email')::boolean = true THEN
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
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'notify_team_on_live_activity error: %, SQLSTATE: %', SQLERRM, SQLSTATE;
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

-- Verify trigger was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_notify_team_on_live_activity'
  ) THEN
    RAISE NOTICE 'Trigger trigger_notify_team_on_live_activity created successfully';
  ELSE
    RAISE WARNING 'Trigger trigger_notify_team_on_live_activity was NOT created';
  END IF;
END $$;
