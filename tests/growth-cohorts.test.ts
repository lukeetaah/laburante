import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { formatRetentionCell, formatWeekRange } from '../src/lib/growth-cohorts.ts'

test('retención distingue semanas futuras, sin datos y medición real', () => {
  assert.equal(formatRetentionCell({ relative_week: 1, state: 'in_progress', active_users: null, retention_percent: null }), 'En curso')
  assert.equal(formatRetentionCell({ relative_week: 2, state: 'no_data', active_users: null, retention_percent: null }), 'Sin datos')
  assert.equal(formatRetentionCell({ relative_week: 3, state: 'measured', active_users: 12, retention_percent: 60 }), '12 · 60%')
})

test('las semanas se muestran como rango y no como fecha de perfil', () => {
  assert.match(formatWeekRange('2026-10-26', '2026-11-01'), /26.?oct.*01.?nov/i)
})

test('la migración usa Auth para adquisición y una clave semanal única', () => {
  const source = readFileSync(new URL('../supabase/migrations/20261031120000_weekly_growth_cohorts.sql', import.meta.url), 'utf8')
  assert.match(source, /REFERENCES auth\.users\(id\)/)
  assert.match(source, /PRIMARY KEY \(user_id, week_start\)/)
  assert.match(source, /REVOKE ALL ON TABLE public\.user_activity_weeks FROM PUBLIC, anon, authenticated/)
  assert.match(source, /America\/Argentina\/Buenos_Aires/)
  assert.match(source, /EXTRACT\(ISODOW/)
  assert.match(source, /ON CONFLICT \(user_id, week_start\) DO NOTHING/)
  assert.match(source, /admin_only/)
  assert.match(source, /u\.created_at/)
  assert.match(source, /No registrado/)
  assert.match(source, /admin_get_auth_created_at_by_ids/)
  assert.match(source, /admin_get_growth_cohort_summary/)
  assert.match(source, /admin_get_growth_cohort_members/)
})
