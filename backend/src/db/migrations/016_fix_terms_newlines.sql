BEGIN;

-- The 015 migration used a plain string literal with \n, which stored a literal
-- backslash-n in discount_terms. Convert those rows to real newlines.
UPDATE vendors
SET discount_terms = replace(discount_terms, '\n', E'\n')
WHERE discount_terms LIKE '%\\n%';

-- Ensure any remaining NULL values get the canonical terms text.
UPDATE vendors
SET discount_terms = 'Cannot be applied with any other offer' || E'\n' || 'Not redeemable for cash' || E'\n' || 'Can be used 1 time per week'
WHERE discount_terms IS NULL;

COMMIT;
