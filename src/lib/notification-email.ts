import { supabase } from '@/lib/supabase'
import { captureAppError } from '@/lib/sentry'

export interface EmailDispatchResult {
  ok: boolean
  status: 'sent' | 'skipped' | 'failed' | 'no_session'
  reason?: string | null
  error?: string | null
}

// Email is a secondary channel: failures are recorded but never propagated to
// the operation that already created the in-app notification.
export async function dispatchNotificationEmail(notificationId: string): Promise<EmailDispatchResult> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session?.access_token) {
      console.warn('Notification email dispatch skipped: no active session token')
      return { ok: false, status: 'no_session', reason: 'no_active_session_token' }
    }

    const token = sessionData.session.access_token

    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: { notification_id: notificationId },
    })

    if (error) {
      captureAppError(error, 'notification_email_dispatch')
      console.warn('Notification email dispatch failed:', error.message)
      return { ok: false, status: 'failed', error: error.message }
    }

    if (data?.status === 'skipped') {
      console.info('Notification email dispatch skipped by rule:', data.reason)
      return { ok: true, status: 'skipped', reason: data.reason }
    }

    return { ok: true, status: data?.status || 'sent' }
  } catch (error) {
    captureAppError(error, 'notification_email_dispatch')
    console.warn('Notification email dispatch failed:', error)
    return { ok: false, status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}
