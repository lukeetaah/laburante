-- LABURANTE — make curated profile read models read-only
--
-- The eight views below intentionally remain SECURITY DEFINER because they
-- are curated public/authenticated read models over tables whose direct RLS
-- policies must stay private. This migration removes the unintended DML
-- surface from those views without changing their definitions, filters, or
-- underlying table policies.
--
-- Safe rollback procedure: do not restore DML privileges. If this migration
-- must be reverted, restore the previous view definitions from the repository
-- and re-run this ACL block so the application remains read-only.

BEGIN;

REVOKE ALL ON TABLE
  public.public_profiles,
  public.public_profile_skills,
  public.public_profile_services,
  public.public_profile_languages,
  public.public_profile_reputation,
  public.public_profile_contacts,
  public.public_profile_recommendations,
  public.authenticated_company_profiles
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.public_profiles,
  public.public_profile_skills,
  public.public_profile_services,
  public.public_profile_languages,
  public.public_profile_reputation,
  public.public_profile_contacts,
  public.public_profile_recommendations
TO anon, authenticated;

GRANT SELECT ON TABLE public.authenticated_company_profiles TO authenticated;

COMMIT;;
