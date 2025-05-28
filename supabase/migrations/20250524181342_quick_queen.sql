/*
  # Enhanced Security Features
  
  1. Rate Limiting
    - Add IP-based rate limiting
    - Add concurrent request limiting
    
  2. Anti-Spam
    - Add spam detection triggers
    - Add content validation
    
  3. Security Improvements
    - Add audit logging
    - Add suspicious activity detection
*/

-- Create IP rate limiting table
CREATE TABLE IF NOT EXISTS ip_rate_limits (
  ip text PRIMARY KEY,
  request_count integer DEFAULT 1,
  first_request timestamptz DEFAULT now(),
  last_request timestamptz DEFAULT now(),
  is_blocked boolean DEFAULT false,
  blocked_until timestamptz
);

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ip_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Only admins can view IP rate limits"
  ON ip_rate_limits FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to check IP rate limits
CREATE OR REPLACE FUNCTION check_ip_rate_limit(
  ip_address text,
  max_requests integer DEFAULT 100,
  window_minutes integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ip_limit record;
BEGIN
  -- Get or create IP record
  INSERT INTO ip_rate_limits (ip)
  VALUES (ip_address)
  ON CONFLICT (ip) DO UPDATE
  SET 
    request_count = CASE
      WHEN ip_rate_limits.first_request < now() - (window_minutes || ' minutes')::interval
      THEN 1
      ELSE ip_rate_limits.request_count + 1
    END,
    first_request = CASE
      WHEN ip_rate_limits.first_request < now() - (window_minutes || ' minutes')::interval
      THEN now()
      ELSE ip_rate_limits.first_request
    END,
    last_request = now(),
    is_blocked = CASE
      WHEN ip_rate_limits.is_blocked AND ip_rate_limits.blocked_until > now()
      THEN true
      ELSE false
    END,
    blocked_until = CASE
      WHEN ip_rate_limits.request_count >= max_requests
      THEN now() + interval '1 hour'
      ELSE ip_rate_limits.blocked_until
    END
  RETURNING *
  INTO ip_limit;

  -- Check if IP is blocked
  IF ip_limit.is_blocked AND ip_limit.blocked_until > now() THEN
    RETURN false;
  END IF;

  -- Check rate limit
  IF ip_limit.request_count > max_requests AND 
     ip_limit.first_request > now() - (window_minutes || ' minutes')::interval THEN
    
    -- Block IP
    UPDATE ip_rate_limits
    SET 
      is_blocked = true,
      blocked_until = now() + interval '1 hour'
    WHERE ip = ip_address;
    
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  user_id uuid,
  action text,
  details jsonb DEFAULT '{}',
  ip_address text DEFAULT NULL,
  user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    details,
    ip_address,
    user_agent
  )
  VALUES (
    user_id,
    action,
    details,
    ip_address,
    user_agent
  );
END;
$$;

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION check_suspicious_activity(
  user_id uuid,
  action text,
  details jsonb DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  suspicious boolean := false;
  recent_actions integer;
BEGIN
  -- Check for rapid successive actions
  SELECT COUNT(*) INTO recent_actions
  FROM audit_logs
  WHERE 
    audit_logs.user_id = check_suspicious_activity.user_id
    AND created_at > now() - interval '5 minutes';

  -- Mark as suspicious if too many actions
  IF recent_actions > 50 THEN
    suspicious := true;
  END IF;

  -- Check for suspicious patterns in content
  IF details ? 'content' AND (
    details->>'content' ILIKE '%<script%'
    OR details->>'content' ILIKE '%javascript:%'
    OR details->>'content' ILIKE '%data:text/html%'
  ) THEN
    suspicious := true;
  END IF;

  -- Log suspicious activity
  IF suspicious THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      details
    )
    VALUES (
      user_id,
      'suspicious_activity_detected',
      jsonb_build_object(
        'trigger_action', action,
        'details', details,
        'reason', 'Suspicious pattern detected'
      )
    );
  END IF;

  RETURN suspicious;
END;
$$;

-- Update the check_usage_limits function to include security checks
CREATE OR REPLACE FUNCTION check_usage_limits(
  user_id uuid,
  action text,
  ip_address text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_tier text;
  current_usage integer;
  is_allowed boolean;
BEGIN
  -- Check IP rate limit
  IF ip_address IS NOT NULL AND NOT check_ip_rate_limit(ip_address) THEN
    RETURN false;
  END IF;

  -- Check for suspicious activity
  IF check_suspicious_activity(user_id, action) THEN
    RETURN false;
  END IF;

  -- Get user's subscription tier
  SELECT name INTO user_tier
  FROM subscription_tiers st
  JOIN user_subscriptions us ON us.tier_id = st.id
  WHERE us.user_id = check_usage_limits.user_id
  AND us.status = 'active';

  -- Premium users still have limits to prevent abuse
  IF user_tier = 'Premium' THEN
    -- Check for abnormal usage
    SELECT COUNT(*) INTO current_usage
    FROM usage_logs
    WHERE user_id = check_usage_limits.user_id
    AND created_at > now() - interval '1 hour';

    IF current_usage > 1000 THEN
      -- Log potential abuse
      PERFORM log_audit_event(
        user_id,
        'potential_abuse_detected',
        jsonb_build_object(
          'action', action,
          'usage_count', current_usage,
          'window', '1 hour'
        ),
        ip_address
      );
      RETURN false;
    END IF;
  END IF;

  -- Check specific limits for free tier
  CASE action
    WHEN 'create_qr_code' THEN
      SELECT qr_codes_count INTO current_usage
      FROM user_usage_limits
      WHERE user_id = check_usage_limits.user_id;
      
      is_allowed := COALESCE(current_usage, 0) < 5;
      
    WHEN 'send_sms' THEN
      SELECT sms_count INTO current_usage
      FROM user_usage_limits
      WHERE user_id = check_usage_limits.user_id;
      
      is_allowed := COALESCE(current_usage, 0) < 100;
      
    ELSE
      is_allowed := false;
  END CASE;

  -- Log the usage attempt
  INSERT INTO usage_logs (user_id, action)
  VALUES (check_usage_limits.user_id, action);

  -- Update usage count if allowed
  IF is_allowed THEN
    UPDATE user_usage_limits
    SET
      qr_codes_count = CASE 
        WHEN action = 'create_qr_code' 
        THEN qr_codes_count + 1
        ELSE qr_codes_count
      END,
      sms_count = CASE 
        WHEN action = 'send_sms' 
        THEN sms_count + 1
        ELSE sms_count
      END,
      updated_at = now()
    WHERE user_id = check_usage_limits.user_id;

    -- Log successful action
    PERFORM log_audit_event(
      user_id,
      action || '_success',
      jsonb_build_object(
        'current_usage', current_usage + 1
      ),
      ip_address
    );
  ELSE
    -- Log failed attempt
    PERFORM log_audit_event(
      user_id,
      action || '_limit_exceeded',
      jsonb_build_object(
        'current_usage', current_usage
      ),
      ip_address
    );
  END IF;

  RETURN is_allowed;
END;
$$;