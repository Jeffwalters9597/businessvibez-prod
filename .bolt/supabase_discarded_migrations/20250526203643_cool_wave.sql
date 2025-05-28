/*
  # Add QR codes table and policies

  1. New Tables
    - `qr_codes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `url` (text)
      - `design` (jsonb)
      - `scans` (integer)
      - `ad_space_id` (uuid, references ad_spaces)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create QR codes table
CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  design jsonb DEFAULT '{}'::jsonb,
  scans integer DEFAULT 0,
  ad_space_id uuid REFERENCES ad_spaces(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

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

-- Create updated_at trigger
CREATE TRIGGER update_qr_codes_updated_at
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();