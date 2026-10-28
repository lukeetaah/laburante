import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminSource = readFileSync(new URL('../src/pages/Admin.tsx', import.meta.url), 'utf8')

test('las acciones administrativas de perfiles usan RPC auditadas y exigen motivo', () => {
  assert.match(adminSource, /admin_update_profile/)
  assert.match(adminSource, /admin_set_company_plan_audited/)
  assert.match(adminSource, /admin_set_profile_status/)
  assert.match(adminSource, /admin_set_whatsapp_verification/)
  assert.match(adminSource, /admin_moderate_recommendation/)
  assert.match(adminSource, /Motivo obligatorio/)
  assert.match(adminSource, /edit_reason: reason/)
  assert.match(adminSource, /moderation_reason: reason/)
})

test('el panel no conserva fallbacks administrativos directos ni borrado de recomendaciones', () => {
  assert.doesNotMatch(adminSource, /from\('profiles'\)[\s\S]{0,180}\.update\(/)
  assert.doesNotMatch(adminSource, /from\('recommendations'\)[\s\S]{0,180}\.update\(/)
  assert.doesNotMatch(adminSource, /admin_set_company_plan'\s*,/)
  assert.doesNotMatch(adminSource, /admin_delete_recommendation/)
  assert.match(adminSource, /ADMIN_ACCOUNT_DELETE_AVAILABLE = false/)
})

test('el editor preserva relaciones no modificadas al omitir sus patches', () => {
  assert.match(adminSource, /if \(skillsPatch !== undefined\) rpcPayload\.skills_patch/)
  assert.match(adminSource, /if \(servicesPatch !== undefined\) rpcPayload\.services_patch/)
  assert.match(adminSource, /if \(contactsPatch !== undefined\) rpcPayload\.contact_methods_patch/)
  assert.match(adminSource, /if \(languagesPatch !== undefined\) rpcPayload\.languages_patch/)
})
