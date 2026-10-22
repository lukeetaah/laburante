-- Public professional links
--
-- The public profile view previously allowed only web/portfolio. The profile
-- editor already stores LinkedIn and Instagram in contact_methods, but the
-- view filtered those rows out before the client could render them.
--
-- Keep direct channels (email, phone and WhatsApp) behind the existing
-- contact/request flow. This migration only expands the explicit public
-- allowlist for non-sensitive external links.

CREATE OR REPLACE VIEW public.public_profile_contacts AS
SELECT c.profile_id, c.type, c.value, c.is_public
FROM public.contact_methods AS c
JOIN public.profiles AS p ON p.id = c.profile_id
WHERE ((p.account_type <> 'empresa' AND p.status = 'activo')
    OR (p.account_type = 'empresa' AND p.status IN ('activo', 'oculto')))
  AND c.is_public = true
  AND c.type IN ('web', 'portfolio', 'linkedin', 'instagram');

REVOKE ALL ON public.public_profile_contacts FROM PUBLIC;
GRANT SELECT ON public.public_profile_contacts TO anon, authenticated;
