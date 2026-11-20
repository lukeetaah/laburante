import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateWhatsAppReference,
  isValidVerificationCodeOrRef,
  isVerificationRequestExpired,
  calculateExpirationDate,
  generateWhatsAppVerificationMessage,
  normalizeWhatsAppPhone,
  areWhatsAppPhonesMatching,
} from '../src/lib/whatsapp-reference.ts'

test('generateWhatsAppReference creates LB- prefixed reference without ambiguous characters', () => {
  const ref = generateWhatsAppReference()
  assert.match(ref, /^LB-[2-9A-HJ-NP-Z]{8}$/)
  assert.equal(ref.includes('0'), false)
  assert.equal(ref.includes('O'), false)
  assert.equal(ref.includes('1'), false)
  assert.equal(ref.includes('I'), false)

  // Custom length (ej. 10 caracteres)
  const ref10 = generateWhatsAppReference(10)
  assert.match(ref10, /^LB-[2-9A-HJ-NP-Z]{10}$/)
})

test('generateWhatsAppReference produces unique references', () => {
  const generated = new Set<string>()
  for (let i = 0; i < 500; i++) {
    const ref = generateWhatsAppReference()
    assert.equal(generated.has(ref), false, `Collision detected on iteration ${i}`)
    generated.add(ref)
  }
  assert.equal(generated.size, 500)
})

test('isValidVerificationCodeOrRef supports both legacy and modern formats', () => {
  // Legacy codes
  assert.equal(isValidVerificationCodeOrRef('LAB-123456'), true)
  assert.equal(isValidVerificationCodeOrRef('lab-654321'), true)
  assert.equal(isValidVerificationCodeOrRef('LAB-12345'), false) // less digits
  assert.equal(isValidVerificationCodeOrRef('LAB-ABCDEF'), false) // letters not allowed in legacy

  // Modern references (exactamente 8 caracteres en alfabeto Crockford sin 0, O, 1, I)
  assert.equal(isValidVerificationCodeOrRef('LB-7K9M2P4X'), true)
  assert.equal(isValidVerificationCodeOrRef('lb-7k9m2p4x'), true) // case insensitive
  assert.equal(isValidVerificationCodeOrRef('LB-23456789'), true)
  assert.equal(isValidVerificationCodeOrRef('LB-ABCDEFGH'), true)
  assert.equal(isValidVerificationCodeOrRef('LB-7K9M2P4'), false) // 7 chars (muy corto)
  assert.equal(isValidVerificationCodeOrRef('LB-7K9M2P4XY'), false) // 9 chars (muy largo)
  assert.equal(isValidVerificationCodeOrRef('LB-7K9M2P40'), false) // contiene '0'
  assert.equal(isValidVerificationCodeOrRef('LB-7K9M2P4O'), false) // contiene 'O'
  assert.equal(isValidVerificationCodeOrRef('LB-7K9M2P41'), false) // contiene '1'
  assert.equal(isValidVerificationCodeOrRef('LB-7K9M2P4I'), false) // contiene 'I'
  assert.equal(isValidVerificationCodeOrRef(''), false)
  assert.equal(isValidVerificationCodeOrRef(null), false)
  assert.equal(isValidVerificationCodeOrRef('OTP-123456'), false)
})

test('isVerificationRequestExpired handles modern expiry and preserves legacy requests without expiry', () => {
  // Legacy request without expires_at (null/undefined) is never expired
  assert.equal(isVerificationRequestExpired(null), false)
  assert.equal(isVerificationRequestExpired(undefined), false)
  assert.equal(isVerificationRequestExpired(''), false)

  // Past expiry is expired
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString()
  assert.equal(isVerificationRequestExpired(pastDate), true)

  // Future expiry is not expired
  const futureDate = calculateExpirationDate(48)
  assert.equal(isVerificationRequestExpired(futureDate), false)
})

