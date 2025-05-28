/*
  # Add verification security measures

  1. New Tables
    - `verification_codes`
      - For storing temporary verification codes
      - Used for both email and phone verification
      - Codes expire after 15 minutes
    - `verified_emails`
      - Track verified email addresses
      - Prevent duplicate registrations
    - `verification_attempts`
      - Track verification attempts
      - Prevent brute force attacks

  2. Functions
    - `create_verification_code`
    - `verify_code`
    - `check_verification_attempts`
    - `cleanup_expired_codes`

  3. Security
    - Rate limiting on verification attempts
    - Code expiration
    - Secure code generation
*/

-- Create verification codes table
CREATE TABLE IF NOT EXISTS verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  code text NOT NULL,
  type text NOT NULL CHECK (type IN ('email', 'phone')),
  identifier text NOT NULL, -- email or phone number
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, type)
);

-- Create verified emails table
CREATE TABLE IF NOT EXISTS verified_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  verified_at timestamptz DEFAULT now(),
  UNIQUE(email)
);

-- Create verification attempts table
CREATE TABLE IF NOT EXISTS verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- email or phone
  attempt_count integer DEFAULT 1,
  last_attempt timestamptz DEFAULT now(),
  locked_until timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own verification codes"
  ON verification_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own verified emails"
  ON verified_emails FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to check verification attempts
CREATE OR REPLACE FUNCTION check_verification_attempts(
  identifier text,
  max_attempts integer DEFAULT 5,
  lockout_duration interval DEFAULT interval '30 minutes'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempts record;
BEGIN
  -- Get current attempts
  SELECT * INTO attempts
  FROM verification_attempts
  WHERE verification_attempts.identifier = check_verification_attempts.identifier
  FOR UPDATE;
  
  -- If no attempts found, create new record
  IF attempts IS NULL THEN
    INSERT INTO verification_attempts (identifier)
    VALUES (check_verification_attempts.identifier)
    RETURNING * INTO attempts;
    RETURN true;
  END IF;
  
  -- Check if locked
  IF attempts.locked_until IS NOT NULL AND attempts.locked_until > now() THEN
    RETURN false;
  END IF;
  
  -- Reset attempts if last attempt was more than lockout_duration ago
  IF attempts.last_attempt < now() - lockout_duration THEN
    UPDATE verification_attempts
    SET attempt_count = 1,
        last_attempt = now(),
        locked_until = NULL
    WHERE identifier = check_verification_attempts.identifier;
    RETURN true;
  END IF;
  
  -- Increment attempts
  UPDATE verification_attempts
  SET attempt_count = attempt_count + 1,
      last_attempt = now(),
      locked_until = CASE 
        WHEN attempt_count >= max_attempts THEN now() + lockout_duration
        ELSE NULL
      END
  WHERE identifier = check_verification_attempts.identifier;
  
  -- Return false if max attempts exceeded
  RETURN attempts.attempt_count < max_attempts;
END;
$$;

-- Function to create verification code
CREATE OR REPLACE FUNCTION create_verification_code(
  user_id uuid,
  type text,
  identifier text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  verification_code text;
BEGIN
  -- Check verification attempts
  IF NOT check_verification_attempts(identifier) THEN
    RAISE EXCEPTION 'Too many verification attempts. Please try again later.';
  END IF;

  -- Generate 6-digit code
  SELECT array_to_string(ARRAY(
    SELECT chr((48 + round(random() * 9))::integer)
    FROM generate_series(1,6)
  ), '') INTO verification_code;
  
  -- Store the code
  INSERT INTO verification_codes (user_id, code, type, identifier)
  VALUES (user_id, verification_code, type, identifier)
  ON CONFLICT (user_id, type) 
  DO UPDATE SET 
    code = EXCLUDED.code,
    identifier = EXCLUDED.identifier,
    expires_at = now() + interval '15 minutes';
  
  RETURN verification_code;
END;
$$;

-- Function to verify code
CREATE OR REPLACE FUNCTION verify_code(
  user_id uuid,
  verification_code text,
  type text,
  identifier text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_record record;
BEGIN
  -- Check verification attempts
  IF NOT check_verification_attempts(identifier) THEN
    RAISE EXCEPTION 'Too many verification attempts. Please try again later.';
  END IF;

  -- Get and validate code
  SELECT * INTO code_record
  FROM verification_codes
  WHERE verification_codes.user_id = verify_code.user_id
    AND verification_codes.type = verify_code.type
    AND verification_codes.code = verify_code.verification_code
    AND verification_codes.expires_at > now();
    
  IF code_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- Handle verification based on type
  CASE type
    WHEN 'email' THEN
      INSERT INTO verified_emails (user_id, email)
      VALUES (user_id, identifier)
      ON CONFLICT (email) DO NOTHING;
      
    WHEN 'phone' THEN
      INSERT INTO verified_phones (user_id, phone)
      VALUES (user_id, identifier)
      ON CONFLICT (user_id, phone) DO NOTHING;
  END CASE;
  
  -- Delete used code
  DELETE FROM verification_codes
  WHERE verification_codes.id = code_record.id;
  
  RETURN true;
END;
$$;

-- Function to cleanup expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM verification_codes
  WHERE expires_at <= now();
  
  DELETE FROM verification_attempts
  WHERE last_attempt < now() - interval '24 hours';
END;
$$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS verification_codes_user_type_idx 
  ON verification_codes(user_id, type);
CREATE INDEX IF NOT EXISTS verification_attempts_identifier_idx 
  ON verification_attempts(identifier);
CREATE INDEX IF NOT EXISTS verified_emails_email_idx 
  ON verified_emails(email);