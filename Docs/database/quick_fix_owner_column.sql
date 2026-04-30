-- Quick fix: Just add the missing owner column
-- Run this in Supabase SQL Editor if you just need to fix the immediate error

-- Check if repositories table exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'repositories'
) as table_exists;

-- Check if owner column exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repositories' AND column_name = 'owner'
) as owner_column_exists;

-- Add the owner column if it doesn't exist
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS owner TEXT;

-- Update existing records to have an owner value (extract from full_name)
UPDATE repositories 
SET owner = split_part(full_name, '/', 1) 
WHERE owner IS NULL OR owner = '';

-- Make the owner column NOT NULL after updating existing records
ALTER TABLE repositories ALTER COLUMN owner SET NOT NULL;

-- Verify the fix
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'repositories' 
ORDER BY column_name;