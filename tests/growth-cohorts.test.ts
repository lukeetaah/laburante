import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { formatRetentionCell, formatWeekRange, getBuenosAiresWeekStart, getMemberPageBounds, getRetentionState } from '../src/lib/growth-cohorts.ts'

test('retención distingue semanas futuras, sin datos y medición real', () => {
  assert.equal(formatRetentionCell({ relative_week: 1, state: 'in_progress', active_users: null, retention_percent: null }), 'En curso')
  assert.equal(formatRetentionCell({ relative_week: 2, state: 'no_data', active_users: null, retention_percent: null }), 'Sin datos')
  assert.equal(formatRetentionCell({ relative_week: 3, state: 'measured', active_users: 12, retention_percent: 60 }), '12 · 60%')
})

test('las semanas se muestran como rango y no como fecha de perfil', () => {
  assert.match(formatWeekRange('2026-10-26', '2026-11-01'), /26.?oct.*01.?nov/i)
})

test('la semana anterior está completa y la actual o futura sigue en curso', () => {
  assert.equal(getRetentionState('2026-10-26', '2026-11-02', '2026-10-20'), 'measured')
  assert.equal(getRetentionState('2026-11-02', '2026-11-02', '2026-10-20'), 'in_progress')
  assert.equal(getRetentionState('2026-11-09', '2026-11-02', '2026-10-20'), 'in_progress')
})

test('la primera semana registrada queda fuera de medición completa', () => {
  assert.equal(getRetentionState('2026-10-26', '2026-11-16', '2026-11-02'), 'no_data')
  assert.equal(getRetentionState('2026-11-02', '2026-11-16', '2026-11-02'), 'measured')
})

test('la comparación incluye la semana previa sin ampliar el rango visible', () => {
  const source = readFileSync(new URL('../supabase/migrations/20261031120000_weekly_growth_cohorts.sql', import.meta.url), 'utf8')
  assert.match(source, /generate_series\(0, v_weeks\)/)
  assert.match(source, /\(v_first_week - 7\) \+ \(series\.week_index \* 7\)/)
  assert.match(source, /WHERE cr\.week_start >= v_first_week/)
  assert.match(source, /previous_cohort\.week_start = current_cohort\.week_start - 7/)
})

test('la actividad de la última semana distingue medición disponible de no_data', () => {
  const source = readFileSync(new URL('../supabase/migrations/20261031120000_weekly_growth_cohorts.sql', import.meta.url), 'utf8')
  const component = readFileSync(new URL('../src/components/admin/GrowthCohorts.tsx', import.meta.url), 'utf8')
  assert.match(source, /active_last_week_state/)
  assert.match(source, /v_current_week_start - 7 >= v_measurement_available_from/)
  assert.match(source, /THEN 'measured'\s+ELSE 'no_data'/)
  assert.match(component, /active_last_week_state === 'no_data'/)
  assert.match(component, /value === null \? 'Sin datos'/)
})

test('los límites domingo-lunes usan semanas argentinas de lunes a domingo', () => {
  assert.equal(getBuenosAiresWeekStart('2026-11-01T23:59:59-03:00'), '2026-10-26')
  assert.equal(getBuenosAiresWeekStart('2026-11-02T00:00:00-03:00'), '2026-11-02')
  assert.equal(getBuenosAiresWeekStart('2026-11-02T02:59:59Z'), '2026-10-26')
  assert.equal(getBuenosAiresWeekStart('2026-11-02T03:00:00Z'), '2026-11-02')
})

test('la paginación mantiene límites, total y navegación estable', () => {
  assert.deepEqual(getMemberPageBounds(53, 0, 25), { start: 1, end: 25, hasPrevious: false, hasNext: true })
  assert.deepEqual(getMemberPageBounds(53, 2, 25), { start: 51, end: 53, hasPrevious: true, hasNext: false })
  assert.deepEqual(getMemberPageBounds(0, 0, 25), { start: 0, end: 0, hasPrevious: false, hasNext: false })
  assert.deepEqual(getMemberPageBounds(200, 0, 500), { start: 1, end: 100, hasPrevious: false, hasNext: true })
})

