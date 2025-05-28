/*
  # Add function to increment ad space views
  
  1. Changes
    - Creates a function to safely increment ad space view counts
    - Grants execute permission to public role
  
  2. Security
    - Function runs with SECURITY DEFINER to ensure proper access
    - Limited to updating only the views and updated_at columns
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS increment_ad_space_views(uuid);

-- Create function to increment ad space views
CREATE OR REPLACE FUNCTION increment_ad_space_views(space_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE ad_spaces
  SET views = views + 1,
      updated_at = now()
  WHERE id = space_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to public
GRANT EXECUTE ON FUNCTION increment_ad_space_views TO public;