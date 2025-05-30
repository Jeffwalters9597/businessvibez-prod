-- Remove video_url column from ad_designs table
ALTER TABLE IF EXISTS ad_designs DROP COLUMN IF EXISTS video_url;

-- Delete any existing video storage bucket policies
DO $$
BEGIN
  -- Try to delete policies for the ad_videos bucket
  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist, continue
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can update their videos" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist, continue
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist, continue
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete their own videos" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN
    -- Policy might not exist, continue
  END;
  
  -- Modify any existing policy that might reference 'ad_videos'
  -- Find policies that reference both ad_images and ad_videos in bucket_id
  BEGIN
    -- First get a list of all storage policies
    FOR policy_record IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
      -- Check if the policy references 'ad_videos'
      EXECUTE format('
        SELECT EXISTS (
          SELECT 1 
          FROM pg_policy 
          WHERE polname = %L 
            AND pg_get_expr(polqual, pg_policy.polrelid) LIKE %%ad_videos%%
        )', policy_record.policyname) INTO has_video_reference;
      
      -- If it does, try to update it
      IF has_video_reference THEN
        BEGIN
          EXECUTE format('
            ALTER POLICY %I ON storage.objects
            USING (bucket_id = ''ad_images'')
          ', policy_record.policyname);
        EXCEPTION WHEN OTHERS THEN
          -- Failed to update, we'll drop and recreate instead
          BEGIN
            EXECUTE format('DROP POLICY %I ON storage.objects', policy_record.policyname);
          EXCEPTION WHEN OTHERS THEN
            -- Policy might not exist anymore, continue
          END;
        END;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- Error in policy management, continue
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