test('el detalle pagina antes de enriquecer perfiles y conserva el conteo exacto', () => {
  const source = readFileSync(new URL('../supabase/migrations/20261031120000_weekly_growth_cohorts.sql', import.meta.url), 'utf8')
  assert.match(source, /WITH eligible_members AS MATERIALIZED/)
  assert.match(source, /FROM eligible_members\s+ORDER BY account_created_at ASC, user_id ASC\s+LIMIT v_limit\s+OFFSET v_offset/)
  assert.match(source, /page_profiles AS MATERIALIZED/)
  assert.match(source, /SELECT COUNT\(\*\)::BIGINT FROM eligible_members/)
  assert.doesNotMatch(source, /WITH base_members AS MATERIALIZED/)
})

test('la visibilidad coincide con public_profiles y no exige completitud', () => {
  const source = readFileSync(new URL('../supabase/migrations/20261031120000_weekly_growth_cohorts.sql', import.meta.url), 'utf8')
  const publicView = readFileSync(new URL('../supabase/migration_company_candidate_feedback_and_identity.sql', import.meta.url), 'utf8')
  assert.match(publicView, /OR \(p\.account_type = 'empresa' AND p\.status IN \('activo', 'oculto'\)\)/)
  const directory = readFileSync(new URL('../src/stores/profile-store.ts', import.meta.url), 'utf8')
  assert.match(directory, /from\('public_profiles'\)[\s\S]*eq\('account_type', 'persona'\)[\s\S]*in\('intent', \['ofrecer', 'ambas'\]\)/)
  assert.match(source, /\(p\.status = 'activo'\) AS profile_visible/)
  assert.doesNotMatch(source, /profile_visible[\s\S]{0,180}p\.status IN \('activo', 'oculto'\)/)
  assert.match(source, /no muestra estados ocultos/)
})

test('la migración usa Auth para adquisición y una clave semanal única', () => {
  const source = readFileSync(new URL('../supabase/migrations/20261031120000_weekly_growth_cohorts.sql', import.meta.url), 'utf8')
  assert.match(source, /REFERENCES auth\.users\(id\)/)
  assert.match(source, /PRIMARY KEY \(user_id, week_start\)/)
  assert.match(source, /REVOKE ALL ON TABLE public\.user_activity_weeks FROM PUBLIC, anon, authenticated, service_role/)
  assert.match(source, /America\/Argentina\/Buenos_Aires/)
  assert.match(source, /EXTRACT\(ISODOW/)
  assert.match(source, /ON CONFLICT \(user_id, week_start\) DO NOTHING/)
  assert.match(source, /admin_only/)
  assert.match(source, /u\.created_at/)
  assert.match(source, /No registrado/)
  assert.match(source, /admin_get_auth_created_at_by_ids/)
  assert.match(source, /admin_get_growth_cohort_summary/)
  assert.match(source, /admin_get_growth_cohort_members\([\s\S]*p_limit INTEGER DEFAULT 50[\s\S]*p_offset INTEGER DEFAULT 0/)
  assert.match(source, /total_count/)
  assert.doesNotMatch(source, /user_metadata/)
  assert.doesNotMatch(source, /DROP TABLE|TRUNCATE|DELETE FROM|UPDATE public\.user_activity/i)
})

test('la migración mantiene autorización y search_path de funciones definidoras', () => {
  const source = readFileSync(new URL('../supabase/migrations/20261031120000_weekly_growth_cohorts.sql', import.meta.url), 'utf8')
  assert.equal((source.match(/SECURITY DEFINER/g) || []).length, 4)
  assert.equal((source.match(/SET search_path = pg_catalog, auth/g) || []).length, 4)
  assert.match(source, /auth\.jwt\(\) -> 'app_metadata' ->> 'role'/)
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.admin_get_growth_cohort_members\(DATE, INTEGER, BOOLEAN, INTEGER, INTEGER\) TO authenticated/)
  assert.doesNotMatch(source, /GRANT (SELECT|INSERT).*user_activity_weeks.*service_role/)
})
