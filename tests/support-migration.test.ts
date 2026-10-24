import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migration_support_tickets.sql', import.meta.url), 'utf8')

test('la migración de soporte no contiene operaciones de datos destructivas', () => {
  assert.doesNotMatch(migration, /^\s*(DROP|DELETE|TRUNCATE)\s+/im)
  assert.match(migration, /support_one_active_ticket_per_user/)
  assert.match(migration, /pg_advisory_xact_lock/)
})

test('la autorización administrativa se verifica dentro de cada RPC privilegiada', () => {
  const adminFunctions = ['admin_update_support_ticket', 'admin_reply_support_ticket']
  for (const name of adminFunctions) {
    const functionBlock = migration.slice(migration.indexOf(`FUNCTION public.${name}`), migration.indexOf('$$;', migration.indexOf(`FUNCTION public.${name}`)))
    assert.match(functionBlock, /auth\.jwt\(\).*app_metadata.*role.*admin/s)
  }
  assert.match(migration, /No se concede INSERT al navegador/)
})