test('generateWhatsAppVerificationMessage includes solicitante name, intent and reference code', () => {
  const msgLucas = generateWhatsAppVerificationMessage('Lucas', 'LB-7K9M2P4X')
  assert.ok(msgLucas.includes('Hola, soy Lucas.'))
  assert.ok(msgLucas.includes('Estoy solicitando verificar mi número de WhatsApp en LABURANTE.'))
  assert.ok(msgLucas.includes('Mi referencia de verificación es: LB-7K9M2P4X.'))

  // Sin nombre o con nombre vacío
  const msgEmpty = generateWhatsAppVerificationMessage('', 'LB-23456789')
  assert.ok(msgEmpty.includes('Hola.'))
  assert.ok(msgEmpty.includes('Mi referencia de verificación es: LB-23456789.'))

  const msgNull = generateWhatsAppVerificationMessage(null, 'LB-ABCDEFGH')
  assert.ok(msgNull.includes('Hola.'))
  assert.ok(msgNull.includes('Mi referencia de verificación es: LB-ABCDEFGH.'))
})

test('normalizeWhatsAppPhone handles all Argentine and international phone variants', () => {
  // AMBA (área 11)
  assert.equal(normalizeWhatsAppPhone('+54 9 11 1234-5678'), '1112345678')
  assert.equal(normalizeWhatsAppPhone('+54 11 1234-5678'), '1112345678')
  assert.equal(normalizeWhatsAppPhone('011 15 1234-5678'), '1112345678')
  assert.equal(normalizeWhatsAppPhone('011 1234-5678'), '1112345678')
  assert.equal(normalizeWhatsAppPhone('11 15 1234-5678'), '1112345678')
  assert.equal(normalizeWhatsAppPhone('11 1234-5678'), '1112345678')
  assert.equal(normalizeWhatsAppPhone('1112345678'), '1112345678')

  // Interior: Córdoba (área 351, 3 dígitos)
  assert.equal(normalizeWhatsAppPhone('+54 9 351 123-4567'), '3511234567')
  assert.equal(normalizeWhatsAppPhone('0351 15 123-4567'), '3511234567')
  assert.equal(normalizeWhatsAppPhone('0351 123-4567'), '3511234567')
  assert.equal(normalizeWhatsAppPhone('351 123-4567'), '3511234567')

  // Interior: Bariloche (área 2944, 4 dígitos)
  assert.equal(normalizeWhatsAppPhone('+54 9 2944 12-3456'), '2944123456')
  assert.equal(normalizeWhatsAppPhone('02944 15 12-3456'), '2944123456')
  assert.equal(normalizeWhatsAppPhone('2944 12-3456'), '2944123456')

  // Internacional
  assert.equal(normalizeWhatsAppPhone('+598 99 123 456'), '59899123456')
  assert.equal(normalizeWhatsAppPhone(''), '')
  assert.equal(normalizeWhatsAppPhone(null), '')
})

test('areWhatsAppPhonesMatching compares formats of the same line and rejects distinct lines', () => {
  // Misma línea en formatos equivalentes
  assert.equal(areWhatsAppPhonesMatching('+54 9 11 1234 5678', '11 1234-5678'), true)
  assert.equal(areWhatsAppPhonesMatching('011 15 1234-5678', '+54 9 11 1234 5678'), true)
  assert.equal(areWhatsAppPhonesMatching('0351 15 123-4567', '+54 9 351 123 4567'), true)

  // Líneas completamente distintas (número telefónico diferente)
  assert.equal(areWhatsAppPhonesMatching('11 1234-5678', '11 9999-8888'), false)
  assert.equal(areWhatsAppPhonesMatching('+54 9 11 1234 5678', '+54 9 11 5555 4444'), false)
  assert.equal(areWhatsAppPhonesMatching('351 123-4567', '351 987-6543'), false)
})

// Simulador de motor transaccional de verificación para validar las 10 reglas obligatorias
interface MockProfile {
  id: string
  name: string
  whatsapp_verified: boolean
}
interface MockContact {
  id: string
  profile_id: string
  type: string
  value: string
}
interface MockRequest {
  id: string
  profile_id: string
  phone_declared: string
  code: string
  status: 'pendiente' | 'aprobado' | 'rechazado'
  expires_at: string | null
  created_at: string
}

