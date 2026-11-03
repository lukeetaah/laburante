import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20261103180000_admin_account_deletion_system.sql', import.meta.url), 'utf8')
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

test('el frontend administrativo mantiene protegida la acción destructiva hasta su verificación remota', () => {
  assert.match(adminPage, /const ADMIN_ACCOUNT_DELETE_AVAILABLE = false/)
  assert.match(adminPage, /disabled=\{!ADMIN_ACCOUNT_DELETE_AVAILABLE\}/)
  assert.match(adminPage, /accountToDelete/)
  assert.match(adminPage, /trimmedReason\.length < 10/)
})

test('el almacén de trabajos utiliza el snapshot professional_name cuando el perfil ya no existe', () => {
  assert.match(jobStore, /item\.professional_name/)
})
