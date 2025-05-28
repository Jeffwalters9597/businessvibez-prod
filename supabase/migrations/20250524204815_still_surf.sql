/*
  # Ad Designs Schema Update

  1. New Tables
    - `ad_designs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `template` (text)
      - `background` (text, default '#FFFFFF')
      - `content` (jsonb, default '{}')
      - `image_url` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `ad_designs` table
    - Add policy for authenticated users to manage their own designs

  3. Performance
    - Add indexes for user_id and created_at
    - Add trigger for automatic updated_at updates
*/

-- Create ad_designs table
CREATE TABLE IF NOT EXISTS ad_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  template text,
  background text DEFAULT '#FFFFFF',
  content jsonb DEFAULT '{}'::jsonb,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ad_designs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS "Users can manage their own ad designs" ON ad_designs;
CREATE POLICY "Users can manage their own ad designs"
  ON ad_designs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add indexes
CREATE INDEX IF NOT EXISTS ad_designs_user_id_idx ON ad_designs(user_id);
CREATE INDEX IF NOT EXISTS ad_designs_created_at_idx ON ad_designs(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ad_designs_updated_at ON ad_designs;

CREATE TRIGGER update_ad_designs_updated_at
    BEFORE UPDATE ON ad_designs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();