import { supabase } from '@/lib/supabase'
import { captureAppError } from '@/lib/sentry'

// Email is a secondary channel: failures are recorded but never propagated to
// the operation that already created the in-app notification.
export async function dispatchNotificationEmail(notificationId: string) {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session?.access_token) {
      console.warn('Notification email dispatch skipped: no active session token')
      return
    }

    const token = sessionData.session.access_token

    const { error } = await supabase.functions.invoke('send-notification-email', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: { notification_id: notificationId },
    })

    if (error) {
      captureAppError(error, 'notification_email_dispatch')
      console.warn('Notification email dispatch skipped:', error.message)
    }
  } catch (error) {
    captureAppError(error, 'notification_email_dispatch')
    console.warn('Notification email dispatch failed:', error)
  }
}
