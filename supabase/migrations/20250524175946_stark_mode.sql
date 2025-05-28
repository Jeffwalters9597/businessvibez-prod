/*
  # Add create_user_profile function

  1. New Function
    - `create_user_profile`: Creates a new user profile and initializes related records
      - Parameters:
        - user_id (uuid): The ID of the new user
        - business_name (text): The name of the user's business
        - subscription_tier (text): Either 'free' or 'premium'

  2. Function Details
    - Creates profile record
    - Initializes usage limits based on subscription tier
    - Creates subscription record if premium tier selected
    - Handles all operations in a transaction
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
DECLARE
  tier_id uuid;
  qr_limit integer;
  sms_limit integer;
  api_limit integer;
BEGIN
  -- Start transaction
  BEGIN
    -- Create the profile
    INSERT INTO profiles (id, business_name)
    VALUES (user_id, business_name);

    -- Set limits based on subscription tier
    IF subscription_tier = 'premium' THEN
      qr_limit := NULL; -- Unlimited
      sms_limit := 1000;
      api_limit := NULL; -- Unlimited

      -- Get the premium tier ID
      SELECT id INTO tier_id
      FROM subscription_tiers
      WHERE name = 'Premium'
      LIMIT 1;

      -- Create subscription record
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
    ELSE
      qr_limit := 5;
      sms_limit := 100;
      api_limit := 1000;
    END IF;

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

    -- If we get here, commit the transaction
    COMMIT;
  EXCEPTION WHEN OTHERS THEN
    -- If any error occurs, roll back all changes
    ROLLBACK;
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
  END;
END;
$$;