function simulateApproveVerification(
  callerRole: string | null,
  requestId: string,
  inputCode: string,
  state: {
    profiles: MockProfile[]
    contacts: MockContact[]
    requests: MockRequest[]
  }
) {
  // 1. Autorización administrativa
  if (callerRole !== 'admin') {
    throw new Error('whatsapp_admin_only')
  }

  // 2. Localizar solicitud
  const req = state.requests.find((r) => r.id === requestId)
  if (!req) {
    throw new Error('whatsapp_request_not_found')
  }

  // 3. Localizar perfil
  const profile = state.profiles.find((p) => p.id === req.profile_id)
  if (!profile) {
    throw new Error('whatsapp_profile_not_found')
  }

  // 4. Estado de solicitud
  if (req.status !== 'pendiente') {
    throw new Error('whatsapp_request_already_resolved')
  }

  // 5. Vigencia
  const now = Date.now()
  if (req.expires_at && new Date(req.expires_at).getTime() < now) {
    throw new Error('whatsapp_request_expired')
  }
  if (!req.expires_at && /^LB-/i.test(req.code)) {
    throw new Error('whatsapp_request_untrusted_legacy_lb')
  }

  // 6. Validación de código
  if (req.code.toUpperCase().trim() !== inputCode.toUpperCase().trim()) {
    throw new Error('whatsapp_code_invalid')
  }

  // 7. Normalización y comprobación de contacto
  const declaredNorm = normalizeWhatsAppPhone(req.phone_declared)
  if (!declaredNorm || declaredNorm.length < 8) {
    throw new Error('whatsapp_phone_invalid')
  }

  const userContacts = state.contacts.filter((c) => c.profile_id === profile.id && c.type === 'whatsapp')
  if (userContacts.length > 1) {
    throw new Error('whatsapp_multiple_contacts')
  }

  if (userContacts.length === 1) {
    const currentNorm = normalizeWhatsAppPhone(userContacts[0].value)
    if (!areWhatsAppPhonesMatching(userContacts[0].value, req.phone_declared)) {
      throw new Error('whatsapp_phone_mismatch')
    }
    userContacts[0].value = req.phone_declared
  } else {
    // Si no existía contacto WhatsApp en el perfil, se inserta con el número verificado
    state.contacts.push({
      id: `contact-${Date.now()}-${Math.random()}`,
      profile_id: profile.id,
      type: 'whatsapp',
      value: req.phone_declared,
    })
  }

  // 8. Aprobar perfil y solicitud
  profile.whatsapp_verified = true
  req.status = 'aprobado'

  return {
    approved_profile_id: profile.id,
    approved_phone: req.phone_declared,
    normalized_phone: declaredNorm,
  }
}

test('1, 2 y 3: Dos cuentas con el mismo número tienen referencias distintas y aprobación independiente', () => {
  const state = {
    profiles: [
      { id: 'usr-1', name: 'Lucas Personal', whatsapp_verified: false },
      { id: 'usr-2', name: 'Lucas Empresa', whatsapp_verified: false },
    ],
    contacts: [
      { id: 'c-1', profile_id: 'usr-1', type: 'whatsapp', value: '+54 9 11 2345 6789' },
      { id: 'c-2', profile_id: 'usr-2', type: 'whatsapp', value: '11 2345 6789' },
    ],
    requests: [
      {
        id: 'req-1',
        profile_id: 'usr-1',
        phone_declared: '+54 9 11 2345 6789',
        code: 'LB-AAAA1111',
        status: 'pendiente' as const,
        expires_at: calculateExpirationDate(48),
        created_at: new Date().toISOString(),
      },
      {
        id: 'req-2',
        profile_id: 'usr-2',
        phone_declared: '11 2345 6789',
        code: 'LB-BBBB2222',
        status: 'pendiente' as const,
        expires_at: calculateExpirationDate(48),
        created_at: new Date().toISOString(),
      },
    ],
  }

  // Aprobación independiente de Cuenta 1
  const res1 = simulateApproveVerification('admin', 'req-1', 'LB-AAAA1111', state)
  assert.equal(res1.approved_profile_id, 'usr-1')
  assert.equal(state.profiles[0].whatsapp_verified, true)
  assert.equal(state.requests[0].status, 'aprobado')

  // Cuenta 2 debe permanecer intacta en estado pendiente y no verificada
  assert.equal(state.profiles[1].whatsapp_verified, false)
  assert.equal(state.requests[1].status, 'pendiente')

  // Aprobación independiente de Cuenta 2
  const res2 = simulateApproveVerification('admin', 'req-2', 'LB-BBBB2222', state)
  assert.equal(res2.approved_profile_id, 'usr-2')
  assert.equal(state.profiles[1].whatsapp_verified, true)
  assert.equal(state.requests[1].status, 'aprobado')
})

