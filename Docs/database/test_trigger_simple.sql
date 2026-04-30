-- Query 1: Check recent live_activities
SELECT
  id,
  user_id,
  project_id,
  activity_type,
  branch_name,
  commit_hash,
  activity_data->>'message' as commit_message,
  occurred_at
FROM live_activities
ORDER BY occurred_at DESC
LIMIT 5;

-- Query 2: Check for team members in the project (MOST IMPORTANT)
-- Replace 'YOUR_PROJECT_ID' with actual project_id from Query 1
SELECT DISTINCT
  pm.project_id,
  pm.user_id,
  u.display_name,
  u.notification_preferences
FROM project_members pm
INNER JOIN users u ON u.id = pm.user_id
WHERE pm.project_id = 'YOUR_PROJECT_ID'
ORDER BY pm.user_id;

-- Query 3: Check recent notifications
SELECT
  id,
  user_id,
  title,
  message,
  type,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;

-- Query 4: Check notification logs
SELECT
  nl.id,
  nl.user_id,
  nl.delivery_method,
  nl.delivery_status,
  nl.created_at
FROM notifications_log nl
ORDER BY nl.created_at DESC
LIMIT 10;

-- Query 5: Check all project members
SELECT
  pm.project_id,
  p.name as project_name,
  pm.user_id,
  u.display_name,
  pm.status
FROM project_members pm
INNER JOIN projects p ON p.id = pm.project_id
INNER JOIN users u ON u.id = pm.user_id
ORDER BY pm.project_id, pm.user_id;
