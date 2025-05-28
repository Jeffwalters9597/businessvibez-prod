/*
  # Add create_user_profile function

  1. New Function
    - `create_user_profile`: Creates a new user profile and sets up initial usage limits
      - Parameters:
        - user_id (uuid): The ID of the user
        - business_name (text): The name of the user's business
        - subscription_tier (text): The selected subscription tier ('free' or 'premium')

  2. Function Details
    - Creates profile record
    - Sets up initial usage limits based on tier
    - Handles transaction management
    - Returns success/failure status
*/

CREATE OR REPLACE FUNCTION create_user_profile(
  user_id uuid,
  business_name text,
  subscription_tier text
) RETURNS void AS $$
DECLARE
  tier_id uuid;
  qr_limit integer;
  sms_limit integer;
  api_limit integer;
BEGIN
  -- Get the subscription tier ID and limits
  IF subscription_tier = 'premium' THEN
    SELECT id INTO tier_id
    FROM subscription_tiers
    WHERE name = 'Premium'
    LIMIT 1;
    
    qr_limit := -1; -- Unlimited
    sms_limit := 1000;
    api_limit := -1; -- Unlimited
  ELSE
    SELECT id INTO tier_id
    FROM subscription_tiers
    WHERE name = 'Free'
    LIMIT 1;
    
    qr_limit := 5;
    sms_limit := 100;
    api_limit := 1000;
  END IF;

  -- Create the profile
  INSERT INTO profiles (id, business_name)
  VALUES (user_id, business_name);

  -- Create the subscription
  INSERT INTO user_subscriptions (
    user_id,
    tier_id,
    status,
    current_period_end
  ) VALUES (
    user_id,
    tier_id,
    'active',
    (CURRENT_TIMESTAMP + INTERVAL '1 month')
  );

  -- Set up usage limits
  INSERT INTO user_usage_limits (
    user_id,
    qr_codes_count,
    sms_count,
    api_calls_count
  ) VALUES (
    user_id,
    qr_limit,
    sms_limit,
    api_limit
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_user_profile IS 'Creates a new user profile with subscription and usage limits';