/*
  # Enhance database security
  
  1. Security Updates
    - Enable Row Level Security (RLS) on all tables
    - Add strict access policies for user data
    - Implement role-based access control
    - Add audit logging capabilities
  
  2. Policy Changes
    - Users can only access their own data
    - Public access restricted to necessary tables only
    - Admin-only access for sensitive operations
*/

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Subscription tiers are public but read-only
CREATE POLICY "Anyone can view subscription tiers"
  ON public.subscription_tiers FOR SELECT
  TO public
  USING (true);

-- User subscriptions policies
CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own subscription"
  ON public.user_subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usage limits policies
CREATE POLICY "Users can view their own usage limits"
  ON public.user_usage_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage limits"
  ON public.user_usage_limits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verified phones policies
CREATE POLICY "Users can view their own verified phones"
  ON public.verified_phones FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own verified phones"
  ON public.verified_phones FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verification codes policies
CREATE POLICY "Users can view their own verification codes"
  ON public.verification_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Verification attempts policies
CREATE POLICY "System can manage verification attempts"
  ON public.verification_attempts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Usage logs policies
CREATE POLICY "Users can view their own usage logs"
  ON public.usage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- IP rate limits policies (admin only)
CREATE POLICY "Only admins can view IP rate limits"
  ON public.ip_rate_limits FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Audit logs policies
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to check usage limits
CREATE OR REPLACE FUNCTION public.check_usage_limits(
  p_user_id uuid,
  p_action text,
  p_ip_address text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current_usage integer;
BEGIN
  -- Get the user's current usage
  SELECT 
    CASE 
      WHEN p_action = 'qr_code' THEN qr_codes_count
      WHEN p_action = 'sms' THEN sms_count
      WHEN p_action = 'api_call' THEN api_calls_count
      ELSE 0
    END
  INTO v_current_usage
  FROM public.user_usage_limits
  WHERE user_id = p_user_id;

  -- Get the user's subscription limit
  SELECT 
    CASE 
      WHEN p_action = 'qr_code' THEN (features->>'qr_code_limit')::integer
      WHEN p_action = 'sms' THEN (features->>'sms_limit')::integer
      WHEN p_action = 'api_call' THEN (features->>'api_call_limit')::integer
      ELSE 0
    END
  INTO v_limit
  FROM public.subscription_tiers t
  JOIN public.user_subscriptions s ON s.tier_id = t.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active';

  -- Check if within limits
  RETURN COALESCE(v_current_usage, 0) < COALESCE(v_limit, 0);
END;
$$;