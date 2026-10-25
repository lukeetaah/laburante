BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_profile_presence_counts()
RETURNS TABLE(
  code text,
  name text,
  profile_count bigint,
  total_profiles bigint,
  unmapped_profiles bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH jurisdictions(code, name) AS (
    VALUES
      ('AR-B', 'Buenos Aires'),
      ('AR-C', 'CABA'),
      ('AR-K', 'Catamarca'),
      ('AR-H', 'Chaco'),
      ('AR-U', 'Chubut'),
      ('AR-X', 'Córdoba'),
      ('AR-W', 'Corrientes'),
      ('AR-E', 'Entre Ríos'),
      ('AR-P', 'Formosa'),
      ('AR-Y', 'Jujuy'),
      ('AR-L', 'La Pampa'),
      ('AR-F', 'La Rioja'),
      ('AR-M', 'Mendoza'),
      ('AR-N', 'Misiones'),
      ('AR-Q', 'Neuquén'),
      ('AR-R', 'Río Negro'),
      ('AR-A', 'Salta'),
      ('AR-J', 'San Juan'),
      ('AR-D', 'San Luis'),
      ('AR-Z', 'Santa Cruz'),
      ('AR-S', 'Santa Fe'),
      ('AR-G', 'Santiago del Estero'),
      ('AR-V', 'Tierra del Fuego'),
      ('AR-T', 'Tucumán')
  ),
  eligible AS (
    SELECT CASE normalized.province
      WHEN 'buenos aires' THEN 'AR-B'
      WHEN 'caba' THEN 'AR-C'
      WHEN 'ciudad autonoma de buenos aires' THEN 'AR-C'
      WHEN 'catamarca' THEN 'AR-K'
      WHEN 'chaco' THEN 'AR-H'
      WHEN 'chubut' THEN 'AR-U'
      WHEN 'cordoba' THEN 'AR-X'
      WHEN 'corrientes' THEN 'AR-W'
      WHEN 'entre rios' THEN 'AR-E'
      WHEN 'formosa' THEN 'AR-P'
      WHEN 'jujuy' THEN 'AR-Y'
      WHEN 'la pampa' THEN 'AR-L'
      WHEN 'la rioja' THEN 'AR-F'
      WHEN 'mendoza' THEN 'AR-M'
      WHEN 'misiones' THEN 'AR-N'
      WHEN 'neuquen' THEN 'AR-Q'
      WHEN 'rio negro' THEN 'AR-R'
      WHEN 'salta' THEN 'AR-A'
      WHEN 'san juan' THEN 'AR-J'
      WHEN 'san luis' THEN 'AR-D'
      WHEN 'santa cruz' THEN 'AR-Z'
      WHEN 'santa fe' THEN 'AR-S'
      WHEN 'santiago del estero' THEN 'AR-G'
      WHEN 'tierra del fuego' THEN 'AR-V'
      WHEN 'tierra del fuego antartida e islas del atlantico sur' THEN 'AR-V'
      WHEN 'tucuman' THEN 'AR-T'
      ELSE NULL
    END AS code
    FROM (
      SELECT regexp_replace(
        translate(trim(coalesce(p.provincia, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'),
        '[^a-z0-9]+',
        ' ',
        'g'
      ) AS province
      FROM public.profiles AS p
      WHERE p.status = 'activo'
        AND coalesce(p.account_type, '') <> 'empresa'
        AND p.intent IN ('ofrecer', 'ambas')
    ) AS normalized
  ),
  counts AS (
    SELECT code, count(*) AS profile_count
    FROM eligible
    WHERE code IS NOT NULL
    GROUP BY code
  ),
  totals AS (
    SELECT count(*) AS total_profiles, count(*) FILTER (WHERE code IS NULL) AS unmapped_profiles
    FROM eligible
  )
  SELECT j.code, j.name, coalesce(c.profile_count, 0), t.total_profiles, t.unmapped_profiles
  FROM jurisdictions AS j
  CROSS JOIN totals AS t
  LEFT JOIN counts AS c ON c.code = j.code
  ORDER BY j.code;
$$;

REVOKE ALL ON FUNCTION public.admin_get_profile_presence_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_profile_presence_counts() TO service_role;

COMMIT;
