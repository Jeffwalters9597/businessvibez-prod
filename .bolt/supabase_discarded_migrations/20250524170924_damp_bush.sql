/*
  # Add subscription support
  
  1. New Tables
    - `subscription_tiers`
      - `id` (uuid, primary key)
      - `name` (text) - tier name (free, premium)
      - `price` (integer) - price in cents
      - `features` (jsonb) - list of features
    
    - `user_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - references users
      - `tier_id` (uuid) - references subscription_tiers
      - `status` (text) - active, cancelled, expired
      - `current_period_end` (timestamptz)
      
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL,
  features jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  tier_id uuid REFERENCES subscription_tiers ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for subscription_tiers
CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers
  FOR SELECT
  TO public
  USING (true);

-- Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert default tiers
INSERT INTO subscription_tiers (name, price, features) VALUES
  ('Free', 0, '[
    "5 QR codes per month",
    "Basic ad templates",
    "100 SMS credits/month",
    "Email support"
  ]'),
  ('Premium', 2900, '[
    "Unlimited QR codes",
    "Premium ad templates",
    "1000 SMS credits/month",
    "Priority support",
    "Custom branding",
    "Advanced analytics",
    "API access"
  ]');

-- Function to create default subscription for new users
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_subscriptions (
    user_id,
    tier_id,
    status,
    current_period_end
  ) VALUES (
    NEW.id,
    (SELECT id FROM subscription_tiers WHERE name = 'Free' LIMIT 1),
    'active',
    (NOW() + interval '100 years')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default subscription
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_subscription();