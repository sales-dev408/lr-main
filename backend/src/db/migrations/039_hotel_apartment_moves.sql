-- §8: hotels & apartment properties misclassified as vendors are re-listed in
-- apartments_hotels (deduplicated vs existing listings) and tombstoned out of
-- the vendor directory (status='moved' preserves ids, discounts, redemptions).
ALTER TABLE vendors DROP CONSTRAINT vendors_status_check;
ALTER TABLE vendors ADD CONSTRAINT vendors_status_check CHECK (status = ANY (ARRAY['pending','approved','rejected','suspended','moved']));
CREATE TABLE IF NOT EXISTS _backup_vendors_moved AS SELECT * FROM vendors WHERE false;
CREATE TEMP TABLE move_candidates AS
 SELECT DISTINCT ON (lower(name), lower(COALESCE(city,'')))
        id, name, city, station, address, phone, website, latitude, longitude,
        CASE WHEN category ~* 'apartment|lofts|housing' AND category !~* 'hotel' THEN 'apartment' ELSE 'hotel' END AS ltype
   FROM vendors
  WHERE status='approved'
    AND (category ~* '^(Hotel|Extended stay hotel|Hotel & spa|Apartment complex|Housing/Hotels)$'
         OR (name ~* 'Delta Hotels' AND vendor_type='other'))
    AND name !~* 'TLC|Transitional Living'
  ORDER BY lower(name), lower(COALESCE(city,'')), station;
INSERT INTO _backup_vendors_moved
 SELECT v.* FROM vendors v WHERE EXISTS (SELECT 1 FROM move_candidates m WHERE lower(m.name)=lower(v.name) AND lower(COALESCE(v.city,''))=lower(m.city));
INSERT INTO apartments_hotels (id, name, listing_type, section, station, address, city, phone, website, latitude, longitude, near_rail, created_at, updated_at)
 SELECT gen_random_uuid(), m.name, m.ltype,
        CASE WHEN lower(COALESCE(m.city,'')) LIKE '%mesa%' THEN 'Mesa'
             WHEN lower(COALESCE(m.city,'')) LIKE '%tempe%' THEN 'Tempe'
             WHEN m.station ~* 'Camelback|Northern|Montebello|19th Ave|Dunlap|Metro' THEN 'North Phoenix'
             WHEN m.station ~* 'Osborn|Thomas|Encanto|McDowell|Indian School' THEN 'Central'
             ELSE 'Downtown' END,
        m.station, m.address, m.city, m.phone, m.website, m.latitude, m.longitude, true, now(), now()
   FROM move_candidates m
  WHERE NOT EXISTS (
    SELECT 1 FROM apartments_hotels a
    WHERE lower(regexp_replace(a.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(m.name,'[^a-zA-Z0-9]','','g'))
  );
UPDATE vendors SET status='moved', updated_at=now()
 WHERE status='approved' AND EXISTS (
   SELECT 1 FROM move_candidates m WHERE lower(m.name)=lower(vendors.name) AND lower(COALESCE(vendors.city,''))=lower(m.city));
DROP TABLE move_candidates;
