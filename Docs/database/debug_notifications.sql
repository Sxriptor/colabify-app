-- Check if any live_activities exist
SELECT COUNT(*) as total_activities FROM live_activities;

-- Check most recent activity
SELECT
  id,
  user_id,
  project_id,
  activity_type,
  occurred_at
FROM live_activities
ORDER BY occurred_at DESC
LIMIT 1;

-- Check if notifications exist for recent activities
SELECT
  n.id,
  n.user_id,
  n.type,
  n.data->>'activity_id' as activity_id,
  n.created_at
FROM notifications n
WHERE type = 'team_activity'
ORDER BY created_at DESC
LIMIT 10;

-- Check notification_log entries
SELECT COUNT(*) as total_logs FROM notifications_log;

-- Check if there are team members
SELECT
  pm.project_id,
  pm.user_id,
  u.display_name
FROM project_members pm
INNER JOIN users u ON u.id = pm.user_id
LIMIT 10;
