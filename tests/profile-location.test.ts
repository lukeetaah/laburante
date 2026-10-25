import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { formatProfileLocation, hasValidProfileLocation } from '../src/lib/profile-location.ts'

const migration = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migration_profile_location_required.sql'), 'utf8')

test('validates and formats complete locations without empty separators', () => {
  assert.equal(hasValidProfileLocation({ localidad: 'Rosario', provincia: 'Santa Fe' }), true)
  assert.equal(formatProfileLocation({ localidad: ' Rosario ', provincia: ' Santa Fe ' }), 'Rosario, Santa Fe')
  assert.equal(hasValidProfileLocation({ localidad: ' ', provincia: 'Santa Fe' }), false)
  assert.equal(formatProfileLocation({ localidad: '', provincia: '' }), 'Ubicación no informada')
})

test('contains a non-destructive database guard for inserts and activation', () => {
  assert.match(migration, /profiles_require_location_on_write/)
  assert.match(migration, /RAISE EXCEPTION 'profile_location_required'/)
  assert.match(migration, /TG_OP = 'INSERT'/)
    assert.match(migration, /TG_OP = 'UPDATE'/)
    assert.match(migration, /NEW\.status IS DISTINCT FROM OLD\.status/)
    assert.match(migration, /NEW\.status = 'activo'/)
  assert.match(migration, /IS DISTINCT FROM OLD\.provincia/)
  assert.match(migration, /IS DISTINCT FROM OLD\.localidad/)
    assert.match(migration, /tgfoid/)
    assert.match(migration, /tgenabled/)
    assert.match(migration, /profiles_require_location_on_write_conflict/)
  assert.doesNotMatch(migration, /\b(DELETE|TRUNCATE|DROP TABLE)\b/i)
})

