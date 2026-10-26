import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { supportUploadErrorMessage } from '../src/lib/support.ts'

const migration = readFileSync(new URL('../supabase/migration_support_upload_path_validation_fix.sql', import.meta.url), 'utf8')
const edgeFunction = readFileSync(new URL('../supabase/functions/support-upload-attachment/index.ts', import.meta.url), 'utf8')

test('la ruta de adjunto acepta solo el ticket, la autorización y una extensión permitida', () => {
  assert.ok(migration.includes("p_ticket_id::text || '/' || p_upload_request_id::text || '[.](png|jpg|webp)$'"))
  assert.match(migration, /r\.id = p_upload_request_id AND r\.ticket_id = p_ticket_id AND r\.user_id = actor_id/)
  assert.match(migration, /request_row\.status <> 'vigente' OR request_row\.expires_at <= now\(\)/)
  assert.match(migration, /UPDATE public\.support_upload_requests SET status = 'usada'/)
})

test('la autorización se bloquea por fila y el registro consume una sola vez', () => {
  assert.match(migration, /FOR UPDATE/)
  assert.match(migration, /WHERE id = p_upload_request_id AND status = 'vigente'/)
  assert.match(migration, /INSERT INTO public\.support_attachments/)
})

test('la Edge Function valida bytes, evita la subida directa y limpia Storage si falla el registro', () => {
  assert.match(edgeFunction, /hasSignature\(bytes, file\.type\)/)
  assert.match(edgeFunction, /support-attachments'\)\.upload\(path, file, \{ contentType: file\.type, upsert: false \}\)/)
  assert.match(edgeFunction, /consume_support_upload/)
  assert.match(edgeFunction, /support-attachments'\)\.remove\(\[path\]\)/)
})

test('la respuesta CORS permite la instrumentación del navegador sin abrir los orígenes', () => {
  assert.match(edgeFunction, /Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, baggage, sentry-trace'/)
  assert.match(edgeFunction, /allowedOrigin = origin === site \|\| origin === 'https:\/\/laburante\.ar'/)
  assert.doesNotMatch(edgeFunction, /Access-Control-Allow-Origin': '\*'/)
})

test('los errores de la Edge Function se traducen a mensajes seguros y no a éxito', () => {
  assert.match(supportUploadErrorMessage('upload_not_authorized'), /no existe, venció o ya fue utilizada/)
  assert.match(supportUploadErrorMessage('invalid_image_content'), /no coincide/)
  assert.match(supportUploadErrorMessage('attachment_storage_failed'), /no se pudo guardar/)
  assert.match(supportUploadErrorMessage('attachment_registration_failed'), /No se pudo registrar/)
  assert.match(supportUploadErrorMessage('unexpected', 500), /No se pudo completar/)
})

