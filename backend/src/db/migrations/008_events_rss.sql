-- Events tab RSS feed configuration.

BEGIN;

INSERT INTO app_settings (key, value)
VALUES ('events_rss_urls', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Ensure the published theme includes the new Events tab.
-- Existing customisations are preserved; the app overlays defaults in code.
UPDATE app_settings
SET value = jsonb_set(
  value,
  '{tabs}',
  (
    SELECT jsonb_agg(tab)
    FROM (
      SELECT value AS tab
      FROM app_settings,
           jsonb_array_elements(value->'tabs') AS value
      WHERE key = 'theme'
      UNION ALL
      SELECT '{"key":"events","label":"Events","color":"#9333ea","gradient":["#a855f7","#7e22ce"]}'::jsonb
    ) AS all_tabs
  ),
  true
)
WHERE key = 'theme'
  AND NOT value->'tabs' @> '[{"key":"events"}]'::jsonb;

COMMIT;
