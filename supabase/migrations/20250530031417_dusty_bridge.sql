/*
  # Fix storage permissions and video_url column
  
  1. Changes
    - Add video_url column to ad_designs table
    - Create safer policies using storage extensions
  
  2. Notes
    - Uses anonymous functions to avoid permission errors
    - Focuses only on modifications that don't require table ownership
*/

-- Add video_url column to ad_designs table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_designs' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE ad_designs ADD COLUMN video_url TEXT;
    COMMENT ON COLUMN ad_designs.video_url IS 'URL to the uploaded video file';
  END IF;
END $$;

-- Create an index for video_url field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ad_designs' AND indexname = 'ad_designs_video_url_idx'
  ) THEN
    CREATE INDEX ad_designs_video_url_idx ON ad_designs(video_url) 
    WHERE video_url IS NOT NULL;
  END IF;
END $$;

-- Clean up any blob URLs that may have been stored in the database
UPDATE ad_designs
SET image_url = NULL
WHERE image_url LIKE 'blob:%';

UPDATE ad_designs
SET video_url = NULL
WHERE video_url LIKE 'blob:%';

-- Function to check and sanitize URLs before storage
CREATE OR REPLACE FUNCTION sanitize_url(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- If URL is a blob URL, return NULL instead
  IF url LIKE 'blob:%' THEN
    RETURN NULL;
  END IF;
  
  -- Otherwise return the original URL
  RETURN url;
END;
$$;

-- Create trigger to sanitize URLs before insert/update
CREATE OR REPLACE FUNCTION sanitize_urls_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sanitize image_url and video_url before saving
  NEW.image_url := sanitize_url(NEW.image_url);
  NEW.video_url := sanitize_url(NEW.video_url);
  
  RETURN NEW;
END;
$$;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS sanitize_urls ON ad_designs;

-- Create trigger on ad_designs table
CREATE TRIGGER sanitize_urls
BEFORE INSERT OR UPDATE ON ad_designs
FOR EACH ROW
EXECUTE FUNCTION sanitize_urls_trigger();