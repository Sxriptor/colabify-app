-- Step 1: Check if trigger exists
SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  proname AS function_name,
  tgenabled AS enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'trigger_notify_team_on_live_activity';

-- Step 2: Check if function exists
SELECT
  proname AS function_name,
  prosecdef AS is_security_definer,
  provolatile AS volatility
FROM pg_proc
WHERE proname = 'notify_team_on_live_activity';

-- Step 3: Check recent live_activities
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

-- Step 4: Check if there are project members for those activities
SELECT DISTINCT
  la.project_id,
  pm.user_id,
  u.notification_preferences
FROM live_activities la
INNER JOIN project_members pm ON pm.project_id = la.project_id
INNER JOIN users u ON u.id = pm.user_id
WHERE la.id IN (SELECT id FROM live_activities ORDER BY occurred_at DESC LIMIT 5)
  AND pm.user_id != la.user_id
ORDER BY la.project_id;

-- Step 5: Check recent notifications
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

-- Step 6: Check notification logs
SELECT
  nl.id,
  nl.user_id,
  nl.delivery_method,
  nl.delivery_status,
  n.title,
  nl.created_at
FROM notifications_log nl
LEFT JOIN notifications n ON n.id = nl.notification_id
ORDER BY nl.created_at DESC
LIMIT 10;

-- Step 7: Count how many notifications SHOULD be created for recent activities
SELECT
  la.id AS activity_id,
  la.user_id AS activity_user,
  la.project_id,
  COUNT(DISTINCT pm.user_id) AS team_members_who_should_be_notified
FROM live_activities la
INNER JOIN project_members pm ON pm.project_id = la.project_id
WHERE la.id IN (SELECT id FROM live_activities ORDER BY occurred_at DESC LIMIT 5)
  AND pm.user_id != la.user_id
GROUP BY la.id, la.user_id, la.project_id;

-- Step 8: Check if any notifications exist for recent activities
SELECT
  n.id,
  n.user_id,
  n.title,
  n.data->>'activity_id' as activity_id,
  n.created_at
FROM notifications n
WHERE n.type = 'team_activity'
  AND n.data->>'activity_id' IN (
    SELECT id::text FROM live_activities ORDER BY occurred_at DESC LIMIT 5
  )
ORDER BY n.created_at DESC;
