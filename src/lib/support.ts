export const SUPPORT_MAX_TITLE_LENGTH = 160
export const SUPPORT_MAX_MESSAGE_LENGTH = 5000
export const SUPPORT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const SUPPORT_ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export type SupportStatus = 'nuevo' | 'en_revision' | 'esperando_usuario' | 'resuelto' | 'cancelado' | 'suspendido'
export type SupportCategory = 'acceso' | 'perfil' | 'pagos' | 'seguridad' | 'contenido' | 'empresa' | 'otro' | 'sin_clasificar'

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  nuevo: 'Nuevo',
  en_revision: 'En revisión',
  esperando_usuario: 'Esperando al usuario',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
  suspendido: 'Suspendido',
}

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  acceso: 'Acceso y cuenta',
  perfil: 'Perfil',
  pagos: 'Pagos',
  seguridad: 'Seguridad',
  contenido: 'Contenido o moderación',
  empresa: 'Cuenta Empresa',
  otro: 'Otro',
  sin_clasificar: 'Sin clasificar',
}

export function validateSupportTicketInput(title: string, message: string) {
  const normalizedTitle = title.trim()
  const normalizedMessage = message.trim()
  const errors: string[] = []
  if (!normalizedTitle) errors.push('El título es obligatorio.')
  if (normalizedTitle.length > SUPPORT_MAX_TITLE_LENGTH) errors.push(`El título no puede superar ${SUPPORT_MAX_TITLE_LENGTH} caracteres.`)
  if (!normalizedMessage) errors.push('El mensaje es obligatorio.')
  if (normalizedMessage.length > SUPPORT_MAX_MESSAGE_LENGTH) errors.push(`El mensaje no puede superar ${SUPPORT_MAX_MESSAGE_LENGTH} caracteres.`)
  return { valid: errors.length === 0, errors, title: normalizedTitle, message: normalizedMessage }
}

export function isSupportedImageMime(mimeType: string) {
  return (SUPPORT_ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType.toLowerCase())
}

export function hasSupportedImageSignature(bytes: Uint8Array, mimeType: string) {
  const type = mimeType.toLowerCase()
  if (type === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i])
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/webp') return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  return false
}

export function supportFileExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return null
}

export function supportStoragePath(ticketId: string, requestId: string, mimeType: string) {
  const extension = supportFileExtension(mimeType)
  return extension ? `${ticketId}/${requestId}.${extension}` : null
}


