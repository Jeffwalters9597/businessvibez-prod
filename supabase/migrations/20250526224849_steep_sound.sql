/*
  # Add INSERT policy for ad_spaces table

  1. Security Changes
    - Add INSERT policy to allow authenticated users to create their own ad spaces
    - Policy ensures users can only create ad spaces with their own user_id

  Note: This complements existing policies while fixing the RLS violation
*/

-- Add INSERT policy for authenticated users
CREATE POLICY "Users can create their own ad spaces" 
ON ad_spaces
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);