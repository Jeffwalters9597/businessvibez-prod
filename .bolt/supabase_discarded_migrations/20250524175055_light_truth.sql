/*
  # Clean database setup
  
  1. Changes
    - Drop existing triggers, functions, and policies
    - Create all tables with proper constraints
    - Enable RLS on all tables
    - Create indexes for performance
    - Create new policies
    - Create helper functions
    - Set up triggers
    - Insert default subscription tiers
*/

-- First drop triggers that depend on the function
DROP TRIGGER IF EXISTS update_qr_codes_updated_at ON qr_codes;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_ad_spaces_updated_at ON ad_spaces;
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS update_contact_groups_updated_at ON contact_groups;
DROP TRIGGER IF EXISTS update_sms_campaigns_updated_at ON sms_campaigns;
DROP TRIGGER IF EXISTS update_ad_designs_updated_at ON ad_designs;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view subscription tiers" ON subscription_tiers;
DROP POLICY IF EXISTS "Users can view their own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can create their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can manage their own contact groups" ON contact_groups;
DROP POLICY IF EXISTS "Users can manage their own group contacts" ON group_contacts;
DROP POLICY IF EXISTS "Users can manage their own SMS campaigns" ON sms_campaigns;
DROP POLICY IF EXISTS "Users can manage their own SMS messages" ON sms_messages;
DROP POLICY IF EXISTS "Users can manage their own ad spaces" ON ad_spaces;
DROP POLICY IF EXISTS "Users can manage their own ad designs" ON ad_designs;
DROP POLICY IF EXISTS "Users can manage their own QR codes" ON qr_codes;

-- Now we can safely drop the functions
DROP FUNCTION IF EXISTS create_user_profile(uuid, text, text);
DROP FUNCTION IF EXISTS increment_ad_space_views(uuid);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Create tables
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  business_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL,
  features jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  tier_id uuid REFERENCES subscription_tiers ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, phone)
);

CREATE TABLE IF NOT EXISTS contact_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES contact_groups ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, contact_id)
);

CREATE TABLE IF NOT EXISTS sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  group_id uuid REFERENCES contact_groups,
  scheduled_date timestamptz,
  sent_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES sms_campaigns ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts ON DELETE SET NULL,
  to_number text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  external_id text,
  sent_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content jsonb DEFAULT '{}'::jsonb,
  theme jsonb DEFAULT '{}'::jsonb,
  views integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  template_id text,
  background text DEFAULT '#FFFFFF',
  content jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  design jsonb DEFAULT '{}'::jsonb,
  scans integer DEFAULT 0,
  ad_space_id uuid REFERENCES ad_spaces ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id);
CREATE INDEX IF NOT EXISTS contact_groups_user_id_idx ON contact_groups(user_id);
CREATE INDEX IF NOT EXISTS sms_campaigns_user_id_idx ON sms_campaigns(user_id);
CREATE INDEX IF NOT EXISTS ad_spaces_user_id_idx ON ad_spaces(user_id);
CREATE INDEX IF NOT EXISTS qr_codes_user_id_idx ON qr_codes(user_id);
CREATE INDEX IF NOT EXISTS qr_codes_ad_space_id_idx ON qr_codes(ad_space_id);

-- Create RLS policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT TO public USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can view subscription tiers" ON subscription_tiers
  FOR SELECT TO public USING (true);

CREATE POLICY "Users can view their own subscription" ON user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts" ON contacts
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own contacts" ON contacts
  FOR SELECT TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts" ON contacts
  FOR UPDATE TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts" ON contacts
  FOR DELETE TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own contact groups" ON contact_groups
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own group contacts" ON group_contacts
  FOR ALL TO public USING (
    EXISTS (
      SELECT 1 FROM contact_groups
      WHERE contact_groups.id = group_contacts.group_id
      AND contact_groups.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own SMS campaigns" ON sms_campaigns
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own SMS messages" ON sms_messages
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own ad spaces" ON ad_spaces
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own ad designs" ON ad_designs
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own QR codes" ON qr_codes
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create helper functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_ad_space_views(space_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE ad_spaces
  SET views = views + 1,
      updated_at = now()
  WHERE id = space_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user profile function
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id uuid,
  business_name text,
  subscription_tier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier_id uuid;
BEGIN
  -- Input validation
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;

  IF business_name IS NULL OR business_name = '' THEN
    RAISE EXCEPTION 'Business name cannot be empty';
  END IF;

  IF subscription_tier NOT IN ('free', 'premium') THEN
    RAISE EXCEPTION 'Subscription tier must be either free or premium';
  END IF;

  -- Get the subscription tier ID
  SELECT id INTO tier_id
  FROM subscription_tiers
  WHERE LOWER(name) = LOWER(subscription_tier)
  LIMIT 1;

  IF tier_id IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription tier';
  END IF;

  -- Create profile and subscription
  INSERT INTO profiles (id, business_name)
  VALUES (user_id, business_name);

  INSERT INTO user_subscriptions (
    user_id,
    tier_id,
    status,
    current_period_end
  )
  VALUES (
    user_id,
    tier_id,
    'active',
    CASE 
      WHEN subscription_tier = 'free' THEN now() + interval '100 years'
      ELSE now() + interval '1 month'
    END
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Profile already exists for this user';
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Invalid user ID or subscription tier';
  WHEN others THEN
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
END;
$$;

-- Create update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_groups_updated_at
  BEFORE UPDATE ON contact_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_campaigns_updated_at
  BEFORE UPDATE ON sms_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ad_spaces_updated_at
  BEFORE UPDATE ON ad_spaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ad_designs_updated_at
  BEFORE UPDATE ON ad_designs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qr_codes_updated_at
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, price, features) VALUES
  ('Free', 0, '[
    "5 QR codes per month",
    "Basic ad templates",
    "100 SMS credits/month",
    "Email support"
  ]'),
  ('Premium', 2900, '[
    "Unlimited QR codes",
    "Premium ad templates",
    "1000 SMS credits/month",
    "Priority support",
    "Custom branding",
    "Advanced analytics",
    "API access"
  ]');