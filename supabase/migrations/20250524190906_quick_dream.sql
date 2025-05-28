/*
  # QR Code and Ad Space Integration

  1. New Tables
    - `qr_code_scans`
      - `id` (uuid, primary key)
      - `qr_code_id` (uuid, foreign key to qr_codes)
      - `ad_space_id` (uuid, foreign key to ad_spaces)
      - `ip_address` (text)
      - `user_agent` (text)
      - `scanned_at` (timestamp)
      - `location` (jsonb)

  2. Functions
    - `increment_qr_code_scans`: Increments scan count and logs scan details
    - `increment_ad_space_views`: Increments view count for ad spaces

  3. Changes
    - Add scan tracking to QR codes
    - Add view tracking to ad spaces
    - Add RLS policies for scan data
*/

-- Create QR code scans table
CREATE TABLE IF NOT EXISTS qr_code_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid REFERENCES qr_codes(id) ON DELETE CASCADE,
  ad_space_id uuid REFERENCES ad_spaces(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  location jsonb DEFAULT '{}'::jsonb,
  scanned_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE qr_code_scans ENABLE ROW LEVEL SECURITY;

-- RLS policies for qr_code_scans
CREATE POLICY "Users can view their own QR code scans"
  ON qr_code_scans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM qr_codes
      WHERE qr_codes.id = qr_code_scans.qr_code_id
      AND qr_codes.user_id = auth.uid()
    )
  );

-- Function to increment QR code scans
CREATE OR REPLACE FUNCTION increment_qr_code_scans(
  qr_id uuid,
  ad_id uuid,
  ip text DEFAULT NULL,
  agent text DEFAULT NULL,
  loc jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert scan record
  INSERT INTO qr_code_scans (
    qr_code_id,
    ad_space_id,
    ip_address,
    user_agent,
    location
  ) VALUES (
    qr_id,
    ad_id,
    ip,
    agent,
    loc
  );

  -- Update QR code scan count
  UPDATE qr_codes
  SET scans = scans + 1
  WHERE id = qr_id;
END;
$$;

-- Function to increment ad space views
CREATE OR REPLACE FUNCTION increment_ad_space_views(space_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ad_spaces
  SET views = views + 1
  WHERE id = space_id;
END;
$$;