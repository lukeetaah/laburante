import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyAdminActivityResult, describeAdminActivityFailure } from '../src/lib/admin-activity.ts'

test('clasifica cada respuesta HTTP administrativa sin exponer el cuerpo', async () => {
  for (const [status, error, kind] of [[401, 'unauthorized', 'unauthorized'], [403, 'unauthorized_admin_access', 'unauthorized_admin_access'], [502, 'auth_users_unavailable', 'auth_users_unavailable']] as const) {
    const result = await classifyAdminActivityResult({ data: null, error: { name: 'FunctionsHttpError' }, response: new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } }) })
    assert.equal(result.available, false)
    if (!result.available) assert.deepEqual(result.failure, { kind, httpStatus: status })
  }
})

test('clasifica cuerpos HTTP vacíos o JSON inválido sin exponerlos', async () => {
  const emptyUnauthorized = await classifyAdminActivityResult({ data: null, error: { name: 'FunctionsHttpError' }, response: new Response('', { status: 401 }) })
  const invalidJsonFromAuth = await classifyAdminActivityResult({ data: null, error: { name: 'FunctionsHttpError' }, response: new Response('{', { status: 502, headers: { 'Content-Type': 'application/json' } }) })
  assert.equal(emptyUnauthorized.available, false); if (!emptyUnauthorized.available) assert.deepEqual(emptyUnauthorized.failure, { kind: 'unauthorized', httpStatus: 401 })
  assert.equal(invalidJsonFromAuth.available, false); if (!invalidJsonFromAuth.available) assert.deepEqual(invalidJsonFromAuth.failure, { kind: 'auth_users_unavailable', httpStatus: 502 })
})

test('conserva códigos diagnósticos seguros de la función', async () => {
  const result = await classifyAdminActivityResult({
    data: null,
    error: { name: 'FunctionsHttpError' },
    response: new Response(JSON.stringify({ error: 'auth_users_unavailable', diagnostic_code: 'RPC_QUERY_FAILED' }), { status: 502 }),
  })
  assert.equal(result.available, false)
  if (!result.available) {
    assert.deepEqual(result.failure, { kind: 'auth_users_unavailable', httpStatus: 502, diagnosticCode: 'RPC_QUERY_FAILED' })
    assert.match(describeAdminActivityFailure(result.failure), /falló la consulta de actividad/i)
  }
})

test('distingue red, errores de parseo HTTP 2xx y contratos inválidos', async () => {
  const network = await classifyAdminActivityResult({ data: null, error: { name: 'FunctionsFetchError' } })
  const unexpected = await classifyAdminActivityResult({ data: null, error: { name: 'FunctionsHttpError' }, response: new Response('upstream error', { status: 500 }) })
  // functions-js devuelve esta forma cuando response.json() falla después de un HTTP 2xx.
  const malformedJson = await classifyAdminActivityResult({ data: null, error: new SyntaxError('Unexpected token') })
  const invalid = await classifyAdminActivityResult({ data: { status: 'ok', users: 'not-an-array' }, error: null })
  assert.equal(network.available, false); if (!network.available) assert.equal(network.failure.kind, 'network')
  assert.equal(unexpected.available, false); if (!unexpected.available) assert.deepEqual(unexpected.failure, { kind: 'unexpected_http', httpStatus: 500 })
  assert.equal(malformedJson.available, false); if (!malformedJson.available) assert.deepEqual(malformedJson.failure, { kind: 'invalid_response', httpStatus: null })
  assert.equal(invalid.available, false); if (!invalid.available) assert.equal(invalid.failure.kind, 'invalid_response')
})

test('rechaza toda respuesta con elementos users fuera del contrato', async () => {
  const result = await classifyAdminActivityResult({ data: { status: 'ok', users: [{ id: 'user-1', last_sign_in_at: null }, { id: 'user-2', last_sign_in_at: null, last_sign_in_status: 'never' }] }, error: null })
  assert.equal(result.available, false)
  if (!result.available) assert.deepEqual(result.failure, { kind: 'invalid_response', httpStatus: null })
})

test('acepta una respuesta válida aun cuando no tenga inicios de sesión', async () => {
  const result = await classifyAdminActivityResult({ data: { status: 'ok', users: [{ id: 'user-1', last_sign_in_at: null, last_sign_in_status: 'never' }] }, error: null })
  assert.equal(result.available, true)
  if (result.available) assert.deepEqual(result.users['user-1'], { id: 'user-1', last_sign_in_at: null, last_sign_in_status: 'never' })
})

test('los mensajes de falla son seguros y específicos', () => {
  assert.match(describeAdminActivityFailure({ kind: 'unauthorized', httpStatus: 401 }), /sesión administrativa/i)
  assert.doesNotMatch(describeAdminActivityFailure({ kind: 'unexpected_http', httpStatus: 500 }), /token|bearer|uuid|@/i)
})
