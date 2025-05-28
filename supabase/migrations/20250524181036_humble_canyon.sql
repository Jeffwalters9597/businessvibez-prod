/*
  # Initial Database Setup

  1. Tables
    - profiles: User profiles with business information
    - subscription_tiers: Available subscription plans
    - user_subscriptions: User subscription records
    - user_usage_limits: Track usage limits per user
    - verified_phones: Store verified phone numbers
    - verification_codes: Store verification codes
    - verification_attempts: Track verification attempts
    - usage_logs: Track feature usage

  2. Security
    - Enable RLS on all tables
    - Add policies for user data access
    - Create security definer functions

  3. Functions
    - create_user_profile: Create new user profile with subscription
    - verify_phone: Verify phone numbers
    - check_usage_limits: Check and update usage limits
    - create_verification_code: Generate verification codes
    - verify_code: Verify codes for email/phone
*/

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

CREATE TABLE IF NOT EXISTS user_usage_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  qr_codes_count integer DEFAULT 0,
  sms_count integer DEFAULT 0,
  api_calls_count integer DEFAULT 0,
  reset_date timestamptz DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verified_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  phone text NOT NULL,
  verified_at timestamptz DEFAULT now(),
  UNIQUE(user_id, phone)
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  code text NOT NULL,
  type text NOT NULL CHECK (type IN ('email', 'phone')),
  identifier text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  attempt_count integer DEFAULT 1,
  last_attempt timestamptz DEFAULT now(),
  locked_until timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can view their own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage limits"
  ON user_usage_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own verified phones"
  ON verified_phones FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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

-- Create helper functions
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

  -- Initialize usage limits
  INSERT INTO user_usage_limits (
    user_id,
    qr_codes_count,
    sms_count,
    api_calls_count
  )
  VALUES (
    user_id,
    0,
    0,
    0
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

-- Function to verify phone number
CREATE OR REPLACE FUNCTION verify_phone(
  user_id uuid,
  phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO verified_phones (user_id, phone)
  VALUES (verify_phone.user_id, verify_phone.phone)
  ON CONFLICT (user_id, phone) DO NOTHING;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limits(
  user_id uuid,
  action text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_tier text;
  current_usage integer;
  is_allowed boolean;
BEGIN
  -- Get user's subscription tier
  SELECT name INTO user_tier
  FROM subscription_tiers st
  JOIN user_subscriptions us ON us.tier_id = st.id
  WHERE us.user_id = check_usage_limits.user_id
  AND us.status = 'active';

  -- Premium users have no limits
  IF user_tier = 'Premium' THEN
    RETURN true;
  END IF;

  -- Check specific limits for free tier
  CASE action
    WHEN 'create_qr_code' THEN
      SELECT qr_codes_count INTO current_usage
      FROM user_usage_limits
      WHERE user_id = check_usage_limits.user_id;
      
      is_allowed := COALESCE(current_usage, 0) < 5;
      
    WHEN 'send_sms' THEN
      SELECT sms_count INTO current_usage
      FROM user_usage_limits
      WHERE user_id = check_usage_limits.user_id;
      
      is_allowed := COALESCE(current_usage, 0) < 100;
      
    ELSE
      is_allowed := false;
  END CASE;

  -- Log the usage attempt
  INSERT INTO usage_logs (user_id, action)
  VALUES (check_usage_limits.user_id, action);

  -- Update usage count if allowed
  IF is_allowed THEN
    UPDATE user_usage_limits
    SET
      qr_codes_count = CASE 
        WHEN action = 'create_qr_code' 
        THEN qr_codes_count + 1
        ELSE qr_codes_count
      END,
      sms_count = CASE 
        WHEN action = 'send_sms' 
        THEN sms_count + 1
        ELSE sms_count
      END,
      updated_at = now()
    WHERE user_id = check_usage_limits.user_id;
  END IF;

  RETURN is_allowed;
END;
$$;

-- Function to create verification code
CREATE OR REPLACE FUNCTION create_verification_code(
  user_id uuid,
  type text,
  identifier text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  verification_code text;
BEGIN
  -- Generate 6-digit code
  SELECT array_to_string(ARRAY(
    SELECT chr((48 + round(random() * 9))::integer)
    FROM generate_series(1,6)
  ), '') INTO verification_code;
  
  -- Store the code
  INSERT INTO verification_codes (user_id, code, type, identifier)
  VALUES (user_id, verification_code, type, identifier)
  ON CONFLICT (user_id, type) 
  DO UPDATE SET 
    code = EXCLUDED.code,
    identifier = EXCLUDED.identifier,
    expires_at = now() + interval '15 minutes';
  
  RETURN verification_code;
END;
$$;

-- Function to verify code
CREATE OR REPLACE FUNCTION verify_code(
  user_id uuid,
  verification_code text,
  type text,
  identifier text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_record record;
BEGIN
  -- Get and validate code
  SELECT * INTO code_record
  FROM verification_codes
  WHERE verification_codes.user_id = verify_code.user_id
    AND verification_codes.type = verify_code.type
    AND verification_codes.code = verify_code.verification_code
    AND verification_codes.expires_at > now();
    
  IF code_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- Handle verification based on type
  CASE type
    WHEN 'phone' THEN
      INSERT INTO verified_phones (user_id, phone)
      VALUES (user_id, identifier)
      ON CONFLICT (user_id, phone) DO NOTHING;
  END CASE;
  
  -- Delete used code
  DELETE FROM verification_codes
  WHERE verification_codes.id = code_record.id;
  
  RETURN true;
END;
$$;