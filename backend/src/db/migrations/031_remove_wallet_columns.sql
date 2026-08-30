-- Remove wallet pass columns now that Apple Wallet, Google Wallet, Passcreator,
-- and PassKit web-service support have been removed from the app.
ALTER TABLE passes
  DROP COLUMN IF EXISTS platform,
  DROP COLUMN IF EXISTS device_library_id,
  DROP COLUMN IF EXISTS push_token,
  DROP COLUMN IF EXISTS passcreator_id,
  DROP COLUMN IF EXISTS passcreator_url,
  DROP COLUMN IF EXISTS passcreator_iphone_uri,
  DROP COLUMN IF EXISTS passcreator_android_uri;
