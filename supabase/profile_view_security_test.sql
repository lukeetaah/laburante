-- Read-only regression assertions for the curated profile views.
-- Execute as a privileged database role; this inspects ACLs only and does
-- not read profile rows or mutate data.

DO $$
DECLARE
  view_name TEXT;
BEGIN
  FOREACH view_name IN ARRAY ARRAY[
    'public.public_profiles',
    'public.public_profile_skills',
    'public.public_profile_services',
    'public.public_profile_languages',
    'public.public_profile_reputation',
    'public.public_profile_contacts',
    'public.public_profile_recommendations'
  ] LOOP
    IF NOT has_table_privilege('anon', view_name, 'SELECT')
       OR NOT has_table_privilege('authenticated', view_name, 'SELECT') THEN
      RAISE EXCEPTION 'public read privilege missing on %', view_name;
    END IF;

    IF has_table_privilege('anon', view_name, 'INSERT')
       OR has_table_privilege('anon', view_name, 'UPDATE')
       OR has_table_privilege('anon', view_name, 'DELETE')
       OR has_table_privilege('authenticated', view_name, 'INSERT')
       OR has_table_privilege('authenticated', view_name, 'UPDATE')
       OR has_table_privilege('authenticated', view_name, 'DELETE') THEN
      RAISE EXCEPTION 'unexpected DML privilege on %', view_name;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('authenticated', 'public.authenticated_company_profiles', 'SELECT')
     OR has_table_privilege('anon', 'public.authenticated_company_profiles', 'SELECT')
     OR has_table_privilege('anon', 'public.authenticated_company_profiles', 'INSERT')
     OR has_table_privilege('anon', 'public.authenticated_company_profiles', 'UPDATE')
     OR has_table_privilege('anon', 'public.authenticated_company_profiles', 'DELETE')
     OR has_table_privilege('authenticated', 'public.authenticated_company_profiles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.authenticated_company_profiles', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.authenticated_company_profiles', 'DELETE') THEN
    RAISE EXCEPTION 'unexpected ACL on public.authenticated_company_profiles';
  END IF;
END;
$$;
