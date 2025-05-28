/*
  # Usage Tracking and Verification System

  1. New Tables
    - user_usage_limits: Track usage limits per user
    - verified_phones: Store verified phone numbers
    - usage_logs: Track usage for rate limiting

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Add security functions for usage checks

  3. Functions
    - check_usage_limits: Verify and update usage limits
    - verify_phone: Handle phone verification
    - reset_monthly_limits: Reset monthly usage counters
*/

-- Track user usage limits
CREATE TABLE IF NOT EXISTS user_usage_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  qr_codes_count integer DEFAULT 0,
  sms_count integer DEFAULT 0,
  api_calls_count integer DEFAULT 0,
  reset_date timestamptz DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Store verified phone numbers
CREATE TABLE IF NOT EXISTS verified_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  phone text NOT NULL,
  verified_at timestamptz DEFAULT now(),
  UNIQUE(user_id, phone)
);

-- Track usage for rate limiting
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policies with existence checks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_usage_limits' 
    AND policyname = 'Users can view their own usage limits'
  ) THEN
    CREATE POLICY "Users can view their own usage limits"
      ON user_usage_limits FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'verified_phones' 
    AND policyname = 'Users can view their own verified phones'
  ) THEN
    CREATE POLICY "Users can view their own verified phones"
      ON verified_phones FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to check and update usage limits
CREATE OR REPLACE FUNCTION check_usage_limits(
  user_id uuid,
  action text
) RETURNS boolean
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
    INSERT INTO user_usage_limits (user_id, qr_codes_count, sms_count)
    VALUES (
      check_usage_limits.user_id,
      CASE WHEN action = 'create_qr_code' THEN 1 ELSE 0 END,
      CASE WHEN action = 'send_sms' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      qr_codes_count = CASE 
        WHEN action = 'create_qr_code' 
        THEN user_usage_limits.qr_codes_count + 1
        ELSE user_usage_limits.qr_codes_count
      END,
      sms_count = CASE 
        WHEN action = 'send_sms' 
        THEN user_usage_limits.sms_count + 1
        ELSE user_usage_limits.sms_count
      END,
      updated_at = now();
  END IF;

  RETURN is_allowed;
END;
$$;

-- Function to verify phone number
CREATE OR REPLACE FUNCTION verify_phone(
  user_id uuid,
  phone text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert verified phone
  INSERT INTO verified_phones (user_id, phone)
  VALUES (verify_phone.user_id, verify_phone.phone)
  ON CONFLICT (user_id, phone) DO NOTHING;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Function to reset monthly limits
CREATE OR REPLACE FUNCTION reset_monthly_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_usage_limits
  SET 
    qr_codes_count = 0,
    sms_count = 0,
    api_calls_count = 0,
    reset_date = date_trunc('month', now()) + interval '1 month',
    updated_at = now()
  WHERE reset_date <= now();
END;
$$;