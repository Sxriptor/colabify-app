-- Fix for existing repositories table with github_id column
-- This handles the case where the table already exists with different schema

-- First, let's see what we have
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'repositories' 
ORDER BY column_name;

-- Make github_id nullable if it exists and is currently NOT NULL
DO $$
BEGIN
    -- Check if github_id column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'repositories' 
        AND column_name = 'github_id' 
        AND is_nullable = 'NO'
    ) THEN
        -- Make github_id nullable
        ALTER TABLE repositories ALTER COLUMN github_id DROP NOT NULL;
        RAISE NOTICE 'Made github_id column nullable';
    END IF;
END $$;

-- Add owner column if it doesn't exist
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS owner TEXT;

-- Add other missing columns if they don't exist
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS url TEXT;

-- Update existing records to populate missing fields
UPDATE repositories 
SET 
    owner = COALESCE(owner, split_part(COALESCE(full_name, ''), '/', 1)),
    name = COALESCE(name, split_part(COALESCE(full_name, ''), '/', 2))
WHERE owner IS NULL OR name IS NULL;

-- Verify the fix worked
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'repositories' 
ORDER BY column_name;