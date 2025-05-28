/*
  # Add image storage support

  1. Storage Buckets
    - Create ad_images bucket for storing user-uploaded images
    - Set up public access policies
  
  2. Security
    - Enable RLS on storage
    - Add policies for authenticated users
*/

-- Create storage bucket for ad images
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad_images', 'ad_images', true);

-- Enable RLS on bucket
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ad_images'
  AND owner = auth.uid()
);

CREATE POLICY "Authenticated users can update their images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ad_images'
  AND owner = auth.uid()
);

CREATE POLICY "Anyone can view images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ad_images');

CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ad_images'
  AND owner = auth.uid()
);

-- Add image_url column to ad_designs
ALTER TABLE ad_designs
ADD COLUMN IF NOT EXISTS image_url text;