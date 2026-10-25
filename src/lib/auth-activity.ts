export type AdminAuthActivityStatus =
  | 'available'
  | 'never'
  | 'invalid_response'
  | 'user_not_found'
  | 'service_unavailable'

export function describeLastSignIn(
  status: AdminAuthActivityStatus,
  timestamp: string | null | undefined,
  now = Date.now(),
) {
  if (status === 'service_unavailable') return 'No disponible: no se pudo consultar Auth.'
  if (status === 'user_not_found') return 'Usuario de Auth no encontrado.'
  if (status === 'invalid_response') return 'Respuesta de Auth incompleta o inválida.'
  if (status === 'never' || !timestamp) return 'Nunca ingresó: Auth no registra un inicio de sesión.'

  const parsed = new Date(timestamp).getTime()
  if (!Number.isFinite(parsed)) return 'Respuesta de Auth incompleta o inválida.'
  const days = Math.max(0, Math.floor((now - parsed) / (1000 * 60 * 60 * 24)))
  return `${new Date(timestamp).toLocaleString()} · hace ${days} días`
}
