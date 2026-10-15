import { supabase } from '@/lib/supabase'

const ACTIVITY_TOUCH_PREFIX = 'laburante_activity_touch:'
const TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000
let activityRequestInFlight = false

/**
 * Records meaningful app use without writing on every interaction.
 * The database function repeats the 24-hour guard, so localStorage is only a
 * request optimization and never an authorization or activity source of truth.
 */
export async function recordUserActivity(userId: string): Promise<void> {
  if (!userId || activityRequestInFlight) return

  const storageKey = `${ACTIVITY_TOUCH_PREFIX}${userId}`
  try {
    const lastAttempt = Number(window.localStorage.getItem(storageKey) || 0)
    if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < TOUCH_INTERVAL_MS) return
  } catch {
    // El RPC mantiene el límite aunque el navegador bloquee localStorage.
  }

  activityRequestInFlight = true
  try {
    const { error } = await (supabase.rpc as any)('touch_my_activity')
    if (!error) {
      try {
        window.localStorage.setItem(storageKey, String(Date.now()))
      } catch {
        // El registro ya quedó protegido y persistido en la base.
      }
    }
  } catch {
    // La instrumentación de actividad no debe bloquear el uso de LABURANTE.
  } finally {
    activityRequestInFlight = false
  }
}
