-- Add comment on the ad_designs table to explain video_url column
COMMENT ON TABLE ad_designs IS 'Stores ad design information including references to images and videos';
COMMENT ON COLUMN ad_designs.video_url IS 'URL to the uploaded video file for video-based ads';

-- Ensure the video_url column exists
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

-- Clean up any blob URLs that may have been stored in the database
UPDATE ad_designs
SET image_url = NULL
WHERE image_url IS NOT NULL AND (image_url LIKE 'blob:%' OR image_url = '');

UPDATE ad_designs
SET video_url = NULL
WHERE video_url IS NOT NULL AND (video_url LIKE 'blob:%' OR video_url = '');

-- Function to check and sanitize URLs before storage
CREATE OR REPLACE FUNCTION sanitize_url(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- If URL is null, return null
  IF url IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- If URL is a blob URL, return NULL instead
  IF url LIKE 'blob:%' THEN
    RETURN NULL;
  END IF;
  
  -- If URL is empty, return null
  IF url = '' THEN
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
  -- Sanitize image_url if it exists in the NEW record
  IF NEW.image_url IS NOT NULL THEN
    NEW.image_url := sanitize_url(NEW.image_url);
  END IF;
  
  -- Sanitize video_url if it exists in the NEW record
  IF NEW.video_url IS NOT NULL THEN
    NEW.video_url := sanitize_url(NEW.video_url);
  END IF;
  
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

-- Add comment explaining the trigger purpose
COMMENT ON TRIGGER sanitize_urls ON ad_designs IS 'Prevents blob URLs and ensures consistent URL formatting';