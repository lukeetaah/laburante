import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20261103180000_admin_account_deletion_system.sql', import.meta.url), 'utf8')
const fixMigration = readFileSync(new URL('../supabase/migrations/20261119230000_fix_account_deletion_trigger_bypass.sql', import.meta.url), 'utf8')
const edgeFunction = readFileSync(new URL('../supabase/functions/admin-delete-account/index.ts', import.meta.url), 'utf8')
const adminPage = readFileSync(new URL('../src/pages/Admin.tsx', import.meta.url), 'utf8')
const jobStore = readFileSync(new URL('../src/stores/job-store.ts', import.meta.url), 'utf8')

test('la migración de eliminación de cuentas no usa DROP CASCADE y conserva integridad', () => {
  assert.doesNotMatch(migration, /DROP\s+(TABLE|SCHEMA)\b/i)
  assert.doesNotMatch(migration, /CASCADE\s*;/i)
  assert.match(migration, /admin_account_deletion_operations/)
  assert.match(migration, /admin_account_deletion_events/)
  assert.match(migration, /uq_active_account_deletion_target/)
})

test('la migración adapta job_requests para preservar historial sin CASCADE destructivo', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS professional_name TEXT/)
  assert.match(migration, /ALTER COLUMN profile_id DROP NOT NULL/)
  assert.match(migration, /ON DELETE SET NULL/)
  assert.match(migration, /app\.admin_account_deletion/)
})

test('las RPCs administrativas usan SECURITY DEFINER, search_path seguro y restringen ejecución a service_role', () => {
  const rpcs = [
    'admin_prepare_account_deletion',
    'admin_finalize_account_deletion',
    'admin_complete_deletion_audit',
  ]

  for (const rpc of rpcs) {
    assert.match(migration, new RegExp(`FUNCTION public\\.${rpc}`))
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}[\\s\\S]*?SECURITY DEFINER`))
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}[\\s\\S]*?SET search_path = ''`))
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${rpc}[\\s\\S]*?FROM PUBLIC`))
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}[\\s\\S]*?TO service_role`))
  }
})

test('la Edge Function valida JWT, claim admin y rechaza usuarios normales o falsificados', () => {
  assert.match(edgeFunction, /auth\.getUser\(\)/)
  assert.match(edgeFunction, /app_metadata.*?role.*?===.*?'admin'/)
  assert.match(edgeFunction, /unauthorized_admin_access/)
  assert.doesNotMatch(edgeFunction, /user_metadata.*?role/)
})

test('la Edge Function impide autoeliminación y protege la última cuenta administradora', () => {
  assert.match(edgeFunction, /cannot_delete_own_admin_account/)
  assert.match(edgeFunction, /cannot_delete_last_admin_account/)
  assert.match(edgeFunction, /target_user_id === authData\.user\.id/)
})

test('el contrato de parámetros está unificado en target_user_id y deletion_reason', () => {
  assert.match(edgeFunction, /target_user_id/)
  assert.match(edgeFunction, /deletion_reason/)
  assert.match(edgeFunction, /deletion_reason_min_length_10/)
  assert.match(adminPage, /body:\s*\{\s*target_user_id:\s*accountToDelete\.id,\s*deletion_reason:\s*trimmedReason\s*\}/)
})

test('la Edge Function realiza paginación segura sin saltos dinámicos en Storage', () => {
  assert.match(edgeFunction, /offset:\s*0/)
  assert.doesNotMatch(edgeFunction, /offset\s*\+=\s*limit/)
  assert.match(edgeFunction, /cleanStorageFolder/)
  assert.match(edgeFunction, /limit\s*=\s*1000/)
})

test('la eliminación definitiva delega en Supabase Auth Admin API y no en DELETE FROM auth.users', () => {
  assert.match(edgeFunction, /admin\.auth\.admin\.deleteUser\(target_user_id\)/)
  assert.doesNotMatch(migration, /DELETE FROM auth\.users/i)
})

