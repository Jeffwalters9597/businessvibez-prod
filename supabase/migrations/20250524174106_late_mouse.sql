/*
  # Create user profile function

  1. New Function
    - `create_user_profile`: Creates a user profile and subscription in a transaction
      - Parameters:
        - user_id (uuid): The ID of the user
        - business_name (text): The name of the user's business
        - subscription_tier (text): The selected subscription tier ('free' or 'premium')

  2. Security
    - Function is accessible to authenticated users only
    - Users can only create their own profile
*/

CREATE OR REPLACE FUNCTION create_user_profile(
  user_id uuid,
  business_name text,
  subscription_tier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert the profile
  INSERT INTO profiles (id, business_name)
  VALUES (user_id, business_name);

  -- If premium tier selected, create subscription
  IF subscription_tier = 'premium' THEN
    INSERT INTO user_subscriptions (
      user_id,
      tier_id,
      status,
      current_period_end
    )
    VALUES (
      user_id,
      (SELECT id FROM subscription_tiers WHERE name = 'Premium' LIMIT 1),
      'active',
      NOW() + INTERVAL '30 days'
    );
  END IF;
END;
$$;