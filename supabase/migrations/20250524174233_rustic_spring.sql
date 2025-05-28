/*
  # Add create_user_profile function

  1. New Function
    - `create_user_profile`: Creates a user profile and subscription
      - Parameters:
        - user_id (uuid): The ID of the user
        - business_name (text): The name of the business
        - subscription_tier (text): Either 'free' or 'premium'

  2. Function Logic
    - Creates profile record
    - Creates subscription record based on tier
    - Uses transaction to ensure data consistency
*/

-- First, create a function to safely get the tier ID
CREATE OR REPLACE FUNCTION get_tier_id_by_name(tier_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tier_id uuid;
BEGIN
  -- Convert tier name to lowercase for case-insensitive comparison
  SELECT id INTO tier_id
  FROM subscription_tiers
  WHERE LOWER(name) = LOWER(tier_name);
  
  IF tier_id IS NULL THEN
    -- Default to free tier if not found
    SELECT id INTO tier_id
    FROM subscription_tiers
    WHERE LOWER(name) = 'free';
  END IF;
  
  RETURN tier_id;
END;
$$;

-- Main function to create user profile and subscription
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id uuid,
  business_name text,
  subscription_tier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tier_id uuid;
BEGIN
  -- Get the appropriate tier ID
  tier_id := get_tier_id_by_name(subscription_tier);

  -- Create the profile
  INSERT INTO profiles (id, business_name)
  VALUES (user_id, business_name);

  -- Create the subscription
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
    (CURRENT_TIMESTAMP + INTERVAL '1 month')
  );
END;
$$;