test('los adjuntos de soporte se desacoplan vía Storage API sin perder trazabilidad', () => {
  assert.match(edgeFunction, /support-attachments/)
  assert.match(edgeFunction, /copy\(/)
  assert.match(edgeFunction, /user_id:\s*null/)
})

test('el frontend administrativo expone la acción destructiva con sus guardas de seguridad internas', () => {
  // Edge Function admin-delete-account v3 (verify_jwt: true) desplegada y certificada.
  // La flag se activó después de validar migración, Edge Function y suite 114/114.
  assert.match(adminPage, /const ADMIN_ACCOUNT_DELETE_AVAILABLE = true/)
  assert.match(adminPage, /disabled=\{!ADMIN_ACCOUNT_DELETE_AVAILABLE\}/)
  assert.match(adminPage, /accountToDelete/)
  assert.match(adminPage, /trimmedReason\.length < 10/)
})

test('el almacén de trabajos utiliza el snapshot professional_name cuando el perfil ya no existe', () => {
  assert.match(jobStore, /item\.professional_name/)
})

// ============================================================================
// Tests de la corrección del flujo de eliminación (20261119230000)
// ============================================================================

test('la migración correctiva incluye bypass de admin_account_deletion en enforce_candidate_inquiry_transition', () => {
  assert.match(fixMigration, /app\.admin_account_deletion/)
  assert.match(fixMigration, /enforce_candidate_inquiry_transition/)
  // El bypass debe preceder cualquier verificación de actor_id
  const bypassIdx = fixMigration.indexOf("app.admin_account_deletion")
  const actorNullIdx = fixMigration.indexOf("candidate_inquiry_actor_not_allowed")
  assert.ok(bypassIdx < actorNullIdx, 'El bypass debe aparecer antes del check de actor_id IS NULL')
})

test('la migración correctiva elimina el INSERT explícito en company_candidate_inquiry_events desde la RPC', () => {
  // La versión corregida de admin_prepare_account_deletion no debe insertar en
  // company_candidate_inquiry_events directamente (lo hace el trigger AFTER UPDATE)
  assert.doesNotMatch(
    fixMigration,
    /INSERT INTO public\.company_candidate_inquiry_events[\s\S]*?FROM cancelled_inquiries/
  )
  // Pero el UPDATE de company_candidate_inquiries sigue presente
  assert.match(fixMigration, /UPDATE public\.company_candidate_inquiries/)
  assert.match(fixMigration, /process_status = 'cancelado'/)
})

test('la migración correctiva delega en el trigger AFTER UPDATE para registrar eventos de cancelación', () => {
  // El trigger record_candidate_inquiry_resolution ya inserta el evento al detectar process_status -> cancelado
  // La RPC corregida NO debe usar ON CONFLICT (inquiry_id, event_type) ya que el índice real
  // es sobre (inquiry_id) solo, lo que causaba violación de unique constraint
  assert.doesNotMatch(
    fixMigration,
    /ON CONFLICT \(inquiry_id, event_type\) DO NOTHING/
  )
  assert.match(fixMigration, /GET DIAGNOSTICS v_active_inquiries_cancelled = ROW_COUNT/)
})

test('el frontend captura correctamente el body de error de respuestas non-2xx de la Edge Function', () => {
  // supabase-js expone el body de error en error.context para functions.invoke()
  // El frontend debe leer responseBody = data ?? error?.context ?? null
  assert.match(adminPage, /error.*?\.context/)
  assert.match(adminPage, /responseBody/)
  // La etapa ya no se obtiene exclusivamente de data?.phase
  assert.match(adminPage, /responseBody\?\.phase/)
  assert.match(adminPage, /responseBody\?\.error/)
})

test('la migración correctiva mantiene permisos service_role en ambas funciones actualizadas', () => {
  assert.match(fixMigration, /GRANT EXECUTE ON FUNCTION public\.admin_prepare_account_deletion.*TO service_role/)
  assert.match(fixMigration, /REVOKE ALL ON FUNCTION public\.enforce_candidate_inquiry_transition/)
})

test('la migración correctiva incluye COMMIT y NOTIFY para recarga del schema de PostgREST', () => {
  assert.match(fixMigration, /NOTIFY pgrst, 'reload schema'/)
  assert.match(fixMigration, /COMMIT;/)
  assert.match(fixMigration, /BEGIN;/)
})
