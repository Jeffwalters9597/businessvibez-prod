-- Remove video_url column from ad_designs table
ALTER TABLE IF EXISTS ad_designs DROP COLUMN IF EXISTS video_url;

-- Delete any existing video storage bucket policies
-- Using simple DROP statements instead of complex loops
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own videos" ON storage.objects;

-- Update any existing policies that reference both ad_images and ad_videos
-- We'll use individual statements for specific known policies instead of loops
DO $$
BEGIN
  -- Update the policy if it exists and contains both buckets
  BEGIN
    ALTER POLICY "Authenticated users can upload images" 
    ON storage.objects
    USING (bucket_id = 'ad_images' AND owner = auth.uid());
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist or have a different definition, ignore errors
  END;

  -- Update any other common policies
  BEGIN
    ALTER POLICY "Anyone can view images" 
    ON storage.objects
    USING (bucket_id = 'ad_images');
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist or have a different definition, ignore errors
  END;

  BEGIN
    ALTER POLICY "Users can delete their own images" 
    ON storage.objects
    USING (bucket_id = 'ad_images' AND owner = auth.uid());
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist or have a different definition, ignore errors
  END;
END $$;

-- Try to delete the ad_videos bucket if it exists
DO $$
BEGIN
  -- First delete any objects in the bucket
  BEGIN
    DELETE FROM storage.objects WHERE bucket_id = 'ad_videos';
  EXCEPTION WHEN OTHERS THEN
    -- Table might not exist or other error, continue
  END;
  
  -- Then delete the bucket
  BEGIN
    DELETE FROM storage.buckets WHERE id = 'ad_videos';
  EXCEPTION WHEN OTHERS THEN
    -- Bucket might not exist or other error, continue
  END;
END $$;

-- Remove comment on video_url column if it exists
DO $$
BEGIN
  EXECUTE 'COMMENT ON COLUMN ad_designs.video_url IS NULL';
  EXCEPTION WHEN OTHERS THEN
    -- Column might not exist or comment might not be set, continue
END $$;