test('4: Rechazo de referencias inexistentes o códigos erróneos', () => {
  const state = {
    profiles: [{ id: 'usr-1', name: 'Lucas', whatsapp_verified: false }],
    contacts: [{ id: 'c-1', profile_id: 'usr-1', type: 'whatsapp', value: '1123456789' }],
    requests: [
      {
        id: 'req-1',
        profile_id: 'usr-1',
        phone_declared: '1123456789',
        code: 'LB-CORRECTO',
        status: 'pendiente' as const,
        expires_at: calculateExpirationDate(48),
        created_at: new Date().toISOString(),
      },
    ],
  }

  // ID inexistente
  assert.throws(
    () => simulateApproveVerification('admin', 'req-inexistente', 'LB-CORRECTO', state),
    /whatsapp_request_not_found/
  )

  // Código que no coincide
  assert.throws(
    () => simulateApproveVerification('admin', 'req-1', 'LB-ERRONEO1', state),
    /whatsapp_code_invalid/
  )
})

test('5: Rechazo de solicitudes vencidas (> 48h)', () => {
  const pastExpires = new Date(Date.now() - 3600 * 1000).toISOString()
  const state = {
    profiles: [{ id: 'usr-1', name: 'Lucas', whatsapp_verified: false }],
    contacts: [{ id: 'c-1', profile_id: 'usr-1', type: 'whatsapp', value: '1123456789' }],
    requests: [
      {
        id: 'req-1',
        profile_id: 'usr-1',
        phone_declared: '1123456789',
        code: 'LB-VENCIDO1',
        status: 'pendiente' as const,
        expires_at: pastExpires,
        created_at: new Date(Date.now() - 49 * 3600 * 1000).toISOString(),
      },
    ],
  }

  assert.throws(
    () => simulateApproveVerification('admin', 'req-1', 'LB-VENCIDO1', state),
    /whatsapp_request_expired/
  )
})

test('6: Rechazo de solicitudes cuyo teléfono cambió a otra línea', () => {
  const state = {
    profiles: [{ id: 'usr-1', name: 'Lucas', whatsapp_verified: false }],
    // El usuario cambió su contacto a otro número diferente en el perfil
    contacts: [{ id: 'c-1', profile_id: 'usr-1', type: 'whatsapp', value: '11 9999 8888' }],
    requests: [
      {
        id: 'req-1',
        profile_id: 'usr-1',
        // La solicitud pendiente había sido pedida para su número viejo
        phone_declared: '11 2345 6789',
        code: 'LB-VIEJONUM',
        status: 'pendiente' as const,
        expires_at: calculateExpirationDate(48),
        created_at: new Date().toISOString(),
      },
    ],
  }

  assert.throws(
    () => simulateApproveVerification('admin', 'req-1', 'LB-VIEJONUM', state),
    /whatsapp_phone_mismatch/
  )
})

