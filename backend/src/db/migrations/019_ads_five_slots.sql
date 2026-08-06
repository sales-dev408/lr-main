DO $$
DECLARE
  conname text;
BEGIN
  SELECT con.conname INTO conname
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  WHERE cls.relname = 'ads'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%slot%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ads DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE ads ADD CONSTRAINT ads_slot_check CHECK (slot BETWEEN 1 AND 5);
