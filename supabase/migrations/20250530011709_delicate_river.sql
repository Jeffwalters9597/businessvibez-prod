/*
  # Add video support to ad_designs

  1. Changes
    - Add `video_url` column to `ad_designs` table to store video file URLs
    - Create new storage bucket for ad videos with appropriate permissions
  
  2. Security
    - Add policies to ensure users can only manage their own videos
    - Enable public read access for videos to support ad viewing
*/

-- Add video_url column to ad_designs if it doesn't exist
ALTER TABLE IF EXISTS ad_designs 
ADD COLUMN IF NOT EXISTS video_url text;

-- Create storage bucket for ad videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad_videos', 'ad_videos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage buckets (if not already)
ALTER POLICY "Authenticated users can upload images"
ON storage.objects
USING (bucket_id IN ('ad_images', 'ad_videos') AND owner = auth.uid());

-- Add policies for video storage
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ad_videos'
  AND owner = auth.uid()
)
ON CONFLICT DO NOTHING;

CREATE POLICY "Authenticated users can update their videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ad_videos'
  AND owner = auth.uid()
)
ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ad_videos')
ON CONFLICT DO NOTHING;

CREATE POLICY "Users can delete their own videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ad_videos'
  AND owner = auth.uid()
)
ON CONFLICT DO NOTHING;

-- Comment the changes
COMMENT ON COLUMN ad_designs.video_url IS 'URL to the uploaded video file for video-based ads';