/*
  # Add create_user_profile function

  1. New Function
    - `create_user_profile`: Creates a user profile and subscription
      - Parameters:
        - user_id (uuid): The ID of the authenticated user
        - business_name (text): Name of the user's business
        - subscription_tier (text): Either 'free' or 'premium'
      
  2. Function Details
    - Creates a profile record
    - Creates a subscription record based on the selected tier
    - Handles all operations in a transaction
    - Returns success/failure status
*/

CREATE OR REPLACE FUNCTION create_user_profile(
  user_id uuid,
  business_name text,
  subscription_tier text
) RETURNS void AS $$
DECLARE
  tier_id uuid;
BEGIN
  -- Start transaction
  -- Insert profile
  INSERT INTO profiles (id, business_name)
  VALUES (user_id, business_name);

  -- Get the subscription tier ID
  SELECT id INTO tier_id
  FROM subscription_tiers
  WHERE name = INITCAP(subscription_tier)
  LIMIT 1;

  IF tier_id IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription tier';
  END IF;

  -- Create subscription
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
      WHEN subscription_tier = 'free' THEN NOW() + INTERVAL '100 years'
      ELSE NOW() + INTERVAL '30 days'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;