-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, price, features) VALUES
  ('Free', 0, '[
    "1 QR code",
    "1 ad space",
    "SMS (Pro only)"
  ]'),
  ('Pro', 2900, '[
    "Unlimited QR codes",
    "Unlimited ad spaces",
    "1000 SMS credits/month",
    "Priority support",
    "Custom branding",
    "Advanced analytics",
    "API access"
  ]');