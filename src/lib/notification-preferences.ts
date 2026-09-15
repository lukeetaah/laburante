import { supabase } from '@/lib/supabase'
import { captureAppError } from '@/lib/sentry'

const PREFERENCES_TABLE_MISSING_RE = /relation .*notification_preferences.*does not exist|Could not find the table .*notification_preferences|schema cache.*notification_preferences/i

export async function loadEmailNotificationsEnabled(userId: string) {
  try {
    const { data, error } = await (supabase.from('notification_preferences') as any)
      .select('email_notifications_enabled')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      if (!PREFERENCES_TABLE_MISSING_RE.test(error.message || '')) captureAppError(error, 'notification_preferences_load')
      return true
    }
    return data?.email_notifications_enabled !== false
  } catch (error) {
    captureAppError(error, 'notification_preferences_load')
    return true
  }
}

export async function saveEmailNotificationsEnabled(userId: string, enabled: boolean) {
  try {
    const { error } = await (supabase.from('notification_preferences') as any)
      .upsert({
        user_id: userId,
        email_notifications_enabled: enabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (!error) return { error: null }
    if (PREFERENCES_TABLE_MISSING_RE.test(error.message || '')) return { error: null }
    captureAppError(error, 'notification_preferences_save')
    return { error: error.message || 'No se pudo guardar la preferencia de emails.' }
  } catch (error: any) {
    captureAppError(error, 'notification_preferences_save')
    return { error: error?.message || 'No se pudo guardar la preferencia de emails.' }
  }
}