test('7: Rechazo de usuarios sin permisos administrativos', () => {
  const state = {
    profiles: [{ id: 'usr-1', name: 'Lucas', whatsapp_verified: false }],
    contacts: [{ id: 'c-1', profile_id: 'usr-1', type: 'whatsapp', value: '1123456789' }],
    requests: [
      {
        id: 'req-1',
        profile_id: 'usr-1',
        phone_declared: '1123456789',
        code: 'LB-USUARIO1',
        status: 'pendiente' as const,
        expires_at: calculateExpirationDate(48),
        created_at: new Date().toISOString(),
      },
    ],
  }

  assert.throws(
    () => simulateApproveVerification(null, 'req-1', 'LB-USUARIO1', state),
    /whatsapp_admin_only/
  )
  assert.throws(
    () => simulateApproveVerification('authenticated', 'req-1', 'LB-USUARIO1', state),
    /whatsapp_admin_only/
  )
})

test('8: Protección contra doble aprobación', () => {
  const state = {
    profiles: [{ id: 'usr-1', name: 'Lucas', whatsapp_verified: false }],
    contacts: [{ id: 'c-1', profile_id: 'usr-1', type: 'whatsapp', value: '1123456789' }],
    requests: [
      {
        id: 'req-1',
        profile_id: 'usr-1',
        phone_declared: '1123456789',
        code: 'LB-DOBLEAPR',
        status: 'pendiente' as const,
        expires_at: calculateExpirationDate(48),
        created_at: new Date().toISOString(),
      },
    ],
  }

  // Primera aprobación: exitosa
  simulateApproveVerification('admin', 'req-1', 'LB-DOBLEAPR', state)
  assert.equal(state.requests[0].status, 'aprobado')

  // Intento de re-aprobación: rechaza
  assert.throws(
    () => simulateApproveVerification('admin', 'req-1', 'LB-DOBLEAPR', state),
    /whatsapp_request_already_resolved/
  )
})

test('9: Protección de cuentas ajenas (perfil derivado de la solicitud)', () => {
  const state = {
    profiles: [
      { id: 'usr-dueno', name: 'Dueño Legítimo', whatsapp_verified: false },
      { id: 'usr-ajeno', name: 'Tercero', whatsapp_verified: false },
    ],
    contacts: [
      { id: 'c-1', profile_id: 'usr-dueno', type: 'whatsapp', value: '1123456789' },
      { id: 'c-2', profile_id: 'usr-ajeno', type: 'whatsapp', value: '1199990000' },
    ],
    requests: [
      {
        id: 'req-dueno',
        profile_id: 'usr-dueno',
        phone_declared: '1123456789',
        code: 'LB-DUENO123',
        status: 'pendiente' as const,
        expires_at: calculateExpirationDate(48),
        created_at: new Date().toISOString(),
      },
    ],
  }

  // La aprobación de req-dueno solo aprueba a usr-dueno
  const res = simulateApproveVerification('admin', 'req-dueno', 'LB-DUENO123', state)
  assert.equal(res.approved_profile_id, 'usr-dueno')
  assert.equal(state.profiles[0].whatsapp_verified, true)
  assert.equal(state.profiles[1].whatsapp_verified, false) // El tercero no se modifica jamás
})

test('10: Compatibilidad con referencias históricas LAB-XXXXXX sin expires_at', () => {
  const state = {
    profiles: [{ id: 'usr-hist', name: 'Usuario Histórico', whatsapp_verified: false }],
    contacts: [{ id: 'c-hist', profile_id: 'usr-hist', type: 'whatsapp', value: '1133334444' }],
    requests: [
      {
        id: 'req-hist-1',
        profile_id: 'usr-hist',
        phone_declared: '1133334444',
        code: 'LAB-123456',
        status: 'pendiente' as const,
        expires_at: null, // Histórica sin expiración
        created_at: '2026-10-01T12:00:00Z',
      },
    ],
  }

  const res = simulateApproveVerification('admin', 'req-hist-1', 'LAB-123456', state)
  assert.equal(res.approved_profile_id, 'usr-hist')
  assert.equal(state.profiles[0].whatsapp_verified, true)
  assert.equal(state.requests[0].status, 'aprobado')
})
