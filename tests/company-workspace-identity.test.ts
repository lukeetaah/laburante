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
  processStatusClass,
  processStatusLabel,
} from '../src/lib/company-identity.ts'

const workspace = readFileSync(new URL('../src/pages/CompanyWorkspace.tsx', import.meta.url), 'utf8')
const personView = readFileSync(new URL('../src/pages/OrdersDashboard.tsx', import.meta.url), 'utf8')
const inquiryMigration = readFileSync(new URL('../supabase/migration_company_candidate_inquiries.sql', import.meta.url), 'utf8')
const securityMigration = readFileSync(new URL('../supabase/migration_adversarial_security_hardening.sql', import.meta.url), 'utf8')
const resolutionMigration = readFileSync(new URL('../supabase/migrations/20261102120000_company_candidate_resolution.sql', import.meta.url), 'utf8')
const adminControlsMigration = readFileSync(new URL('../supabase/migration_admin_controls.sql', import.meta.url), 'utf8')

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

test('mantiene separado el estado de interacción del resultado del proceso', () => {
  assert.equal(processStatusLabel('abierto'), 'Selección abierta')
  assert.equal(processStatusLabel('en_evaluacion'), 'En evaluación')
  assert.equal(processStatusLabel('contratado'), 'Contratado')
  assert.equal(processStatusLabel('no_seleccionado'), 'No seleccionado')
  assert.equal(processStatusLabel('cancelado'), 'Cancelado')
  assert.match(processStatusClass('contratado'), /emerald/)
  assert.match(processStatusClass('no_seleccionado'), /slate/)
})

test('la pantalla usa el vínculo profile_id, limita la consulta y no vuelve a Profesional como identidad', () => {
  assert.match(workspace, /select\(CANDIDATE_PROFILE_SELECT\)\.in\('id', profileIds\)/)
  assert.match(workspace, /select\(CANDIDATE_PROFILE_SELECT\)\.in\('id', missingProfileIds\)/)
  assert.match(workspace, /getCandidateDisplayName\(item\.profile\)/)
  assert.match(workspace, /if \(profilesError\)[\s\S]*setOpportunitiesError\('No se pudo verificar la identidad/)
  assert.match(workspace, /fallbackProfilesError/)
  assert.match(workspace, /const missingProfileIds = profileIds\.filter/)
  assert.match(workspace, /resolve_company_candidate_inquiry/)
  assert.match(workspace, /target_inquiry_id: inquiryId/)
  assert.match(workspace, /target_process_status: outcome/)
  assert.doesNotMatch(workspace, /resolved_at\s*:/)
  assert.doesNotMatch(workspace, /resolved_by\s*:/)
  assert.doesNotMatch(workspace, /update\(\{\s*process_status:/)
  assert.doesNotMatch(workspace, /setCandidateInquiries\(\(items\) =>[\s\S]{0,300}process_status/)
  assert.doesNotMatch(workspace, /item\.profile\?\.name \|\| 'Profesional'/)
  assert.doesNotMatch(workspace, /selectedCandidateInquiry\.profile\?\.name \|\| 'Profesional'/)
})

test('la vista de la persona no confunde recepción con entrevista y conserva el historial de resolución', () => {
  assert.match(personView, /select\('\*'\)\.eq\('profile_id', user\.id\)/)
  assert.match(personView, /\.select\('id, inquiry_id, status, modality, scheduled_at, location_or_link, notes, created_at, updated_at'\)/)
  assert.match(personView, /Recibida el/)
  assert.match(personView, /processStatusLabel\(getProcessStatus\(selectedCompanyInquiry\)\)/)
  assert.match(personView, /No hay una entrevista programada en el registro estructurado/)
  assert.match(personView, /companyInquiriesError/)
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

test('la resolución exige empresa autorizada, interacción aceptada y deja un evento único', () => {
  assert.match(resolutionMigration, /process_status IN \('abierto', 'en_evaluacion', 'contratado', 'no_seleccionado', 'cancelado'\)/)
  assert.match(resolutionMigration, /NEW\.process_status IN \('contratado', 'no_seleccionado'\) AND OLD\.status <> 'aceptada'/)
  assert.match(resolutionMigration, /OLD\.process_status IN \('contratado', 'no_seleccionado', 'cancelado'\)/)
  assert.match(resolutionMigration, /OLD\.process_status = 'en_evaluacion'[\s\S]*candidate_inquiry_process_transition_not_allowed/)
  assert.match(resolutionMigration, /candidate_inquiry_archive_not_allowed/)
  assert.match(resolutionMigration, /candidate_inquiry_resolution_rpc_required/)
  assert.match(resolutionMigration, /set_config\('app\.company_candidate_resolution', '1', true\)/)
  assert.match(resolutionMigration, /candidate_inquiry_close_requires_process_resolution/)
  assert.match(resolutionMigration, /NEW\.resolved_at := clock_timestamp\(\)/)
  assert.match(resolutionMigration, /NEW\.resolved_by := actor_id/)
  assert.match(resolutionMigration, /CREATE OR REPLACE FUNCTION public\.resolve_company_candidate_inquiry/)
  assert.match(resolutionMigration, /app\.company_candidate_resolution_migration/)
  assert.match(resolutionMigration, /PERFORM set_config\('app\.company_candidate_resolution_migration', '1', true\)/)
  assert.match(resolutionMigration, /FOR UPDATE/)
  assert.match(resolutionMigration, /GRANT EXECUTE ON FUNCTION public\.resolve_company_candidate_inquiry\(UUID, TEXT\) TO authenticated/)
  assert.match(resolutionMigration, /UNIQUE \(inquiry_id, event_type\)/)
  assert.match(resolutionMigration, /ON CONFLICT \(inquiry_id, event_type\) DO NOTHING/)
  assert.doesNotMatch(resolutionMigration, /company_candidate_inquiry_events[\s\S]{0,180}ON DELETE CASCADE/)
  assert.match(resolutionMigration, /inquiry_id UUID REFERENCES public\.company_candidate_inquiries\(id\) ON DELETE SET NULL/)
  assert.match(resolutionMigration, /company_id UUID NOT NULL,[\s\S]*profile_id UUID NOT NULL/)
  assert.match(resolutionMigration, /uq_company_candidate_inquiry_events_terminal/)
  assert.match(resolutionMigration, /REVOKE ALL ON public\.company_candidate_inquiry_events FROM PUBLIC, anon, authenticated/)
  assert.match(resolutionMigration, /GRANT SELECT ON public\.company_candidate_inquiry_events TO authenticated/)
  assert.match(resolutionMigration, /auth\.uid\(\) = i\.company_id OR auth\.uid\(\) = i\.profile_id/)
  assert.match(resolutionMigration, /inquiry\.company_id <> actor_id/)
  assert.match(resolutionMigration, /FOR UPDATE/)
  assert.match(resolutionMigration, /inquiry\.profile_id/)
  assert.match(resolutionMigration, /dedupe_key|inquiry:%s:resolution:/)
  assert.match(resolutionMigration, /La empresa cerró este proceso sin avanzar con una contratación/)
  assert.match(resolutionMigration, /notify_company_candidate_resolution/)
  assert.match(resolutionMigration, /_insert_notification_server/)
  assert.match(resolutionMigration, /SET search_path = ''/)
  assert.match(adminControlsMigration, /DELETE FROM public\.profiles WHERE id = target_user_id/)
  assert.match(adminControlsMigration, /DELETE FROM auth\.users WHERE id = target_user_id/)
  assert.doesNotMatch(resolutionMigration, /DROP TABLE|TRUNCATE|DISABLE ROW LEVEL SECURITY/i)
})
