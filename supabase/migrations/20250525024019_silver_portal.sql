/*
  # Add public read access to ad spaces
  
  1. Changes
    - Add policy to allow public read access to ad spaces
    - This enables unauthenticated users to view ad spaces
    
  2. Security
    - Only allows SELECT operations
    - No modification of data is permitted
*/

-- Add policy for public read access to ad spaces
CREATE POLICY "Anyone can view ad spaces"
  ON ad_spaces
  FOR SELECT
  TO public
  USING (true);

-- Add comment explaining the policy
COMMENT ON POLICY "Anyone can view ad spaces" ON ad_spaces IS 
  'Allows anyone to view ad spaces, required for QR code redirects and public ad viewing';