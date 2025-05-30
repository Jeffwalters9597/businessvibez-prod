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

-- Try to create the ad_videos bucket if it doesn't exist using INSERT instead of functions
-- This avoids permission issues with storage.create_bucket()
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('ad_videos', 'ad_videos', true) 
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  -- If we don't have permission to insert directly, we'll catch the error and continue
  RAISE NOTICE 'Could not create ad_videos bucket: %', SQLERRM;
END $$;

-- Add indexes to improve query performance
DO $$
BEGIN
  -- Create an index on video_url if we successfully added the column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_designs' AND column_name = 'video_url'
  ) THEN
    -- Check if index already exists first
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'ad_designs' AND indexname = 'ad_designs_video_url_idx'
    ) THEN
      CREATE INDEX ad_designs_video_url_idx ON ad_designs(video_url) WHERE video_url IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Provide a safe way to clean up any orphaned video entries if needed
-- This is a utility function that can be called manually if needed
CREATE OR REPLACE FUNCTION cleanup_orphaned_video_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update ad_designs to null out video_url where the referenced file doesn't exist
  -- This is a safe operation that just cleans metadata
  UPDATE ad_designs
  SET video_url = NULL
  WHERE video_url IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'ad_videos' 
    AND storage.foldername(name) || '/' || storage.filename(name) = ad_designs.video_url
  );
END;
$$;

-- Add a comment explaining the migration
COMMENT ON TABLE ad_designs IS 'Stores ad design information including references to images and videos';