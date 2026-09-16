-- Additional metadata for admin-created events: city, contact phone, event
-- link, sport, event type, and a time-of-day so events can be sorted and
-- filtered like the imported RSS events.

BEGIN;

ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS event_time text NULL;
ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS city text NULL;
ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS phone text NULL;
ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS event_link text NULL;
ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS sport text NULL;
ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS event_type text NULL;

CREATE INDEX IF NOT EXISTS admin_events_city_idx ON admin_events (city);

-- Add the "More" and "Sports" tabs to any already-published theme so the
-- new bottom navigation entries have colors/gradients configured.
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
      SELECT '{"key":"sports","label":"Sports","color":"#0ea5e9","gradient":["#38bdf8","#0284c7"]}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM app_settings a2, jsonb_array_elements(a2.value->'tabs') t2(value)
        WHERE a2.key = 'theme' AND t2.value->>'key' = 'sports'
      )
      UNION ALL
      SELECT '{"key":"more","label":"More","color":"#64748b","gradient":["#94a3b8","#475569"]}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM app_settings a2, jsonb_array_elements(a2.value->'tabs') t2(value)
        WHERE a2.key = 'theme' AND t2.value->>'key' = 'more'
      )
    ) AS all_tabs
  ),
  true
)
WHERE key = 'theme'
  AND NOT (value->'tabs' @> '[{"key":"sports"}]'::jsonb AND value->'tabs' @> '[{"key":"more"}]'::jsonb);

COMMIT;
