/*
  # Ad Spaces and Designs Schema

  1. New Tables
    - `ad_spaces`: For storing ad landing pages
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `title` (text)
      - `description` (text)
      - `content` (jsonb)
      - `theme` (jsonb)
      - `views` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `ad_designs`: For storing ad templates and designs
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `name` (text)
      - `template_id` (text)
      - `background` (text)
      - `content` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add `ad_space_id` column to `qr_codes` table
    - Create indexes for performance
    - Enable RLS and add policies
    - Add updated_at trigger
*/

-- Create ad_spaces table
CREATE TABLE IF NOT EXISTS ad_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content jsonb DEFAULT '{}'::jsonb,
  theme jsonb DEFAULT '{}'::jsonb,
  views integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ad_designs table
CREATE TABLE IF NOT EXISTS ad_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_id text,
  background text DEFAULT '#FFFFFF',
  content jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add ad_space_id to qr_codes
ALTER TABLE qr_codes
ADD COLUMN IF NOT EXISTS ad_space_id uuid REFERENCES ad_spaces(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS ad_spaces_user_id_idx ON ad_spaces(user_id);
CREATE INDEX IF NOT EXISTS qr_codes_ad_space_id_idx ON qr_codes(ad_space_id);

-- Enable RLS
ALTER TABLE ad_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_designs ENABLE ROW LEVEL SECURITY;

-- Policies for ad_spaces
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can manage own ad spaces' 
        AND tablename = 'ad_spaces'
    ) THEN
        CREATE POLICY "Users can manage own ad spaces"
          ON ad_spaces FOR ALL TO authenticated
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can read own ad spaces' 
        AND tablename = 'ad_spaces'
    ) THEN
        CREATE POLICY "Users can read own ad spaces"
          ON ad_spaces FOR SELECT TO authenticated
          USING (auth.uid() = user_id);
    END IF;
END$$;

-- Policies for ad_designs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can create their own ad designs' 
        AND tablename = 'ad_designs'
    ) THEN
        CREATE POLICY "Users can create their own ad designs"
          ON ad_designs FOR INSERT TO public
          WITH CHECK (auth.uid() = user_id);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can delete their own ad designs' 
        AND tablename = 'ad_designs'
    ) THEN
        CREATE POLICY "Users can delete their own ad designs"
          ON ad_designs FOR DELETE TO public
          USING (auth.uid() = user_id);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can update their own ad designs' 
        AND tablename = 'ad_designs'
    ) THEN
        CREATE POLICY "Users can update their own ad designs"
          ON ad_designs FOR UPDATE TO public
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can view their own ad designs' 
        AND tablename = 'ad_designs'
    ) THEN
        CREATE POLICY "Users can view their own ad designs"
          ON ad_designs FOR SELECT TO public
          USING (auth.uid() = user_id);
    END IF;
END$$;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_ad_spaces_updated_at'
    ) THEN
        CREATE TRIGGER update_ad_spaces_updated_at
          BEFORE UPDATE ON ad_spaces
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;