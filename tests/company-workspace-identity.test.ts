import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CANDIDATE_NAME_FALLBACK,
  getCandidateDisplayName,
  inquiryStatusClass,
  inquiryStatusLabel,
  mergeCandidateIdentities,
  opportunityStatusLabel,
} from '../src/lib/company-identity.ts'

const workspace = readFileSync(new URL('../src/pages/CompanyWorkspace.tsx', import.meta.url), 'utf8')
const inquiryMigration = readFileSync(new URL('../supabase/migration_company_candidate_inquiries.sql', import.meta.url), 'utf8')
const securityMigration = readFileSync(new URL('../supabase/migration_adversarial_security_hardening.sql', import.meta.url), 'utf8')

test('resuelve el nombre canónico de una invitación y de una contratación sin mezclar destinatarios', () => {
  const inquiryIds = ['candidate-a', 'candidate-b']
  const identities = mergeCandidateIdentities(
    inquiryIds,
    [{ id: 'candidate-a', name: ' Ana Pérez ' }, { id: 'candidate-b', name: 'Bruno Gómez' }],
  )

  assert.equal(getCandidateDisplayName(identities.get('candidate-a')), 'Ana Pérez')
  assert.equal(getCandidateDisplayName(identities.get('candidate-b')), 'Bruno Gómez')
  assert.equal(identities.has('candidate-other'), false)
})

test('usa un fallback honesto para nombre vacío, perfil ausente y conserva nombres largos', () => {
  assert.equal(getCandidateDisplayName({ name: '   ' }), CANDIDATE_NAME_FALLBACK)
  assert.equal(getCandidateDisplayName(undefined), CANDIDATE_NAME_FALLBACK)
  const longName = 'María de los Ángeles Fernández de la Cruz'
  assert.equal(getCandidateDisplayName({ name: longName }), longName)
})

test('completa desde el modelo público sólo los perfiles faltantes', () => {
  const identities = mergeCandidateIdentities(
    ['candidate-a', 'candidate-b', 'candidate-missing'],
    [{ id: 'candidate-a', name: 'Ana Pérez' }, { id: 'candidate-b', name: '' }],
    [{ id: 'candidate-b', name: 'Bruno Gómez' }, { id: 'candidate-unrelated', name: 'No corresponde' }],
  )

  assert.equal(identities.get('candidate-a')?.name, 'Ana Pérez')
  assert.equal(identities.get('candidate-b')?.name, 'Bruno Gómez')
  assert.equal(identities.has('candidate-unrelated'), false)
  assert.equal(getCandidateDisplayName(identities.get('candidate-missing')), CANDIDATE_NAME_FALLBACK)
})

test('normaliza únicamente estados existentes del circuito', () => {
  assert.equal(inquiryStatusLabel('pendiente'), 'Pendiente')
  assert.equal(inquiryStatusLabel('aceptada'), 'Aceptada')
  assert.equal(inquiryStatusLabel('rechazada'), 'Rechazada')
  assert.equal(inquiryStatusLabel('cerrada'), 'Cerrada')
  assert.equal(opportunityStatusLabel('interesada'), 'Interesada')
  assert.match(inquiryStatusClass('rechazada'), /rose/)
  assert.equal(inquiryStatusLabel('estado-futuro'), 'estado-futuro')
})

test('la pantalla usa el vínculo profile_id, limita la consulta y no vuelve a Profesional como identidad', () => {
  assert.match(workspace, /select\(CANDIDATE_PROFILE_SELECT\)\.in\('id', profileIds\)/)
  assert.match(workspace, /select\(CANDIDATE_PROFILE_SELECT\)\.in\('id', missingProfileIds\)/)
  assert.match(workspace, /getCandidateDisplayName\(item\.profile\)/)
  assert.match(workspace, /if \(profilesError\)[\s\S]*setOpportunitiesError\('No se pudo verificar la identidad/)
  assert.match(workspace, /fallbackProfilesError/)
  assert.doesNotMatch(workspace, /item\.profile\?\.name \|\| 'Profesional'/)
  assert.doesNotMatch(workspace, /selectedCandidateInquiry\.profile\?\.name \|\| 'Profesional'/)
})

test('la base mantiene el aislamiento por empresa y persona sin ampliar permisos', () => {
  assert.match(inquiryMigration, /company_id UUID NOT NULL REFERENCES auth\.users\(id\)/)
  assert.match(inquiryMigration, /profile_id UUID NOT NULL REFERENCES public\.profiles\(id\)/)
  assert.match(inquiryMigration, /auth\.uid\(\) = company_id OR auth\.uid\(\) = profile_id/)
  assert.match(securityMigration, /CREATE OR REPLACE VIEW public\.authenticated_candidate_profiles/)
  assert.match(securityMigration, /i\.company_id = auth\.uid\(\)/)
  assert.match(securityMigration, /GRANT SELECT ON public\.authenticated_candidate_profiles TO authenticated/)
  assert.doesNotMatch(workspace, /from\('auth\.users'\)/)
  assert.doesNotMatch(workspace, /user_metadata.*role|role.*user_metadata/)
})
