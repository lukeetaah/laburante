import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migration_support_notifications_conflict_fix.sql', import.meta.url), 'utf8')

test('support notifications infer the existing partial unique index', () => {
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION public\.(create_support_ticket|admin_reply_support_ticket)/g) || []).length, 2)
  assert.equal((migration.match(/ON CONFLICT \(dedupe_key\) WHERE dedupe_key IS NOT NULL DO NOTHING;/g) || []).length, 2)
  assert.doesNotMatch(migration, /ON CONFLICT \(dedupe_key\) DO NOTHING/)
})

test('the corrective migration does not alter notification rows or structure', () => {
  assert.doesNotMatch(migration, /^\s*(ALTER TABLE public\.notifications|DROP|DELETE|TRUNCATE|UPDATE public\.notifications)\b/im)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_support_ticket[\s\S]*public\.admin_reply_support_ticket/)
})

