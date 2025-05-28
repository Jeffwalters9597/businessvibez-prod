/*
  # Fix QR code relationships

  1. Changes
    - Add ad_space_id to qr_codes table
    - Create foreign key relationship between qr_codes and ad_spaces
    - Add RLS policies for proper access control

  2. Security
    - Enable RLS on qr_codes table
    - Add policy for authenticated users to manage their QR codes
*/

-- Add ad_space_id to qr_codes if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'qr_codes' AND column_name = 'ad_space_id'
  ) THEN
    ALTER TABLE qr_codes 
    ADD COLUMN ad_space_id uuid REFERENCES ad_spaces(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- Create or replace RLS policies
DROP POLICY IF EXISTS "Users can manage their own QR codes" ON qr_codes;
CREATE POLICY "Users can manage their own QR codes"
  ON qr_codes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create index for better performance
CREATE INDEX IF NOT EXISTS qr_codes_ad_space_id_idx ON qr_codes(ad_space_id);