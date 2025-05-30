/*
  # Add video_url column to ad_designs table

  1. Changes
    - Add 'video_url' column to the 'ad_designs' table of type TEXT (nullable)
    
  2. Purpose
    - Enables storage of video URLs for ad designs
    - Fixes the error "Could not find the 'video_url' column of 'ad_designs' in the schema cache"
    - Ensures compatibility with the AdBuilder component that needs this column
*/

-- Add video_url column to ad_designs table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_designs' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE ad_designs ADD COLUMN video_url TEXT;
  END IF;
END $$;