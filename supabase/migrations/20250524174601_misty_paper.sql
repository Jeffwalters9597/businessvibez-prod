/*
  # Fix create_user_profile function

  1. Changes
    - Drop existing function to allow return type change
    - Recreate function with proper error handling and return type
    - Add better validation for subscription tiers
    - Improve error messages for debugging

  2. Return Type
    - Changed from void to json to provide better error feedback
*/

-- Drop the existing function first
DROP FUNCTION IF EXISTS create_user_profile(uuid, text, text);

-- Recreate the function with json return type
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id uuid,
  business_name text,
  subscription_tier text
) RETURNS json AS $$
DECLARE
  tier_id uuid;
  profile_id uuid;
BEGIN
  -- Get the subscription tier ID
  SELECT id INTO tier_id
  FROM subscription_tiers
  WHERE name = INITCAP(subscription_tier)
  LIMIT 1;

  IF tier_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid subscription tier'
    );
  END IF;

  -- Create the profile
  INSERT INTO profiles (id, business_name)
  VALUES (user_id, business_name)
  RETURNING id INTO profile_id;

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
    (CASE 
      WHEN subscription_tier = 'free' THEN now() + interval '100 years'  -- Effectively unlimited for free tier
      ELSE (now() + interval '1 month')
    END)
  );

  -- Return success response
  RETURN json_build_object(
    'success', true,
    'profile_id', profile_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile already exists for this user'
    );
  WHEN foreign_key_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid user ID or subscription tier'
    );
  WHEN others THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to create user profile: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;