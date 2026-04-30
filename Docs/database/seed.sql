-- Colabify Seed Data for Development
-- This file contains sample data for development and testing

-- Insert sample users
INSERT INTO users (id, email, name, github_username, avatar_url, notification_preference) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'john.doe@example.com', 'John Doe', 'johndoe', 'https://github.com/johndoe.png', 'instant'),
  ('550e8400-e29b-41d4-a716-446655440002', 'jane.smith@example.com', 'Jane Smith', 'janesmith', 'https://github.com/janesmith.png', 'digest'),
  ('550e8400-e29b-41d4-a716-446655440003', 'bob.wilson@example.com', 'Bob Wilson', 'bobwilson', 'https://github.com/bobwilson.png', 'instant');

-- Insert sample projects
INSERT INTO projects (id, name, description, visibility, owner_id) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', 'Colabify Core', 'Main Colabify application development', 'private', '550e8400-e29b-41d4-a716-446655440001'),
  ('660e8400-e29b-41d4-a716-446655440002', 'Open Source Utils', 'Collection of open source utilities', 'public', '550e8400-e29b-41d4-a716-446655440002'),
  ('660e8400-e29b-41d4-a716-446655440003', 'Team Dashboard', 'Internal team dashboard project', 'private', '550e8400-e29b-41d4-a716-446655440001');

-- Insert sample project members
INSERT INTO project_members (project_id, user_id, role, status, joined_at) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'owner', 'active', NOW()),
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'member', 'active', NOW()),
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'owner', 'active', NOW()),
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'member', 'active', NOW()),
  ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'owner', 'active', NOW());

-- Insert sample repositories
INSERT INTO repositories (id, project_id, github_id, name, full_name, url, webhook_id, webhook_secret) VALUES
  ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 123456789, 'Colabify-app', 'johndoe/Colabify-app', 'https://github.com/johndoe/Colabify-app', 987654321, 'webhook_secret_123'),
  ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 234567890, 'js-utils', 'janesmith/js-utils', 'https://github.com/janesmith/js-utils', 876543210, 'webhook_secret_456'),
  ('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', 345678901, 'team-dashboard', 'johndoe/team-dashboard', 'https://github.com/johndoe/team-dashboard', 765432109, 'webhook_secret_789');

-- Insert sample notifications
INSERT INTO notifications (project_id, repository_id, event_type, triggered_by, payload, message) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'push', 'johndoe', '{"commits": [{"message": "Add user authentication", "sha": "abc123"}]}', 'John Doe pushed 1 commit to Colabify-app'),
  ('660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 'pull_request', 'bobwilson', '{"action": "opened", "pull_request": {"title": "Fix utility function bug", "number": 42}}', 'Bob Wilson opened pull request #42: Fix utility function bug'),
  ('660e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'create', 'janesmith', '{"ref": "feature/new-dashboard", "ref_type": "branch"}', 'Jane Smith created branch feature/new-dashboard');

-- Insert sample email deliveries
INSERT INTO email_deliveries (user_id, notification_id, email_type, recipient_email, subject, delivery_status) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM notifications WHERE message LIKE '%John Doe pushed%'), 'instant', 'jane.smith@example.com', 'Colabify: New activity in Colabify Core', 'delivered'),
  ('550e8400-e29b-41d4-a716-446655440003', (SELECT id FROM notifications WHERE message LIKE '%Bob Wilson opened%'), 'instant', 'bob.wilson@example.com', 'Colabify: New activity in Open Source Utils', 'delivered'),
  ('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM notifications WHERE message LIKE '%Jane Smith created%'), 'instant', 'john.doe@example.com', 'Colabify: New activity in Colabify Core', 'sent');