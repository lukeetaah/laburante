import assert from 'node:assert/strict'
import test from 'node:test'
import { registerCustomProposedSkills, type ProposedSkillsClient } from '../src/lib/proposed-skills.ts'

const profileId = '11111111-1111-4111-8111-111111111111'

function clientFor(insert: (values: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>): ProposedSkillsClient {
  return { from: (table) => {
    assert.equal(table, 'proposed_skills')
    return { insert }
  } }
}

test('registra una habilidad personalizada cuando la inserción termina correctamente', async () => {
  const payloads: Record<string, unknown>[] = []
  const result = await registerCustomProposedSkills(
    clientFor(async (values) => { payloads.push(values); return { error: null } }),
    ['Plomería industrial'],
    profileId,
  )

  assert.deepEqual(result, { attempted: 1, inserted: 1, failed: 0 })
  assert.deepEqual(payloads[0], { skill_name: 'Plomería industrial', proposed_by_profile_id: profileId, status: 'pendiente' })
})

test('expone un error devuelto por Supabase sin rechazar la creación del perfil', async () => {
  const queryErrors: string[] = []
  const result = await registerCustomProposedSkills(
    clientFor(async () => ({ error: { code: '23505' } })),
    ['Soldadura'],
    profileId,
    { onQueryError: (error) => queryErrors.push(error.code || 'unknown') },
  )

  assert.deepEqual(result, { attempted: 1, inserted: 0, failed: 1 })
  assert.deepEqual(queryErrors, ['23505'])
})

test('captura una excepción real durante la inserción y continúa', async () => {
  const exceptions: unknown[] = []
  const result = await registerCustomProposedSkills(
    clientFor(async () => { throw new TypeError('query builder failure') }),
    ['Tornería'],
    profileId,
    { onException: (error) => exceptions.push(error) },
  )

  assert.deepEqual(result, { attempted: 1, inserted: 0, failed: 1 })
  assert.equal(exceptions.length, 1)
  assert.equal(exceptions[0] instanceof TypeError, true)
})

test('un fallo complementario no revierte un perfil ya guardado', async () => {
  let profileSaved = true
  await registerCustomProposedSkills(
    clientFor(async () => ({ error: { code: 'permission_denied' } })),
    ['Instalación solar'],
    profileId,
  )

  assert.equal(profileSaved, true)
})

test('el flujo no consulta proposed_skills cuando no hay habilidades personalizadas', async () => {
  let queryCount = 0
  const result = await registerCustomProposedSkills(
    { from: () => { queryCount += 1; return { insert: async () => ({ error: null }) } } },
    [],
    profileId,
  )

  assert.deepEqual(result, { attempted: 0, inserted: 0, failed: 0 })
  assert.equal(queryCount, 0)
})
