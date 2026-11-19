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
