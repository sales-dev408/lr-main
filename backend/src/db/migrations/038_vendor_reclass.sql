-- §6/§7: merge Services into Shopping ('other') and move health & beauty
-- businesses to the 'beauty' vendor_type used by the Beauty & Health tab.
CREATE TABLE IF NOT EXISTS _backup_vendors_reclass AS SELECT * FROM vendors WHERE false;
INSERT INTO _backup_vendors_reclass SELECT * FROM vendors WHERE vendor_type IN ('services','other','beauty');
-- Health & beauty services -> 'beauty' (kept in services category for filter list).
UPDATE vendors SET vendor_type='beauty', updated_at=now()
 WHERE vendor_type='services' AND category ~* 'Health & Wellness|Beauty/Barber/Tattoo|Health|Wellness|Beauty|Barber|Tattoo';
-- Everything else in services -> 'other' (Shopping), category preserved for Shop Type Filter.
UPDATE vendors SET vendor_type='other', updated_at=now() WHERE vendor_type='services';
-- Health/beauty businesses already filed under 'other' -> 'beauty' (pharmacies, clinics,
-- urgent care, spas, tattoo); grocery/dept stores that merely contain a pharmacy stay 'other'.
UPDATE vendors SET vendor_type='beauty', updated_at=now()
 WHERE vendor_type='other' AND (
   category ~* '^(pharmacy|pharmacy/convenience|medical clinic|Health & Beauty|Shopping / Health & Beauty)$'
   OR name ~* '(CVS Pharmacy|Walgreens|Albertsons Pharmacy|Fry''s Pharmacy|Capsule)'
 );
