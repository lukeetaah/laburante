import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migrationSql = readFileSync(
  new URL('../supabase/migration_fix_admin_update_profile.sql', import.meta.url),
  'utf8'
)

test('la migración de admin_update_profile corrige el tipo de changed_fields a jsonb con to_jsonb', () => {
  // Asegura que changed_fields se inserte como jsonb y no como text[]
  assert.match(
    migrationSql,
    /to_jsonb\(COALESCE\(v_keys,\s*ARRAY\['relations_update'\]::text\[\]\)\)/
  )
  assert.doesNotMatch(
    migrationSql,
    /changed_fields,\s*\n\s*changes\s*\n\s*\)\s*VALUES\s*\([^\)]*COALESCE\(v_keys,\s*ARRAY\['relations_update'\]::text\[\]\),/s
  )
})

test('la migración mantiene SECURITY DEFINER y search_path seguro', () => {
  assert.match(migrationSql, /SECURITY DEFINER/)
  assert.match(migrationSql, /SET search_path\s*=\s*pg_catalog,\s*public,\s*auth/)
})

test('la migración conserva la verificación estricta de admin y no es destructiva', () => {
  assert.match(migrationSql, /auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'/)
  assert.doesNotMatch(migrationSql, /^\s*(DROP TABLE|DROP DATABASE|TRUNCATE)\b/im)
  assert.match(migrationSql, /NOTIFY pgrst,\s*'reload schema'/)
})
