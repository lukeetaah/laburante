import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { InAppNotification } from '@/lib/database.types'
import { addAppBreadcrumb, captureAppError } from '@/lib/sentry'
import { dispatchNotificationEmail } from '@/lib/notification-email'

const LOCAL_NOTIFS_KEY = 'laburante_notifications_cache'

function getLocalNotifications(userId?: string | null): InAppNotification[] {
  try {
    const key = userId ? `${LOCAL_NOTIFS_KEY}:${userId}` : `${LOCAL_NOTIFS_KEY}:guest`
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalNotifications(notifs: InAppNotification[], userId?: string | null) {
  try {
    const key = userId ? `${LOCAL_NOTIFS_KEY}:${userId}` : `${LOCAL_NOTIFS_KEY}:guest`
    localStorage.setItem(key, JSON.stringify(notifs))
  } catch (e) {
    console.warn('Could not save notifications to localStorage:', e)
  }
}

type NotificationCommand =
  | { kind: 'job_request'; jobRequestId: string; event: 'created'; recipientRole: 'client' | 'professional'; operationAt: string }
  | { kind: 'job_request'; jobRequestId: string; event: 'budget' | 'status' | 'cancelled'; operationAt: string }
  | { kind: 'company_candidate_inquiry'; inquiryId: string; event: 'created' | 'refreshed' | 'responded'; operationAt: string }
  | { kind: 'company_opportunity_share'; shareId: string; event: 'published' | 'interesada' | 'descartada' }
  | { kind: 'review'; recommendationId: string }
  | { kind: 'profile_whatsapp_verified'; profileId: string }
  | { kind: 'admin_profile_reminder'; profileId: string }
  | { kind: 'admin_whatsapp_verification'; requestId: string }

type NotificationCreateResult = {
  notificationId: string | null
  error: string | null
}

interface NotificationState {
  notifications: InAppNotification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  addNotification: (command: NotificationCommand) => Promise<NotificationCreateResult>
}

function getNotificationRpc(command: NotificationCommand) {
  switch (command.kind) {
    case 'job_request':
      return {
        name: 'notify_job_request',
        args: {
          target_job_request_id: command.jobRequestId,
          event_name: command.event,
          recipient_role: command.event === 'created' ? command.recipientRole : null,
          operation_marker: command.operationAt,
        },
      }
    case 'company_candidate_inquiry':
      return {
        name: 'notify_company_candidate_inquiry',
        args: { target_inquiry_id: command.inquiryId, event_name: command.event, operation_marker: command.operationAt },
      }
    case 'company_opportunity_share':
      return {
        name: 'notify_company_opportunity_share',
        args: { target_share_id: command.shareId, event_name: command.event },
      }
    case 'review':
      return {
        name: 'notify_review',
        args: { target_recommendation_id: command.recommendationId },
      }
    case 'profile_whatsapp_verified':
      return {
        name: 'notify_profile_whatsapp_verified',
        args: { target_profile_id: command.profileId },
      }
    case 'admin_profile_reminder':
      return {
        name: 'notify_admin_profile_reminder',
        args: { target_profile_id: command.profileId },
      }
    case 'admin_whatsapp_verification':
      return {
        name: 'notify_admin_whatsapp_verification',
        args: { target_request_id: command.requestId },
      }
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  fetchNotifications: async () => {
    addAppBreadcrumb('notifications_fetch_started')
    set({ loading: true })
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      const local = getLocalNotifications(userId)

      if (userId) {
        const { data, error } = await (supabase.from('notifications') as any)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (!error && data) {
          const dbIds = new Set(data.map((n: any) => n.id))
          const merged = [
            ...data,
            ...local.filter((n) => !dbIds.has(n.id) && n.user_id === userId),
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

          saveLocalNotifications(merged, userId)
          set({
            notifications: merged,
            unreadCount: merged.filter((n) => !n.read).length,
            loading: false,
          })
          return
        }
      }
    } catch (e) {
      captureAppError(e, 'notifications_fetch')
      console.warn('Supabase notifications fetch failed, using cache:', e)
    }

    const { data: guestData } = await supabase.auth.getUser()
    const local = getLocalNotifications(guestData?.user?.id)
    set({
      notifications: local,
      unreadCount: local.filter((n) => !n.read).length,
      loading: false,
    })
  },

  markAsRead: async (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )
    const { data } = await supabase.auth.getUser()
    saveLocalNotifications(updated, data.user?.id)
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    })

    try {
      await (supabase.from('notifications') as any)
        .update({ read: true })
        .eq('id', id)
    } catch (e) {
      captureAppError(e, 'notification_mark_read')
      console.warn('Failed to update notification read status in DB:', e)
    }
  },

  markAllAsRead: async () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }))
    const { data } = await supabase.auth.getUser()
    saveLocalNotifications(updated, data.user?.id)
    set({
      notifications: updated,
      unreadCount: 0,
    })

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user?.id) {
        await (supabase.from('notifications') as any)
          .update({ read: true })
          .eq('user_id', userData.user.id)
      }
    } catch (e) {
      captureAppError(e, 'notifications_mark_all_read')
      console.warn('Failed to mark all notifications read in DB:', e)
    }
  },

  addNotification: async (command) => {
    addAppBreadcrumb('notification_create_started')
    try {
      const rpc = getNotificationRpc(command)
      const { data: notificationId, error } = await supabase.rpc(rpc.name, rpc.args)
      if (error) throw error

      const { data: userData } = await supabase.auth.getUser()
      const currentUserId = userData?.user?.id || null
      const createdId = typeof notificationId === 'string' ? notificationId : null

      if (createdId && currentUserId) {
        const { data: createdNotification } = await (supabase.from('notifications') as any)
          .select('*')
          .eq('id', createdId)
          .maybeSingle()

        if (createdNotification?.user_id === currentUserId) {
          const local = [createdNotification, ...getLocalNotifications(currentUserId)]
          saveLocalNotifications(local, currentUserId)
          set((s) => {
            const merged = [createdNotification, ...s.notifications.filter((n) => n.id !== createdNotification.id)]
            return { notifications: merged, unreadCount: merged.filter((n) => !n.read).length }
          })
        }
      }

      if (createdId) dispatchNotificationEmail(createdId)
      return { notificationId: createdId, error: null }
    } catch (e) {
      captureAppError(e, 'notification_create')
      console.warn('Could not create notification through the business RPC:', e)
      return { notificationId: null, error: e instanceof Error ? e.message : String(e) }
    }
  },

}))
