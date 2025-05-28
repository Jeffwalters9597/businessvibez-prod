/*
  # Add relationship between ad_designs and ad_spaces

  1. Changes
    - Add `ad_space_id` column to `ad_designs` table
    - Add foreign key constraint to link `ad_designs` to `ad_spaces`
    
  2. Security
    - No changes to RLS policies needed as they are already in place
*/

-- Add ad_space_id column to ad_designs if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ad_designs' 
    AND column_name = 'ad_space_id'
  ) THEN
    ALTER TABLE ad_designs 
    ADD COLUMN ad_space_id uuid REFERENCES ad_spaces(id) ON DELETE SET NULL;
  END IF;
END $$;