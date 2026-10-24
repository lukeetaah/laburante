import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasSupportedImageSignature,
  supportStoragePath,
  validateSupportTicketInput,
  SUPPORT_MAX_ATTACHMENT_BYTES,
} from '../src/lib/support.ts'

test('valida título y mensaje de soporte', () => {
  assert.equal(validateSupportTicketInput('  Acceso  ', '  Necesito ayuda  ').valid, true)
  assert.equal(validateSupportTicketInput('', 'mensaje').valid, false)
  assert.equal(validateSupportTicketInput('título', '   ').valid, false)
  assert.equal(validateSupportTicketInput('x'.repeat(161), 'mensaje').valid, false)
  assert.equal(validateSupportTicketInput('título', 'x'.repeat(5001)).valid, false)
})

test('acepta únicamente firmas de imagen compatibles', () => {
  assert.equal(hasSupportedImageSignature(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), true)
  assert.equal(hasSupportedImageSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true)
  assert.equal(hasSupportedImageSignature(Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]), 'image/webp'), true)
  assert.equal(hasSupportedImageSignature(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/jpeg'), false)
})

test('construye una ruta privada sin aceptar extensiones arbitrarias', () => {
  assert.equal(supportStoragePath('ticket', 'request', 'image/jpeg'), 'ticket/request.jpg')
  assert.equal(supportStoragePath('ticket', 'request', 'application/pdf'), null)
  assert.equal(SUPPORT_MAX_ATTACHMENT_BYTES, 5242880)
})

