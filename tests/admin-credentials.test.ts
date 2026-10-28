import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCredentialUpdate } from '../supabase/functions/admin-update-user-credentials/validation.ts'

const userId = '11111111-1111-4111-8111-111111111111'

test('rejects missing credential changes', () => {
  assert.equal(validateCredentialUpdate({ target_user_id: userId }).error, 'missing_credential_change')
})
test('rejects malformed target users and weak passwords', () => {
  assert.equal(validateCredentialUpdate({ target_user_id: 'not-a-uuid', new_password: '123456' }).error, 'invalid_target_user')
  assert.equal(validateCredentialUpdate({ target_user_id: userId, new_password: '123' }).error, 'weak_password')
  assert.equal(validateCredentialUpdate({ target_user_id: userId, new_password: '123456' }).error, 'missing_audit_reason')
})

test('normalizes email and preserves an explicit password update', () => {
  assert.deepEqual(validateCredentialUpdate({ target_user_id: userId, new_email: ' Admin@Example.COM ', new_password: '123456', reason: 'Solicitud de soporte verificada' }), {
    error: null,
    targetUserId: userId,
    email: 'admin@example.com',
    password: '123456',
    reason: 'Solicitud de soporte verificada',
  })
})
