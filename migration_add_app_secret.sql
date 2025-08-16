-- Migration: Add app_secret column to user_business_info table
-- This allows each user to have their own Meta app secret for webhook signature verification

-- Add app_secret column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_business_info' 
        AND column_name = 'app_secret'
    ) THEN
        ALTER TABLE user_business_info 
        ADD COLUMN app_secret TEXT;
        
        RAISE NOTICE '✅ Added app_secret column to user_business_info table';
    ELSE
        RAISE NOTICE '✅ app_secret column already exists in user_business_info table';
        
    END IF;
END $$;

-- Add comment for the new column
COMMENT ON COLUMN user_business_info.app_secret IS 'Meta App Secret for webhook signature verification';

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_business_info' 
AND column_name = 'app_secret';