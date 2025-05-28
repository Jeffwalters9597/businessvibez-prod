/*
  # Rename template_id column to template

  1. Changes
    - Rename `template_id` column to `template` in `ad_designs` table to match the application code
    
  2. Notes
    - This change ensures compatibility with the existing application code
    - No data loss will occur as this is just a column rename
*/

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'ad_designs' 
    AND column_name = 'template_id'
  ) THEN
    ALTER TABLE ad_designs RENAME COLUMN template_id TO template;
  END IF;
END $$;