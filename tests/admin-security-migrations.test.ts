import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const storageMigration = readFileSync(new URL('../supabase/migrations/20261025170000_profile_photos_listing_hardening.sql', import.meta.url), 'utf8')
const aclMigration = readFileSync(new URL('../supabase/migrations/20261025173000_security_advisor_acl_completion.sql', import.meta.url), 'utf8')
const presenceMigration = readFileSync(new URL('../supabase/migrations/20261025181000_admin_profile_presence_counts.sql', import.meta.url), 'utf8')
const legacyRevokeMigration = readFileSync(new URL('../supabase/deferred-migrations/20261025190000_revoke_legacy_credentials_rpc_after_cutover.sql', import.meta.url), 'utf8')
const authActivityEdge = readFileSync(new URL('../supabase/functions/admin-user-activity/index.ts', import.meta.url), 'utf8')
const presenceEdge = readFileSync(new URL('../supabase/functions/admin-profile-presence/index.ts', import.meta.url), 'utf8')

test('la migración de fotos limita políticas conocidas sin tocar buckets legacy', () => {
  assert.match(storageMigration, /DROP POLICY IF EXISTS "Users upload own profile photos"/)
  assert.match(storageMigration, /storage\.foldername\(name\).*auth\.uid\(\)/s)
  assert.ok(storageMigration.includes("storage.filename(name) LIKE 'photo-%'"))
  assert.doesNotMatch(storageMigration, /profile-assets/)
  assert.doesNotMatch(storageMigration, /^\s*(DELETE|TRUNCATE|DROP TABLE)\b/im)
})

test('la ACL falla explícitamente si falta una función obligatoria', () => {
  assert.match(aclMigration, /missing_functions/)
  assert.match(aclMigration, /RAISE EXCEPTION 'No se puede aplicar ACL completion/)
  assert.doesNotMatch(aclMigration, /IF to_regprocedure\([^\n]+\) IS NOT NULL/)
  assert.match(aclMigration, /admin_update_support_ticket\(uuid,text,text,text\)/)
})

test('el agregado de presencia se ejecuta en servidor y sólo lo invoca service_role', () => {
  assert.match(presenceMigration, /SECURITY DEFINER/)
  assert.match(presenceMigration, /SET search_path = pg_catalog, public/)
  assert.match(presenceMigration, /GRANT EXECUTE ON FUNCTION public\.admin_get_profile_presence_counts\(\) TO service_role/)
  assert.match(presenceMigration, /p\.status = 'activo'/)
  assert.match(presenceMigration, /p\.intent IN \('ofrecer', 'ambas'\)/)
})

test('la revocación del RPC legado queda separada para después del cutover', () => {
  assert.match(legacyRevokeMigration, /RAISE EXCEPTION/)
  assert.match(legacyRevokeMigration, /REVOKE ALL ON FUNCTION public\.admin_update_user_credentials/)
})

test('las funciones administrativas no cachean datos sensibles ni descargan todos los usuarios', () => {
  assert.doesNotMatch(authActivityEdge, /auth\.admin\.listUsers/)
  assert.match(authActivityEdge, /profile_ids/)
  assert.match(authActivityEdge, /Cache-Control.*no-store/)
  assert.match(authActivityEdge, /Access-Control-Allow-Headers.*baggage.*sentry-trace/)
  assert.match(presenceEdge, /admin_get_profile_presence_counts/)
  assert.doesNotMatch(presenceEdge, /from\('profiles'\)/)
})
