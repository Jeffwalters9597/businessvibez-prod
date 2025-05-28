/*
  # Add test ad space

  1. Changes
    - Insert a test ad space for verification
    - Add sample content and theme
*/

INSERT INTO ad_spaces (
  id,
  user_id,
  title,
  description,
  content,
  theme,
  views
) VALUES (
  '5678e53a-c961-4cb1-a7d0-c797985d9e3a',
  (SELECT id FROM auth.users LIMIT 1), -- Gets the first user
  'Test Ad Space',
  'This is a test ad space for verification',
  jsonb_build_object(
    'headline', 'Welcome to Our Test Ad',
    'subheadline', 'This is a test advertisement to verify the system is working correctly',
    'url', 'https://example.com'
  ),
  jsonb_build_object(
    'backgroundColor', '#f0f9ff',
    'textColor', '#1e3a8a'
  ),
  0
);