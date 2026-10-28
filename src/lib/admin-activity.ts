export type AdminActivityFailureKind =
  | 'unauthorized'
  | 'unauthorized_admin_access'
  | 'auth_users_unavailable'
  | 'network'
  | 'unexpected_http'
  | 'invalid_response'

export type AdminActivityFailure = {
  kind: AdminActivityFailureKind
  httpStatus: number | null
}

export type AdminActivityUser = {
  id: string
  last_sign_in_at: string | null
  last_sign_in_status: AdminActivityStatus
}

type AdminActivityStatus = 'available' | 'never' | 'invalid_response' | 'user_not_found'

export type AdminActivityResult =
  | { available: true; users: Record<string, AdminActivityUser>; failure: null }
  | { available: false; users: Record<string, never>; failure: AdminActivityFailure }

type InvokeResult = {
  data: unknown
  error: unknown
  response?: Response
}

async function safeErrorCode(response?: Response) {
  if (!response) return null
  try {
    const body = await response.clone().json()
    return body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : null
  } catch {
    return null
  }
}

function failure(kind: AdminActivityFailureKind, httpStatus: number | null): AdminActivityResult {
  return { available: false, users: {}, failure: { kind, httpStatus } }
}

function isAdminActivityUser(entry: unknown): entry is AdminActivityUser {
  if (!entry || typeof entry !== 'object') return false
  const candidate = entry as Record<string, unknown>
  return typeof candidate.id === 'string'
    && candidate.id.length > 0
    && (candidate.last_sign_in_at === null || typeof candidate.last_sign_in_at === 'string')
    && (candidate.last_sign_in_status === 'available'
      || candidate.last_sign_in_status === 'never'
      || candidate.last_sign_in_status === 'invalid_response'
      || candidate.last_sign_in_status === 'user_not_found')
}

export async function classifyAdminActivityResult({ data, error, response }: InvokeResult): Promise<AdminActivityResult> {
  if (error) {
    const httpStatus = typeof response?.status === 'number' ? response.status : null
    const errorCode = await safeErrorCode(response)

    if (errorCode === 'unauthorized' || httpStatus === 401) return failure('unauthorized', httpStatus)
    if (errorCode === 'unauthorized_admin_access' || httpStatus === 403) return failure('unauthorized_admin_access', httpStatus)
    if (errorCode === 'auth_users_unavailable' || httpStatus === 502) return failure('auth_users_unavailable', httpStatus)
    if ((error as { name?: unknown }).name === 'FunctionsFetchError') return failure('network', null)
    if (!response) return failure('invalid_response', null)
    return failure('unexpected_http', httpStatus)
  }

  if (!data || typeof data !== 'object' || (data as { status?: unknown }).status !== 'ok' || !Array.isArray((data as { users?: unknown }).users)) {
    return failure('invalid_response', null)
  }

  const entries = (data as { users: unknown[] }).users
  if (!entries.every(isAdminActivityUser)) return failure('invalid_response', null)

  const users = Object.fromEntries(entries.map((entry) => [entry.id, entry]))
  return { available: true, users, failure: null }
}

export function describeAdminActivityFailure(failure: AdminActivityFailure | null | undefined) {
  switch (failure?.kind) {
    case 'unauthorized': return 'La sesión administrativa no está disponible o venció. Volvé a iniciar sesión.'
    case 'unauthorized_admin_access': return 'La sesión no incluye el permiso administrativo requerido por la función.'
    case 'auth_users_unavailable': return 'La función respondió, pero no pudo recuperar la actividad desde Auth.'
    case 'network': return 'No se pudo conectar con la función de actividad. Revisá la conexión e intentá actualizar.'
    case 'unexpected_http': return `La función devolvió una respuesta HTTP inesperada${failure.httpStatus ? ` (${failure.httpStatus})` : ''}.`
    case 'invalid_response': return 'La función respondió con un formato incompatible. Revisá el contrato desplegado.'
    default: return 'La última conexión no está disponible.'
  }
}
