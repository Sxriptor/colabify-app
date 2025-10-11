-- Debug script to see the actual repositories table structure
-- Run this first to understand what we're working with

-- Check if repositories table exists and show all columns
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'repositories' 
ORDER BY column_name;

-- Show all constraints on the repositories table
SELECT 
    tc.constraint_name, 
    tc.constraint_type, 
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'repositories'
ORDER BY tc.constraint_type, kcu.column_name;

-- Show sample data if any exists
SELECT * FROM repositories LIMIT 5;