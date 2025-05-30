-- Create ad_images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad_images', 'ad_images', true)
ON CONFLICT (id) DO NOTHING;

-- Create public bucket if it doesn't exist (for backward compatibility)
INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'public', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for image storage if they don't exist
DO $$
BEGIN
  -- Create the upload policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload images'
  ) THEN
    CREATE POLICY "Authenticated users can upload images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id IN ('ad_images', 'public') AND owner = auth.uid()
    );
  END IF;

  -- Create the update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can update their images'
  ) THEN
    CREATE POLICY "Authenticated users can update their images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id IN ('ad_images', 'public') AND owner = auth.uid()
    );
  END IF;

  -- Create the select policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Anyone can view images'
  ) THEN
    CREATE POLICY "Anyone can view images"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id IN ('ad_images', 'public'));
  END IF;

  -- Create the delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own images'
  ) THEN
    CREATE POLICY "Users can delete their own images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id IN ('ad_images', 'public') AND owner = auth.uid()
    );
  END IF;
END $$;

-- Drop video_url column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_designs' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE ad_designs DROP COLUMN video_url;
  END IF;
END $$;

-- Remove ad_videos bucket if it exists
DO $$
BEGIN
  -- First delete any objects in the bucket
  DELETE FROM storage.objects WHERE bucket_id = 'ad_videos';
  
  -- Then delete the bucket
  DELETE FROM storage.buckets WHERE id = 'ad_videos';
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if table doesn't exist
END $$;