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
      SELECT t.value AS tab
      FROM app_settings a,
           jsonb_array_elements(a.value->'tabs') AS t(value)
      WHERE a.key = 'theme'
      UNION ALL
      SELECT '{"key":"events","label":"Events","color":"#9333ea","gradient":["#a855f7","#7e22ce"]}'::jsonb
    ) AS all_tabs
  ),
  true
)
WHERE key = 'theme'
  AND NOT value->'tabs' @> '[{"key":"events"}]'::jsonb;

COMMIT;
