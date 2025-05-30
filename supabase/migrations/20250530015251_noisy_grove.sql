-- Use storage extension functions to create buckets and policies
-- This avoids direct table modifications that require ownership privileges

-- Create ad_images bucket if it doesn't exist
SELECT storage.create_bucket('ad_images', {'public': 'true'});

-- Create public bucket if it doesn't exist (for backward compatibility)
SELECT storage.create_bucket('public', {'public': 'true'});

-- Create policies for image storage
-- Add policy for uploads
SELECT storage.create_policy(
  'ad_images', 
  'authenticated users can upload',
  'INSERT',
  'authenticated',
  storage.foldername(name) = '' AND auth.uid()::text = owner
);

-- Add policy for reads
SELECT storage.create_policy(
  'ad_images', 
  'anyone can view',
  'SELECT',
  'public',
  true
);

-- Add policy for updates
SELECT storage.create_policy(
  'ad_images', 
  'authenticated users can update',
  'UPDATE',
  'authenticated',
  auth.uid()::text = owner
);

-- Add policy for deletes
SELECT storage.create_policy(
  'ad_images', 
  'authenticated users can delete',
  'DELETE',
  'authenticated',
  auth.uid()::text = owner
);

-- Create policies for public bucket
-- Add policy for uploads
SELECT storage.create_policy(
  'public', 
  'authenticated users can upload',
  'INSERT',
  'authenticated',
  storage.foldername(name) = '' AND auth.uid()::text = owner
);

-- Add policy for reads
SELECT storage.create_policy(
  'public', 
  'anyone can view',
  'SELECT',
  'public',
  true
);

-- Add policy for updates
SELECT storage.create_policy(
  'public', 
  'authenticated users can update',
  'UPDATE',
  'authenticated',
  auth.uid()::text = owner
);

-- Add policy for deletes
SELECT storage.create_policy(
  'public', 
  'authenticated users can delete',
  'DELETE',
  'authenticated',
  auth.uid()::text = owner
);

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

-- Try to delete the ad_videos bucket if it exists
DO $$
BEGIN
  -- Storage API function to delete a bucket
  PERFORM storage.delete_bucket('ad_videos');
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if bucket doesn't exist or can't be deleted
  RAISE NOTICE 'Could not delete ad_videos bucket: %', SQLERRM;
END $$;