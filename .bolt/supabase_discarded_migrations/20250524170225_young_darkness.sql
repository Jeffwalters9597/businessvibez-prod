/*
  # Initial schema for Business Vibez Marketing

  1. New Tables
    - `profiles` - Extended user profile information
    - `qr_codes` - QR code data with metadata
    - `ad_designs` - Ad designs with content and template data
    - `sms_campaigns` - SMS campaign information
    - `contacts` - Customer contact information for SMS campaigns
    - `contact_groups` - Grouping for contacts
    - `group_contacts` - Junction table for contacts in groups

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
*/

-- Create profiles table to store user profile information
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  business_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create QR codes table
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  background_color TEXT DEFAULT '#FFFFFF',
  foreground_color TEXT DEFAULT '#000000',
  logo_image TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create ad designs table
CREATE TABLE IF NOT EXISTS ad_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  template_id TEXT,
  background TEXT DEFAULT '#FFFFFF',
  content JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, phone)
);

-- Create contact groups table
CREATE TABLE IF NOT EXISTS contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create junction table for contacts in groups
CREATE TABLE IF NOT EXISTS group_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES contact_groups(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(group_id, contact_id)
);

-- Create SMS campaigns table
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  group_id UUID REFERENCES contact_groups(id),
  scheduled_date TIMESTAMPTZ,
  sent_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create table for SMS message logs
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  to_number TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  external_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create policies for QR codes
CREATE POLICY "Users can view their own QR codes"
  ON qr_codes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own QR codes"
  ON qr_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own QR codes"
  ON qr_codes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own QR codes"
  ON qr_codes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for ad designs
CREATE POLICY "Users can view their own ad designs"
  ON ad_designs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ad designs"
  ON ad_designs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ad designs"
  ON ad_designs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ad designs"
  ON ad_designs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for contacts
CREATE POLICY "Users can view their own contacts"
  ON contacts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
  ON contacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON contacts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON contacts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for contact groups
CREATE POLICY "Users can view their own contact groups"
  ON contact_groups
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contact groups"
  ON contact_groups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contact groups"
  ON contact_groups
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact groups"
  ON contact_groups
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for group contacts junction table
CREATE POLICY "Users can view their own group contacts"
  ON group_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contact_groups 
      WHERE contact_groups.id = group_contacts.group_id 
      AND contact_groups.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own group contacts"
  ON group_contacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contact_groups 
      WHERE contact_groups.id = group_contacts.group_id 
      AND contact_groups.user_id = auth.uid()
    )
  );

-- Create policies for SMS campaigns
CREATE POLICY "Users can view their own SMS campaigns"
  ON sms_campaigns
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own SMS campaigns"
  ON sms_campaigns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SMS campaigns"
  ON sms_campaigns
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SMS campaigns"
  ON sms_campaigns
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for SMS messages
CREATE POLICY "Users can view their own SMS messages"
  ON sms_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own SMS messages"
  ON sms_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to create profile after user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, business_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'business_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();