import assert from 'node:assert/strict'
import test from 'node:test'
import { describeLastSignIn } from '../src/lib/auth-activity.ts'

test('distingue servicio no disponible, usuario inexistente y nunca ingresó', () => {
  assert.match(describeLastSignIn('service_unavailable', null), /no se pudo consultar Auth/)
  assert.match(describeLastSignIn('user_not_found', null), /no encontrado/)
  assert.match(describeLastSignIn('never', null), /Nunca ingresó/)
})
test('presenta el timestamp real sin sustituirlo por updated_at', () => {
  const timestamp = '2026-10-20T12:00:00.000Z'
  assert.match(describeLastSignIn('available', timestamp, Date.parse('2026-10-25T12:00:00.000Z')), /20\/10\/2026|10\/20\/2026/)
})
