import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateWhatsAppReference,
  isValidVerificationCodeOrRef,
  isVerificationRequestExpired,
  calculateExpirationDate,
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
