const ACTIVITY_WEEK_PREFIX = 'laburante_activity_week:'
export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'
let activityRequestInFlight = false

export interface ActivityStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function getDefaultStorage(): ActivityStorage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return null
}

export interface RecordActivityOptions {
  now?: Date
  client?: any
  storage?: ActivityStorage | null
}

/**
 * Computes the Monday (YYYY-MM-DD) of the calendar week for a given date in Argentina timezone.
 * Exactly matches the database calculation in record_my_weekly_activity RPC.
 */
export function getArgentinaWeekStartKey(value: Date | string = new Date()): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('invalid_date')

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const localDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
  const day = localDate.getUTCDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday)
  return localDate.toISOString().slice(0, 10)
}

/**
 * Records one authenticated presence per calendar week (Monday to Sunday in Argentina timezone).
 *
 * Local storage retains the current calendar week key (YYYY-MM-DD) purely as a client-side
 * optimization to prevent redundant network calls. The database primary key (user_id, week_start)
 * guarantees server-side idempotency.
 *
 * If the Supabase call fails, local storage is NOT updated, ensuring future visits can retry.
 */
export async function recordUserActivity(
  userId: string,
  options?: RecordActivityOptions
): Promise<boolean> {
  if (!userId || activityRequestInFlight) return false

  const now = options?.now || new Date()
  const currentWeekKey = getArgentinaWeekStartKey(now)
  const storage = options?.storage !== undefined ? options.storage : getDefaultStorage()
  const storageKey = `${ACTIVITY_WEEK_PREFIX}${userId}`

  if (storage) {
    try {
      const storedWeek = storage.getItem(storageKey)
      if (storedWeek === currentWeekKey) {
        return false // Ya registrado para esta semana calendario
      }
    } catch {
      // Si el navegador bloquea localStorage, continuamos hacia el RPC de Supabase.
    }
  }

  activityRequestInFlight = true

  try {
    const client = options?.client || (await import('./supabase')).supabase
    const { error } = await client.rpc('record_my_weekly_activity')
    if (error) {
      // IMPORTANTE: Si Supabase devuelve un error, NO marcamos la semana como registrada
      // en el almacenamiento local para permitir reintentos.
      return false
    }

    if (storage) {
      try {
        storage.setItem(storageKey, currentWeekKey)
      } catch {
        // La actividad ya quedó protegida e insertada en PostgreSQL.
      }
    }
    return true
  } catch {
    // La instrumentación de actividad nunca debe interrumpir el uso de LABURANTE.
    return false
  } finally {
    activityRequestInFlight = false
  }
}
