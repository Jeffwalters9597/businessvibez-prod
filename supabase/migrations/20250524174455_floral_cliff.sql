/*
  # User Profile and Subscription Management Functions
  
  1. Changes
    - Drop existing functions to allow recreation
    - Create helper functions for tier ID lookup
    - Create main profile creation function
  
  2. Functions
    - get_free_tier_id: Returns the ID of the free subscription tier
    - get_premium_tier_id: Returns the ID of the premium subscription tier
    - create_user_profile: Creates user profile and subscription
*/

-- Drop existing functions first
DROP FUNCTION IF EXISTS create_user_profile(uuid, text, text);
DROP FUNCTION IF EXISTS get_free_tier_id();
DROP FUNCTION IF EXISTS get_premium_tier_id();

-- Get the free tier ID for the subscription
CREATE FUNCTION get_free_tier_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id FROM subscription_tiers WHERE name = 'Free' LIMIT 1;
$$;

-- Get the premium tier ID for the subscription
CREATE FUNCTION get_premium_tier_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id FROM subscription_tiers WHERE name = 'Premium' LIMIT 1;
$$;

-- Main function to create user profile and subscription
CREATE FUNCTION create_user_profile(
  user_id uuid,
  business_name text,
  subscription_tier text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tier_id uuid;
  profile_id uuid;
BEGIN
  -- Start transaction
  BEGIN
    -- Create the profile
    INSERT INTO profiles (id, business_name)
    VALUES (user_id, business_name)
    RETURNING id INTO profile_id;

    -- Determine tier ID based on selected plan
    IF subscription_tier = 'premium' THEN
      tier_id := get_premium_tier_id();
    ELSE
      tier_id := get_free_tier_id();
    END IF;

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
      CASE 
        WHEN subscription_tier = 'premium' THEN now() + interval '1 month'
        ELSE now() + interval '100 years' -- Effectively unlimited for free tier
      END
    );

    -- Return success
    RETURN json_build_object(
      'success', true,
      'profile_id', profile_id
    );

  EXCEPTION WHEN OTHERS THEN
    -- Return error details
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
  END;
END;
$$;