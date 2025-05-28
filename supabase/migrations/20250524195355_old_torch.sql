/*
  # Fix ad design persistence

  1. Changes
    - Add user_id foreign key to ad_designs table
    - Enable RLS on ad_designs table
    - Add RLS policies for ad_designs
*/

-- Add user_id foreign key if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ad_designs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE ad_designs 
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE ad_designs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own ad designs"
  ON ad_designs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add created_at and updated_at if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ad_designs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ad_designs 
    ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ad_designs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ad_designs 
    ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;