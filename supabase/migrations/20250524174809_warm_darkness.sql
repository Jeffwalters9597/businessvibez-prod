/*
  # Fix create_user_profile function
  
  1. Changes
    - Drop existing function to allow return type change
    - Recreate function with void return type
    - Add proper error handling and transaction management
    
  2. Security
    - Function runs with SECURITY DEFINER
    - Explicit search_path set for security
*/

-- Drop the existing function first
DROP FUNCTION IF EXISTS create_user_profile(uuid, text, text);

-- Recreate the function with proper implementation
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
  -- Start transaction
  BEGIN
    -- Insert the profile
    INSERT INTO profiles (id, business_name, created_at, updated_at)
    VALUES (user_id, business_name, now(), now());

    -- Get the appropriate tier ID
    SELECT id INTO tier_id
    FROM subscription_tiers
    WHERE name = CASE 
      WHEN subscription_tier = 'premium' THEN 'Premium'
      ELSE 'Free'
    END;

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

    -- If we get here, commit the transaction
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
  END;
END;
$$;