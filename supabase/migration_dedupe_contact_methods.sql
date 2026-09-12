-- Remove duplicate contact entries created by repeated profile initialization.
-- Keeps the oldest row for each profile, type and normalized value.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id, type,
        CASE
          WHEN type::text IN ('whatsapp', 'telefono') THEN regexp_replace(trim(value), '\D', '', 'g')
          ELSE lower(trim(value))
        END
      ORDER BY id
    ) AS row_number
  FROM public.contact_methods
)
DELETE FROM public.contact_methods
WHERE id IN (SELECT id FROM ranked WHERE row_number > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_methods_profile_type_value_unique
  ON public.contact_methods (
    profile_id,
    type,
    (CASE
      WHEN type::text IN ('whatsapp', 'telefono') THEN regexp_replace(trim(value), '\D', '', 'g')
      ELSE lower(trim(value))
    END)
  );
