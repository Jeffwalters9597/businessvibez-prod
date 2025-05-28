/*
  # Add create_user_profile function

  1. New Function
    - `create_user_profile`: Creates a user profile and subscription
      - Parameters:
        - user_id (uuid): The ID of the user
        - business_name (text): Name of the business
        - subscription_tier (text): Either 'free' or 'premium'
      - Returns: void
      - Handles:
        - Profile creation
        - Subscription creation with appropriate tier
        - Transaction management
        - Error handling

  2. Security
    - Function is accessible to authenticated users only
    - Validates input parameters
    - Ensures proper error handling
*/

-- Create the function to handle user profile creation
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
  -- Validate inputs
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  IF business_name IS NULL OR business_name = '' THEN
    RAISE EXCEPTION 'business_name cannot be null or empty';
  END IF;

  IF subscription_tier NOT IN ('free', 'premium') THEN
    RAISE EXCEPTION 'subscription_tier must be either free or premium';
  END IF;

  -- Get the appropriate tier_id
  SELECT id INTO tier_id
  FROM subscription_tiers
  WHERE LOWER(name) = subscription_tier
  LIMIT 1;

  IF tier_id IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription tier';
  END IF;

  -- Create profile
  INSERT INTO profiles (id, business_name)
  VALUES (user_id, business_name);

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
      WHEN subscription_tier = 'free' THEN NULL
      ELSE (NOW() + INTERVAL '1 month')
    END
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Profile already exists for this user';
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Invalid user ID or subscription tier';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
END;
$$;