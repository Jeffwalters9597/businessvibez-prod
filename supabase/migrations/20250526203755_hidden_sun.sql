/*
  # QR Codes Table Setup

  1. New Table
    - Create QR codes table with basic fields
    - Add ad_space_id column for linking to ad spaces
    
  2. Security
    - Enable RLS
    - Add policy for authenticated users
    
  3. Performance
    - Add indexes for user_id and ad_space_id
    - Add updated_at trigger
*/

-- Create QR codes table
CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  design jsonb DEFAULT '{}'::jsonb,
  scans integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add ad_space_id column separately
ALTER TABLE qr_codes
ADD COLUMN ad_space_id uuid REFERENCES ad_spaces(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own QR codes"
  ON qr_codes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS qr_codes_user_id_idx ON qr_codes(user_id);
CREATE INDEX IF NOT EXISTS qr_codes_ad_space_id_idx ON qr_codes(ad_space_id);

-- Create updated_at trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_qr_codes_updated_at'
  ) THEN
    CREATE TRIGGER update_qr_codes_updated_at
      BEFORE UPDATE ON qr_codes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;