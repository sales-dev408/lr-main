-- Run this in the Supabase SQL Editor to remove the wallet-pass columns.
ALTER TABLE passes
  DROP COLUMN IF EXISTS platform,
  DROP COLUMN IF EXISTS device_library_id,
  DROP COLUMN IF EXISTS push_token,
  DROP COLUMN IF EXISTS passcreator_id,
  DROP COLUMN IF EXISTS passcreator_url,
  DROP COLUMN IF EXISTS passcreator_iphone_uri,
  DROP COLUMN IF EXISTS passcreator_android_uri;
