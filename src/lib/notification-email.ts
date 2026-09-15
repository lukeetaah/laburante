import { supabase } from '@/lib/supabase'
import { captureAppError } from '@/lib/sentry'

// Email is a secondary channel: failures are recorded but never propagated to
// the operation that already created the in-app notification.
export function dispatchNotificationEmail(notificationId: string) {
  void supabase.functions.invoke('send-notification-email', {
    body: { notification_id: notificationId },
  }).then(({ error }) => {
    if (error) {
      captureAppError(error, 'notification_email_dispatch')
      console.warn('Notification email dispatch skipped:', error.message)
    }
  }).catch((error) => {
    captureAppError(error, 'notification_email_dispatch')
    console.warn('Notification email dispatch failed:', error)
  })
}
