// LABURANTE — Generador y validador de referencias de verificación de WhatsApp
//
// Reemplaza los antiguos códigos de estilo OTP/PIN bancario ("LAB-123456") por
// referencias de gestión alfanuméricas no predecibles ("LB-XXXXXXXX").
//
// Características:
// - Generación criptográficamente segura (crypto.getRandomValues).
// - Alfabeto sin caracteres ambiguos (excluye 0, O, 1, I).
// - Soporta compatibilidad retroactiva con solicitudes históricas ("LAB-XXXXXX").
// - Soporta control de vigencia / expiración (48 horas por defecto).

const CROCKFORD_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const DEFAULT_VERIFICATION_HOURS = 48

/**
 * Genera una referencia única de gestión con entropía criptográfica.
 * Formato resultante: "LB-XXXXXXXX" (8 caracteres aleatorios).
 */
export function generateWhatsAppReference(length = 8): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let code = ''
  for (let i = 0; i < length; i++) {
    code += CROCKFORD_ALPHABET[bytes[i] % CROCKFORD_ALPHABET.length]
  }

  return `LB-${code}`
}

/**
 * Comprueba si un código o referencia cumple con el formato aceptado:
 * - Histórico: LAB-123456
 * - Nuevo estándar: LB-XXXXXXXX (6 a 10 caracteres legibles)
 */
export function isValidVerificationCodeOrRef(value: string | null | undefined): boolean {
  if (!value) return false
  const clean = value.trim().toUpperCase()
  const isLegacy = /^LAB-[0-9]{6}$/.test(clean)
  const isModern = /^LB-[2-9A-HJ-NP-Z]{8}$/.test(clean)
  return isLegacy || isModern
}

/**
 * Comprueba si una solicitud de verificación ha vencido.
 * Las solicitudes históricas que no poseen expires_at (null o undefined) no se invalidan.
 */
export function isVerificationRequestExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const expiryTime = new Date(expiresAt).getTime()
  if (Number.isNaN(expiryTime)) return false
  return Date.now() > expiryTime
}

/**
 * Calcula la fecha de expiración en formato ISO para una nueva solicitud.
 */
export function calculateExpirationDate(hours = DEFAULT_VERIFICATION_HOURS): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

/**
 * Genera el mensaje preconfigurado oficial para solicitar verificación por WhatsApp.
 * Incluye nombre del solicitante, texto explicativo y la referencia unívoca.
 */
export function generateWhatsAppVerificationMessage(profileName: string | null | undefined, referenceCode: string): string {
  const name = (profileName || '').trim()
  const greeting = name ? `Hola, soy ${name}.` : 'Hola.'
  return `${greeting}\n\nEstoy solicitando verificar mi número de WhatsApp en LABURANTE.\n\nMi referencia de verificación es: ${referenceCode}.`
}

/**
 * Normaliza un número telefónico de WhatsApp argentino o internacional a sus dígitos canónicos.
 * Remueve prefijos de país (+54, 549, 54), prefijos interurbanos (0) y prefijos móviles (15).
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  let digits = phone.replace(/[^0-9]/g, '')

  // Prefijos argentinos: 549 o 54 seguidos de 10 dígitos (área + abonado nacional)
  if (/^549[0-9]{10}$/.test(digits)) {
    digits = digits.slice(3)
  } else if (/^54[0-9]{10}$/.test(digits)) {
    digits = digits.slice(2)
  }

  // Prefijo interurbano nacional (ej: 011, 0351, 0341)
  if (/^0[0-9]{10,}$/.test(digits)) {
    digits = digits.slice(1)
  }

  // Prefijo móvil local 15 luego del código de área
  // AMBA (área 11): 11 15 xxxxxxxx
  if (/^1115[0-9]{8}$/.test(digits)) {
    digits = '11' + digits.slice(4)
  } else if (/^[0-9]{3}15[0-9]{7}$/.test(digits)) {
    digits = digits.slice(0, 3) + digits.slice(5)
  } else if (/^[0-9]{4}15[0-9]{6}$/.test(digits)) {
    digits = digits.slice(0, 4) + digits.slice(6)
  }

  return digits
}

/**
 * Comprueba si dos representaciones de teléfono corresponden a la misma línea telefónica.
 * Admite equivalencias entre formatos internacionales (+54 9 11...), nacionales con 0/15 y locales (11...).
 */
export function areWhatsAppPhonesMatching(phoneA: string | null | undefined, phoneB: string | null | undefined): boolean {
  if (!phoneA || !phoneB) return false
  const normA = normalizeWhatsAppPhone(phoneA)
  const normB = normalizeWhatsAppPhone(phoneB)
  if (!normA || !normB) return false
  if (normA === normB) return true
  // Si ambos tienen al menos 10 dígitos, comparar los últimos 10 dígitos (área + abonado nacional)
  if (normA.length >= 10 && normB.length >= 10) {
    return normA.slice(-10) === normB.slice(-10)
  }
  return false
}
