-- =============================================
-- ADD COLABIFY COLUMNS TO EXISTING PROFILES
-- =============================================
-- Run this after the complete schema if profiles needs the additional Colabify columns
-- Or if you need to migrate data from a users table to profiles

-- =============================================
-- ALTER PROFILES TABLE
-- =============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_id INTEGER UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preference TEXT
  DEFAULT 'instant' CHECK (notification_preference IN ('instant', 'digest'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB
  DEFAULT '{"notifications": true, "email": true, "app": true}'::jsonb;

-- =============================================
-- ADD INDEXES FOR NEW COLUMNS
-- =============================================

CREATE INDEX IF NOT EXISTS idx_profiles_github_id ON public.profiles(github_id);
CREATE INDEX IF NOT EXISTS idx_profiles_github_username ON public.profiles(github_username);
CREATE INDEX IF NOT EXISTS idx_profiles_notification_prefs ON public.profiles USING GIN (notification_preferences);

-- =============================================
-- CLEAN UP (if users table was accidentally created)
-- =============================================
-- Uncomment the following if a separate 'users' table exists and you want to migrate data to profiles first

/*
-- OPTIONAL: Migrate data from users to profiles (if users table exists)
-- Do this BEFORE dropping the users table

-- First, ensure all users have corresponding profiles
INSERT INTO public.profiles (id, email, full_name, role, avatar_url, github_id, github_username, notification_preference, notification_preferences)
SELECT
  u.id,
  u.email,
  u.name,
  'client' as role,
  u.avatar_url,
  u.github_id,
  u.github_username,
  u.notification_preference,
  u.notification_preferences
FROM public.users u
ON CONFLICT (id) DO UPDATE SET
  github_id = EXCLUDED.github_id,
  github_username = EXCLUDED.github_username,
  notification_preference = EXCLUDED.notification_preference,
  notification_preferences = EXCLUDED.notification_preferences;

-- Then drop the users table (cascades to all dependent tables)
DROP TABLE IF EXISTS public.users CASCADE;
*/

-- =============================================
-- VERIFY COLUMNS EXIST
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'github_id'
  ) THEN
    RAISE WARNING 'Column github_id not found in profiles table';
  ELSE
    RAISE NOTICE 'Column github_id exists in profiles table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'notification_preferences'
  ) THEN
    RAISE WARNING 'Column notification_preferences not found in profiles table';
  ELSE
    RAISE NOTICE 'Column notification_preferences exists in profiles table';
  END IF;
END $$;
